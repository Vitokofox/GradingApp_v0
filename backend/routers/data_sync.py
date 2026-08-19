from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text
from database import database, models
from routers.auth import get_current_admin_user, get_current_active_user
from services.quality_alerts import quality_alert_dict, save_quality_alert, validate_inspection_subtype
import io
import json
from datetime import datetime, date
import xlsxwriter

# Helper to serialize dates
def json_serial(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

router = APIRouter(
    prefix="/api/sync",
    tags=["Data Sync"],
)

@router.get("/master-data/excel")
def export_master_data_excel(db: Session = Depends(database.get_db), current_user = Depends(get_current_active_user)):
    """
    Generates an Excel file with all master data in separate sheets.
    This file is intended to be imported by the Mobile App.
    """
    output = io.BytesIO()
    workbook = xlsxwriter.Workbook(output, {'in_memory': True})
    
    # Helper to write a sheet
    def write_sheet(sheet_name, data, headers):
        worksheet = workbook.add_worksheet(sheet_name)
        # Write headers
        for col_num, header in enumerate(headers):
            worksheet.write(0, col_num, header)
        
        # Write data
        for row_num, item in enumerate(data, 1):
            for col_num, key in enumerate(headers):
                # Handle nested objects or simple attributes
                val = getattr(item, key, None)
                
                # Special cases for relationships or booleans
                if key == 'active':
                    val = "true" if val else "false"
                elif key == 'product_id':
                     val = item.product_id
                
                # Convert to string if necessary
                if val is None: val = ""
                worksheet.write(row_num, col_num, str(val))

    # --- 1. Products ---
    products = db.query(models.Product).all()
    # Manual writing for flexibility
    ws_prod = workbook.add_worksheet('products')
    ws_prod.write_row(0, 0, ['id', 'name'])
    for i, p in enumerate(products, 1):
        ws_prod.write_row(i, 0, [p.id, p.name])

    # --- 2. Grades ---
    grades = db.query(models.Grade).all()
    ws_grade = workbook.add_worksheet('grades')
    ws_grade.write_row(0, 0, ['id', 'product_id', 'name', 'grade_rank'])
    for i, g in enumerate(grades, 1):
        ws_grade.write_row(i, 0, [g.id, g.product_id, g.name, g.grade_rank])

    # --- 3. Defects ---
    defects = db.query(models.Defect).all()
    ws_defect = workbook.add_worksheet('defects')
    ws_defect.write_row(0, 0, ['id', 'name', 'description'])
    for i, d in enumerate(defects, 1):
        ws_defect.write_row(i, 0, [d.id, d.name, d.description or ""])

    # --- 4. Users (Only safe info) ---
    users = db.query(models.User).all()
    ws_user = workbook.add_worksheet('users')
    ws_user.write_row(0, 0, ['username', 'role', 'hashed_password']) # We send hashed password for offline login matching
    for i, u in enumerate(users, 1):
        ws_user.write_row(i, 0, [u.username, u.role, u.hashed_password])

    # --- 5. Markets ---
    markets = db.query(models.Market).all()
    ws_market = workbook.add_worksheet('markets')
    ws_market.write_row(0, 0, ['id', 'name'])
    for i, m in enumerate(markets, 1):
        ws_market.write_row(i, 0, [m.id, m.name])

    # --- 6. Generic Catalogs (Split by category or one big sheet? Let's do separate sheets for clarity as requested by frontend logic) ---
    # Mobile expects: 'shifts', 'journeys', 'areas', 'machines', 'origins', 'states', 'terminations', 'supervisors'
    categories = ['shifts', 'journeys', 'areas', 'machines', 'origins', 'states', 'terminations', 'supervisors']
    
    for cat in categories:
        items = db.query(models.CatalogItem).filter(models.CatalogItem.category == cat).all()
        ws = workbook.add_worksheet(cat)
        ws.write_row(0, 0, ['id', 'name', 'active'])
        for i, item in enumerate(items, 1):
            ws.write_row(i, 0, [item.id, item.name, "true" if item.active else "false"])

    workbook.close()
    output.seek(0)
    
    filename = f"master_data_complete_{datetime.now().strftime('%Y%m%d')}.xlsx"
    return StreamingResponse(
        output, 
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/inspections/json")
def export_inspections_json(
    start_date: str = None, 
    end_date: str = None, 
    db: Session = Depends(database.get_db), 
    current_user = Depends(get_current_active_user)
):
    """
    Exports inspections and their results to a deeply nested JSON.
    """
    query = db.query(models.Inspection).options(
        joinedload(models.Inspection.market),
        joinedload(models.Inspection.quality_alert).joinedload(models.QualityAlert.photos),
    )
    
    if start_date:
        query = query.filter(models.Inspection.date >= start_date)
    if end_date:
        query = query.filter(models.Inspection.date <= end_date)
        
    inspections = query.all()
    
    export_data = []
    for insp in inspections:
        # Get results for this inspection
        results = db.query(models.InspectionResult).options(
            joinedload(models.InspectionResult.grade),
            joinedload(models.InspectionResult.defect)
        ).filter(models.InspectionResult.inspection_id == insp.id).all()
        
        results_data = []
        for r in results:
            results_data.append({
                "grade_name": r.grade.name if r.grade else None,
                "defect_name": r.defect.name if r.defect else None,
                "pieces_count": r.pieces_count
            })
            
        insp_dict = {
            "remote_id": insp.id, # Keep track of server ID
            "date": insp.date.isoformat() if insp.date else None,
            "type": insp.type,
            "inspection_subtype": insp.inspection_subtype,
            "shift": insp.shift,
            "supervisor": insp.supervisor,
            "product_name": insp.product_name,
            "lot": insp.lot,
            "pieces_inspected": insp.pieces_inspected,
            "state": insp.state,
            "responsible": insp.responsible,
            "journey": insp.journey,
            "area": insp.area,
            "width": insp.width,
            "thickness": insp.thickness,
            "length": insp.length,
            "origin": insp.origin,
            "market_name": insp.market.name if insp.market else None,
            "termination": insp.termination,
            "results": results_data,
            "quality_alert": quality_alert_dict(insp.quality_alert),
        }
        export_data.append(insp_dict)
        
    return JSONResponse(content=export_data)


@router.post("/upload")
async def upload_inspections_json(
    items: list[dict], 
    db: Session = Depends(database.get_db)
):
    """
    Receives JSON body directly.
    """
    return await _import_inspections_logic(items, db)

@router.post("/import-file")
async def upload_inspections_file(
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db), 
    current_user = Depends(get_current_active_user)
):
    """
    Receives a JSON file and processes it.
    """
    try:
        contents = await file.read()
        items = json.loads(contents)
        return await _import_inspections_logic(items, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"File error: {str(e)}")

async def _import_inspections_logic(items: list[dict], db: Session):
    try:
        imported_count = 0
        skipped_count = 0
        imported_alerts = []
        
        for item in items:
            # Allow mobile payloads to force creation even if they match dedupe keys.
            force_new = bool(item.get('force_new') or item.get('force_create'))

            # Simple dedupe by LOT, DATE, SHIFT, and PRODUCT to prevent accidental retries.
            if not force_new and item.get('lot') and item.get('lot') != 'N/A':
                 cmp_date = date.today()
                 if item.get('date'):
                     try:
                         cmp_date = datetime.fromisoformat(item['date'].split('T')[0]).date()
                     except:
                         pass

                 exists = db.query(models.Inspection).filter(
                     models.Inspection.lot == item['lot'],
                     models.Inspection.date == cmp_date,
                     models.Inspection.shift == item.get('shift'),
                     models.Inspection.product_name == item.get('product_name')
                 ).first()

                 if exists:
                     skipped_count += 1
                     continue
            
            # Resolve References
            product_id = None
            if item.get('product_name'):
                p = db.query(models.Product).filter(models.Product.name == item['product_name']).first()
                if p: product_id = p.id
            
            market_id = item.get('market_id')
            if item.get('market_name'):
                m = db.query(models.Market).filter(models.Market.name == item['market_name']).first()
                if m: market_id = m.id
                
            # Create Inspection
            insp_date = date.today()
            if item.get('date'):
                try:
                    # Mobile format: "2024-03-24T..." OR just "2024-03-24"
                    d_str = item['date']
                    if 'T' in d_str: d_str = d_str.split('T')[0]
                    insp_date = datetime.strptime(d_str, "%Y-%m-%d").date()
                except:
                    pass

            new_insp = models.Inspection(
                date=insp_date,
                production_date=insp_date, # Reusing for simplicity if missing
                type=item.get('type', 'finished_product'),
                inspection_subtype=validate_inspection_subtype(item.get('inspection_subtype')),
                shift=item.get('shift'),
                supervisor=item.get('supervisor'),
                product_name=item.get('product_name'),
                lot=item.get('lot'),
                pieces_inspected=item.get('pieces_inspected', 0),
                state=item.get('state', 'finished'),
                responsible=item.get('responsible'),
                journey=item.get('journey'),
                area=item.get('area', 'Aserradero'),
                machine=item.get('machine', 'Stacker 1'),
                width=item.get('width', '5"'),
                thickness=item.get('thickness', '1 1/2'),
                length=item.get('length', '3.66'),
                origin=item.get('origin', 'Interno'),
                market_id=market_id,
                termination=item.get('termination', 'Terminado')
            )
            
            db.add(new_insp)
            db.flush()
            alert = save_quality_alert(db, new_insp, item.get('quality_alert'))
            if alert:
                imported_alerts.append({
                    'inspection_id': new_insp.id,
                    'alert_id': alert.id,
                    'code': alert.code,
                })
            
            # Process Results
            if 'results' in item:
                for res in item['results']:
                    g_id = res.get('grade_id') # Try ID first (Mobile App format)
                    if not g_id and res.get('grade_name'):
                        g_query = db.query(models.Grade).filter(models.Grade.name == res['grade_name'])
                        if product_id:
                            g_query = g_query.filter(models.Grade.product_id == product_id)
                        grade_obj = g_query.first()
                        if grade_obj: g_id = grade_obj.id
                    
                    d_id = res.get('defect_id') # Try ID first (Mobile App format)
                    if not d_id and res.get('defect_name') and res.get('defect_name') not in ['Sin Defecto', 'SIN DEFECTO / EN GRADO']:
                        d_obj = db.query(models.Defect).filter(models.Defect.name == res['defect_name']).first()
                        if d_obj: d_id = d_obj.id
                        
                    if g_id:
                        new_res = models.InspectionResult(
                            inspection_id=new_insp.id,
                            grade_id=g_id,
                            defect_id=d_id,
                            pieces_count=res.get('pieces_count', 0)
                        )
                        db.add(new_res)
            
            imported_count += 1
            
        db.commit()
        return {
            "status": "success", "imported": imported_count,
            "skipped": skipped_count, "quality_alerts": imported_alerts,
        }
        
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

@router.get("/full-dump")
def get_full_master_data_dump(db: Session = Depends(database.get_db)):
    """
    Returns ALL master data in a single JSON structure.
    Used for Direct Sync to Mobile (replacing Excel).
    """
    data = {}
    
    # 1. Products
    products = db.query(models.Product).all()
    data['products'] = [{"id": str(p.id), "name": p.name} for p in products]
    
    # 2. Users
    users = db.query(models.User).all()
    data['users'] = [{"username": u.username, "role": u.level, "password_hash": u.password_hash} for u in users]
    
    # 3. Markets
    markets = db.query(models.Market).all()
    data['markets'] = [{"id": str(m.id), "name": m.name} for m in markets]
    
    # 4. Catalogs
    # 4. Catalogs
    # Map Plural JSON keys to Singular DB categories
    cat_mapping = {
        'shifts': ['shift', 'turno'],
        'journeys': ['journey', 'jornada'],
        'areas': ['area'],
        'machines': ['machine', 'maquina'],
        'origins': ['origin', 'origen'],
        'states': ['state', 'estado'],
        'terminations': ['termination', 'terminacion'],
        'supervisors': ['supervisor'],
        'operators': ['operator', 'operador', 'operators'],
        'lengths': ['length', 'largo'],
        'estates': ['estate', 'predio', 'estates'],
        'logging_teams': ['logging_team', 'equipo', 'logging_teams'],
        'characteristics': ['characteristic', 'caracteristica', 'characteristics']
    }
    
    for json_key, db_cats in cat_mapping.items():
        # Search for any matching category
        items = []
        for db_cat in db_cats:
             # Try exact match first, then case insensitive if needed
             # Since we saw lowercase in debug, let's try strict first for speed, or ILIKE for robustness.
             # Using Python filtering for max compatibility if DB collation is tricky.
             found = db.query(models.CatalogItem).filter(models.CatalogItem.category.ilike(db_cat)).all()
             items.extend(found)
        
        # Deduplicate by ID just in case
        unique_items = {i.id: i for i in items}.values()
        
        data[json_key] = [{"id": str(i.id), "name": i.name, "active": i.active} for i in unique_items]
        
    # 5. Defects
    defects = db.query(models.Defect).all()
    data['defects'] = [{"id": str(d.id), "name": d.name} for d in defects]
    
    # 6. Grades (Grouped by Product ID for easier mobile consumption, or flat list?)
    # Flattened with product_id is better for DB seeding.
    # But current Mobile Excel logic created 'grades_ProductID'. 
    # Let's send a flat list and let mobile process it, OR mimic the 'grades_PID' structure directly.
    # Mimicking 'grades_PID' is confusing. Let's send flat 'grades' with product_id.
    
    # Wait, existing mobile logic expects `grades_PID` keys in the huge object?
    # Let's see DataImportExport.jsx logic:
    # "if sheetName === 'grades' ... newMasterData[`grades_${pid}`] = ..."
    # So mobile DB expects `grades_1`, `grades_2`.
    # We should construct that here to save processing on mobile.
    
    grades = db.query(models.Grade).all()
    grades_map = {}
    for g in grades:
        key = f"grades_{g.product_id}"
        if key not in grades_map: grades_map[key] = []
        grades_map[key].append({"id": str(g.id), "name": g.name, "grade_rank": g.grade_rank, "product_id": str(g.product_id)})
    
    data.update(grades_map)
    
    # 7. Add Historical Inspections (Last 30 days maybe?)
    # Optional, but requested "Web to Mobile History".
    # Let's add 'inspections_history' key.
    # Limit to reasonable amount, e.g. last 100 or last 30 days.
    
    # Re-use export logic logic basically.
    # For now, let's keep it just Master Data to ensure stability first.
    # User can use the "Export JSON" feature for history if strictly needed, or we add it later.
    # Actually, plan said "Web -> Mobile" so we should include it.
    
    # 7. Add Historical Inspections (Last 200)
    last_inspections = db.query(models.Inspection)\
        .order_by(models.Inspection.date.desc(), models.Inspection.id.desc())\
        .limit(200)\
        .all()
        
    history = []
    for insp in last_inspections:
         # Format results
        results = []
        for res in insp.results:
            results.append({
                "grade_id": res.grade_id,
                "defect_id": res.defect_id,
                "pieces_count": res.pieces_count
            })
            
        history.append({
            "id": insp.id,
            "date": insp.date.isoformat() if insp.date else None,
            "production_date": insp.production_date.isoformat() if insp.production_date else None,
            "shift": insp.shift,
            "journey": insp.journey,
            "supervisor": insp.supervisor,
            "responsible": insp.responsible,
            "area": insp.area,
            "machine": insp.machine,
            "origin": insp.origin,
            "lot": insp.lot,
            "market_id": insp.market_id,
            "product_name": insp.product_name,
            "state": insp.state,
            "termination": insp.termination,
            "thickness": insp.thickness,
            "width": insp.width,
            "length": insp.length,
            "pieces_inspected": insp.pieces_inspected,
            "type": insp.type,
            "inspection_subtype": insp.inspection_subtype,
            "results": results,
            "quality_alert": quality_alert_dict(insp.quality_alert),
        })
    data['inspections'] = history

    return JSONResponse(content=data)

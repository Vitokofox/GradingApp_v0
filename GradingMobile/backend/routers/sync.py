from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import database, models
from typing import List, Dict, Any

router = APIRouter()

@router.get("/full-dump")
def get_full_dump(db: Session = Depends(database.get_db)):
    """
    Returns a complete dump of master data for offline seeding.
    Structure matches the requirements of the mobile app's seedMasterData function.
    """
    
    data = {}

    # 1. Catalog Items (Grouped by category)
    # Categories: shift, journey, area, machine, origin, state, termination, supervisor
    catalog_items = db.query(models.CatalogItem).filter(models.CatalogItem.active == True).all()
    
    # Initialize lists
    for cat in ['shifts', 'journeys', 'areas', 'machines', 'origins', 'states', 'terminations', 'supervisors', 'lengths']:
        data[cat] = []

    # Map database categories to JSON keys (plural)
    # DB categories are usually singular (SHIFT, AREA, etc) or whatever was saved.
    # The Setup.jsx / db.js logic expects: 'shifts', 'journeys', etc.
    # We will iterate and sort them.
    
    # Mapping helper: DB Category -> JSON Key
    # Assuming DB stores specific strings. Let's try to be flexible.
    
    for item in catalog_items:
        cat_lower = item.category.lower().strip()
        
        target_key = None
        if 'shift' in cat_lower or 'turno' in cat_lower: target_key = 'shifts'
        elif 'journey' in cat_lower or 'jornada' in cat_lower: target_key = 'journeys'
        elif 'area' in cat_lower: target_key = 'areas'
        elif 'machine' in cat_lower or 'maquina' in cat_lower: target_key = 'machines'
        elif 'origin' in cat_lower or 'origen' in cat_lower: target_key = 'origins'
        elif 'state' in cat_lower or 'estado' in cat_lower: target_key = 'states'
        elif 'term' in cat_lower: target_key = 'terminations' # termination / terminacion
        elif 'super' in cat_lower: target_key = 'supervisors'
        elif 'len' in cat_lower or 'largo' in cat_lower: target_key = 'lengths'
        
        if target_key:
            data[target_key].append({
                "id": f"{target_key}_{item.id}", # Generate a string ID for consistency if desired, or keep int
                "db_id": item.id,
                "name": item.name,
                "category": target_key # Frontend expects "category" field often
            })

    # 2. Products
    products = db.query(models.Product).all()
    data['products'] = [{
        "id": p.id,
        "name": p.name
    } for p in products]

    # 3. Markets
    markets = db.query(models.Market).all()
    data['markets'] = [{
        "id": m.id,
        "name": m.name
    } for m in markets]

    # 4. Defects
    defects = db.query(models.Defect).all()
    data['defects'] = [{
        "id": d.id,
        "name": d.name,
        "description": d.description
    } for d in defects]

    # 5. Users
    users = db.query(models.User).filter(models.User.is_active == True).all()
    data['users'] = [{
        "username": u.username,
        "password_hash": u.password_hash,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "position": u.position
    } for u in users]

    # 6. Grades (Flattened AND Nested)
    # The mobile app `offlineRead` for grades tries `grades_{productId}` first, then `grades`.
    # We will provide BOTH to be safe.
    
    all_grades = db.query(models.Grade).all()
    
    # Flat list
    data['grades'] = []
    
    # Grouped by product
    # We need to construct the structure including defects
    
    for grade in all_grades:
        grade_defects = [{"id": d.id, "name": d.name} for d in grade.defects]
        
        grade_obj = {
            "id": grade.id,
            "name": grade.name,
            "grade_rank": grade.grade_rank,
            "product_id": grade.product_id,
            "defects": grade_defects
        }
        
        data['grades'].append(grade_obj)
        
        # Add to product specific key
        prod_key = f"grades_{grade.product_id}"
        if prod_key not in data:
            data[prod_key] = []
        data[prod_key].append(grade_obj)

    # 7. Inspections (Historical)
    # Include recent inspections so mobile has history
    # We'll include ALL for now as requested, but be mindful of size.
    inspections = db.query(models.Inspection).all()
    data['inspections'] = []
    
    for insp in inspections:
        # Format results
        results = []
        for res in insp.results:
            results.append({
                "grade_id": res.grade_id,
                "defect_id": res.defect_id,
                "pieces_count": res.pieces_count
            })
            
        data['inspections'].append({
            "id": insp.id, # Keep DB ID for reference, though mobile generates temps
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
            "results": results
        })

    return data

@router.post("/import-inspections")
def import_inspections(payload: Dict[str, Any], db: Session = Depends(database.get_db)):
    """
    Import inspections exported from mobile app.
    Payload: { "version": "1.0", "inspections": [...] }
    """
    inspections_data = payload.get("inspections", [])
    imported_count = 0
    
    for data in inspections_data:
        try:
            # 1. Prepare Base Fields
            # Parse dates
            def _parse_date(val):
                if not val:
                    return datetime.now()
                try:
                    return datetime.fromisoformat(str(val).replace('Z', ''))
                except Exception:
                    pass
                # Handle DD/MM/YYYY format
                try:
                    parts = str(val).strip().split('/')
                    if len(parts) == 3:
                        d, m, y = int(parts[0]), int(parts[1]), int(parts[2])
                        return datetime(y, m, d)
                except Exception:
                    pass
                return datetime.now()

            prod_date = _parse_date(data.get('production_date'))
            insp_date = _parse_date(data.get('date') or data.get('inspection_date') or data.get('production_date'))

            # 2. Determine Model Class
            itype = data.get('type', 'inspection')
            model_class = models.Inspection
            if itype == 'finished_product': model_class = models.FinishedProductInspection
            elif itype == 'line_grading': model_class = models.LineGradingInspection
            elif itype == 'rejection_typing': model_class = models.RejectionTypingInspection
            
            # 3. Create Inspection Instance
            # We explicitly map fields to avoid issues with extra fields or ID collisions
            new_inspection = model_class(
                date=insp_date,
                production_date=prod_date,
                shift=data.get('shift', '-'),
                journey=data.get('journey', '-'),
                supervisor=data.get('supervisor', '-'),
                responsible=data.get('responsible', '-'),
                area=data.get('area', '-'),
                machine=data.get('machine', '-'),
                origin=data.get('origin', '-'),
                lot=data.get('lot', '-'),
                market_id=data.get('market_id'),
                product_name=data.get('product_name', 'Unknown'),
                state=data.get('state', '-'),
                termination=data.get('termination', '-'),
                thickness=str(data.get('thickness', '')),
                width=str(data.get('width', '')),
                length=str(data.get('length', '')),
                pieces_inspected=data.get('pieces_inspected', 0),
                type=itype
            )
            
            db.add(new_inspection)
            db.flush() # Generate ID
            
            # 4. Create Results
            results_data = data.get('results', [])
            for res in results_data:
                new_result = models.InspectionResult(
                    inspection_id=new_inspection.id,
                    grade_id=res.get('grade_id'),
                    defect_id=res.get('defect_id'), # Can be None
                    pieces_count=res.get('pieces_count', 0)
                )
                db.add(new_result)
                
            imported_count += 1
            
        except Exception as e:
            print(f"Error importing inspection: {e}")
            # Continue with next one? or rollback? 
            # For bulk, maybe best to try best effort or fail all. 
            # Let's try best effort but log.
            pass

    db.commit()
    return {"status": "success", "imported": imported_count}

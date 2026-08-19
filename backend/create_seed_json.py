import json
import os
import sys
from datetime import datetime

# Add current dir to path
sys.path.append(os.getcwd())

try:
    from database import database, models
    from sqlalchemy.orm import Session
except ImportError as e:
    print(f"Import Error: {e}")
    sys.exit(1)

# Helper for flushing stdout
def log(msg):
    print(msg)
    sys.stdout.flush()

def get_full_dump_logic(db):
    data = {}
    
    # 1. Catalog Items
    catalog_items = db.query(models.CatalogItem).filter(models.CatalogItem.active == True).all()
    for cat in ['shifts', 'journeys', 'areas', 'machines', 'origins', 'states', 'terminations', 'supervisors', 'lengths', 'estates', 'logging_teams', 'characteristics']:
        data[cat] = []
        
    for item in catalog_items:
        cat_lower = item.category.lower().strip()
        target_key = None
        if 'shift' in cat_lower or 'turno' in cat_lower: target_key = 'shifts'
        elif 'journey' in cat_lower or 'jornada' in cat_lower: target_key = 'journeys'
        elif 'area' in cat_lower: target_key = 'areas'
        elif 'machine' in cat_lower or 'maquina' in cat_lower: target_key = 'machines'
        elif 'origin' in cat_lower or 'origen' in cat_lower: target_key = 'origins'
        elif 'state' in cat_lower or 'estado' in cat_lower: target_key = 'states'
        elif 'term' in cat_lower: target_key = 'terminations'
        elif 'super' in cat_lower: target_key = 'supervisors'
        elif 'len' in cat_lower or 'largo' in cat_lower: target_key = 'lengths'
        elif 'estate' in cat_lower or 'predio' in cat_lower: target_key = 'estates'
        elif 'team' in cat_lower or 'equipo' in cat_lower: target_key = 'logging_teams'
        elif 'char' in cat_lower or 'caract' in cat_lower: target_key = 'characteristics'
        
        if target_key:
            data[target_key].append({
                "id": f"{target_key}_{item.id}",
                "db_id": item.id,
                "name": item.name,
                "category": target_key
            })

    # 2. Products
    products = db.query(models.Product).all()
    data['products'] = [{"id": p.id, "name": p.name} for p in products]

    # 3. Markets
    markets = db.query(models.Market).all()
    data['markets'] = [{"id": m.id, "name": m.name} for m in markets]

    # 4. Defects
    defects = db.query(models.Defect).all()
    data['defects'] = [{"id": d.id, "name": d.name, "description": d.description} for d in defects]

    # 5. Users
    users = db.query(models.User).filter(models.User.is_active == True).all()
    data['users'] = [{
        "username": u.username,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "position": u.position
    } for u in users]

    # 6. Grades
    all_grades = db.query(models.Grade).all()
    data['grades'] = []
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
        prod_key = f"grades_{grade.product_id}"
        if prod_key not in data: data[prod_key] = []
        data[prod_key].append(grade_obj)

    # 7. Inspections
    inspections = db.query(models.Inspection).all()
    data['inspections'] = []
    for insp in inspections:
        results = []
        for res in insp.results:
            results.append({
                "grade_id": res.grade_id,
                "defect_id": res.defect_id,
                "pieces_count": res.pieces_count
            })
        data['inspections'].append({
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
            "results": results,
            "isSynced": True
        })
        
    return data

try:
    log("Starting inline dump process...")
    # Check DB connection
    gen = database.get_db()
    db = next(gen)
    
    log("DB Session acquired. generating data...")
    data = get_full_dump_logic(db)
    
    log(f"Data retrieved: {len(data.get('products', []))} products.")
    
    output_path = os.path.abspath("seed_data.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=str)
        
    log(f"SUCCESS: Created {output_path}")

except Exception as e:
    log(f"CRITICAL ERROR: {e}")
    import traceback
    traceback.print_exc()
finally:
    if 'db' in locals():
        db.close()

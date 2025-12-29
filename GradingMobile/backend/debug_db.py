import sys
import os

# Add current directory to path to allow imports
sys.path.append(os.getcwd())

from database.database import SessionLocal
from database.models import InspectionResult, Inspection

def debug_db():
    db = SessionLocal()
    try:
        print("-" * 50)
        print("DEBUGGING DATABASE CONTENTS")
        print("-" * 50)
        
        # Check Inspections
        inspections = db.query(Inspection).order_by(Inspection.id.desc()).limit(5).all()
        print(f"Found {len(inspections)} recent inspections:")
        for i in inspections:
            print(f"ID: {i.id} | Product: {i.product_name} | Date: {i.date} | Pieces Insp: {i.pieces_inspected}")
            
        print("-" * 50)
        
        # Check Results
        results = db.query(InspectionResult).all()
        print(f"Total Inspection Result Rows: {len(results)}")
        if len(results) > 0:
            print("Last 10 Results:")
            for r in results[-10:]:
                print(f"ResID: {r.id} | InspID: {r.inspection_id} | GradeID: {r.grade_id} | DefectID: {r.defect_id} | Count: {r.pieces_count}")
            sys.stdout.flush()
        else:
            print("NO RESULTS FOUND IN TABLE.")

        print("-" * 50)
        sys.stdout.flush()
    except Exception as e:
        print(f"Error checking DB: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    debug_db()

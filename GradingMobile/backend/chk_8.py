import sys
import os
sys.path.append(os.getcwd())
from database.database import SessionLocal
from database.models import InspectionResult

def check_insp_8():
    db = SessionLocal()
    try:
        results = db.query(InspectionResult).filter(InspectionResult.inspection_id == 8).all()
        print(f"Results for Insp ID 8: {len(results)}")
        for r in results:
            print(f"R: {r.id} G: {r.grade_id} D: {r.defect_id} C: {r.pieces_count}")
        sys.stdout.flush()
    except Exception as e:
        print(e)
    finally:
        db.close()

if __name__ == "__main__":
    check_insp_8()

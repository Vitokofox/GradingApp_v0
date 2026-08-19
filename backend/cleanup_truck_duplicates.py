from database.database import SessionLocal
from database import models

def clean_duplicates():
    db = SessionLocal()
    try:
        # Get all entries grouped by guide and characteristic
        # This is a simple cleanup: it keeps the first one found for each pair
        all_studies = db.query(models.TruckStudy).all()
        seen = set()
        deleted_count = 0
        
        for study in all_studies:
            key = (study.guide_number, study.characteristic)
            if key in seen:
                db.delete(study)
                deleted_count += 1
            else:
                seen.add(key)
        
        db.commit()
        print(f"Limpieza completada. Se eliminaron {deleted_count} registros duplicados.")
    except Exception as e:
        print(f"Error durante la limpieza: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    clean_duplicates()

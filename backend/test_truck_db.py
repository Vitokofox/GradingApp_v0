from database.database import SessionLocal
from database import models
from datetime import datetime

def test_db():
    db = SessionLocal()
    try:
        # Check if we can query the table
        count = db.query(models.TruckStudy).count()
        print(f"Current truck studies count: {count}")
        
        # Try a test insert
        test_study = models.TruckStudy(
            reception_date=datetime.now().date(),
            cutting_date=datetime.now().date(),
            guide_number="TEST",
            estate="TEST",
            characteristic="TEST",
            logging_team="TEST",
            quantity=1.0,
            responsible="TEST"
        )
        db.add(test_study)
        db.commit()
        print("Test insert successful")
        db.delete(test_study)
        db.commit()
        print("Test delete successful")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    test_db()

from backend.database import database, models
from sqlalchemy.orm import Session

def seed_db():
    db = database.SessionLocal()
    try:
        # Create Tables
        models.Base.metadata.create_all(bind=database.engine)
        
        # Check if data exists
        if db.query(models.Market).first():
            print("Database already seeded.")
            return

        print("Seeding Markets and Grades...")
        
        # China Hierarchy
        china = models.Market(name="CHINA")
        db.add(china)
        db.commit() # Commit to get ID
        
        china_grades = [
            models.Grade(market_id=china.id, name="COL", rank=1),
            models.Grade(market_id=china.id, name="COB", rank=2),
            models.Grade(market_id=china.id, name="COP", rank=3),
            models.Grade(market_id=china.id, name="Rechazo", rank=4),
        ]
        db.add_all(china_grades)

        # America Latina Hierarchy
        latam = models.Market(name="AMERICA LATINA")
        db.add(latam)
        db.commit()
        
        latam_grades = [
            models.Grade(market_id=latam.id, name="FG-4", rank=1),
            models.Grade(market_id=latam.id, name="FG-5", rank=2),
            models.Grade(market_id=latam.id, name="MLR", rank=3),
            models.Grade(market_id=latam.id, name="Rechazo", rank=4),
        ]
        db.add_all(latam_grades)

        # RIP Hierarchy
        rip = models.Market(name="RIP")
        db.add(rip)
        db.commit()
        
        rip_grades = [
            models.Grade(market_id=rip.id, name="RIP 3 Y +", rank=1),
            models.Grade(market_id=rip.id, name="RIP 4", rank=2),
            models.Grade(market_id=rip.id, name="RIP 25%", rank=3),
            models.Grade(market_id=rip.id, name="COP", rank=4),
            models.Grade(market_id=rip.id, name="Rechazo", rank=5),
        ]
        db.add_all(rip_grades)

        db.commit()
        print("Seeding Complete!")
        
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()

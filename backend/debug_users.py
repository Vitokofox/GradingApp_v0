from database.database import SessionLocal
from database import models
from sqlalchemy.orm import Session

def debug_users():
    db = SessionLocal()
    try:
        users = db.query(models.User).all()
        print(f"Found {len(users)} users.")
        for u in users:
            print(f"ID: {u.id}, Username: {u.username}, Level: {u.level}, Process: {u.process_type}, Name: {u.first_name} {u.last_name}, Position: {u.position}")
    finally:
        db.close()

if __name__ == "__main__":
    debug_users()

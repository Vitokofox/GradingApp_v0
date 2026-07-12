from backend.database.database import SessionLocal
from backend.database import models
from backend.services.auth_service import auth_service
import sys

def create_debug_user():
    db = SessionLocal()
    username = "debug_test"
    password = "password123"
    
    # Check if exists
    existing = db.query(models.User).filter(models.User.username == username).first()
    if existing:
        db.delete(existing)
        db.commit()
    
    hashed = auth_service.get_password_hash(password)
    user = models.User(
        username=username, 
        password_hash=hashed,
        first_name="Debug",
        last_name="User",
        position="Tester",
        level="admin",
        process_type="Verde",
        is_active=True
    )
    db.add(user)
    db.commit()
    print(f"User {username} created in active DB config.")
    db.close()

if __name__ == "__main__":
    create_debug_user()

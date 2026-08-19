from database import database, models
from services.auth_service import auth_service
import sys

db = database.SessionLocal()

def reset_password(username, new_password):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        print(f"User {username} not found")
        return

    print(f"Resetting password for {username}...")
    # Generate new hash using the CURRENT auth_service (which uses raw bcrypt)
    new_hash = auth_service.get_password_hash(new_password)
    
    user.password_hash = new_hash
    db.commit()
    print(f"Password for '{username}' has been reset to '{new_password}'")
    print(f"New Hash: {new_hash}")

if __name__ == "__main__":
    reset_password("admin", "admin")
    db.close()

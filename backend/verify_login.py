from services.auth_service import auth_service
from database import database, models

def verify_login(username, password):
    db = database.SessionLocal()
    user = db.query(models.User).filter(models.User.username == username).first()
    db.close()
    
    if not user:
        print(f"User {username} not found")
        return False
        
    print(f"User found: {user.username}")
    print(f"Stored hash: {user.password_hash}")
    
    is_valid = auth_service.verify_password(password, user.password_hash)
    if is_valid:
        print("LOGIN SUCCESSFUL!")
    else:
        print("LOGIN FAILED - Password mismatch")
    return is_valid

if __name__ == "__main__":
    verify_login("admin", "admin")

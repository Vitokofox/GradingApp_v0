import sys
import os
import requests
# Add directory to path to allow imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config import settings
from database.database import SessionLocal
from database import models
from services.auth_service import auth_service

def diagnose():
    print("--- DIAGNOSTIC START ---")
    
    # 1. Print Configured DB Path
    print(f"Database directory: {settings.DATABASE_DIR}")
    print(f"Database path: {settings.DATABASE_PATH}")
    print(f"Configured DATABASE_URL: {settings.DATABASE_URL}")
    
    # 2. Check if file exists
    if "sqlite:///" in settings.DATABASE_URL:
        db_path = settings.DATABASE_PATH
        if os.path.exists(db_path):
            print(f"Database file FOUND at: {db_path}")
            print(f"Size: {os.path.getsize(db_path)} bytes")
        else:
            print(f"CRITICAL: Database file NOT FOUND at: {db_path}")
    
    # 3. Check Admin User in DB
    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.username == "admin").first()
        if not user:
            print("CRITICAL: User 'admin' NOT FOUND in database.")
            # Create it
            print("Creating admin user...")
            hashed = auth_service.get_password_hash("admin")
            user = models.User(
                username="admin", 
                password_hash=hashed,
                first_name="Admin",
                last_name="System",
                position="Administrador",
                level="admin",
                process_type="Verde",
                is_active=True
            )
            db.add(user)
            db.commit()
            print("Admin user created.")
        else:
            print(f"User 'admin' found. ID: {user.id}")
            print(f"Current Hash prefix: {user.password_hash[:10]}...")
            
            # Reset password to be 100% sure
            print("Resetting password to 'admin'...")
            new_hash = auth_service.get_password_hash("admin")
            user.password_hash = new_hash
            user.is_active = True
            db.commit()
            print("Password reset and is_active=True forced.")
            
            # Verify locally
            if auth_service.verify_password("admin", user.password_hash):
                print("Local password verification: SUCCESS")
            else:
                print("Local password verification: FAILED (This should be impossible after reset)")

    except Exception as e:
        print(f"Database Error: {e}")
    finally:
        db.close()

    # 4. Test API
    print("\n--- API CONN CHECK ---")
    url = "http://localhost:8000/token"
    # Using data dict acts as form-urlencoded
    payload = {"username": "admin", "password": "admin"}
    
    try:
        print(f"POSTing to {url}...")
        resp = requests.post(url, data=payload, timeout=2)
        print(f"Status Code: {resp.status_code}")
        if resp.status_code == 200:
            print("API Login: SUCCESS")
            print(resp.json())
        else:
            print("API Login: FAILED")
            print(resp.text)
            
            if resp.status_code == 401:
                print("\nANALYSIS: API is rejecting credentials that WORK locally.")
                print("POSSIBLE CAUSES:")
                print("1. API is running from a different directory/config and using a DIFFERENT database file.")
                print("2. API process needs restart to pick up config/DB changes.")
                
    except Exception as e:
        print(f"Could not connect to API: {e}")
        print("Ensure the backend server is running.")

    print("--- DIAGNOSTIC END ---")

if __name__ == "__main__":
    diagnose()

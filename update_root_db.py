from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
# from backend.models import User
import sys
import os
import bcrypt

# Add backend to sys.path to import models if needed, but models might depend on database.py which depends on config... 
# which I just changed. 
# So importing models might trigger the NEW config.
# I will define the User model locally or use raw SQL to avoid dependency hell with the config I just changed.

import sqlite3
from backend.database_config import resolve_database_path

def reset_admin_root_db():
    db_path = resolve_database_path()
    if not db_path.is_file():
        print(f"Root DB {db_path} not found.")
        return

    print(f"Connecting to {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    username = "admin"
    password = "admin"
    
    # Geneate hash - using the same logic as auth_service
    # bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    # Check if user exists
    cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()

    if user:
        print(f"Updating password for {username}...")
        cursor.execute("UPDATE users SET password_hash = ? WHERE username = ?", (hashed_password, username))
    else:
        print(f"User {username} not found in root DB. Creating...")
        # We'd need to know all columns to insert. Simplest is to hope it exists or try insert with defaults if possible.
        # Let's assume it exists for now as it's a seed issue usually.
        # If it doesn't exist, I'll print a warning.
        print("Warning: Admin user not found. Cannot update locally without full schema knowledge.")

    conn.commit()
    conn.close()
    print("Root DB updated.")

if __name__ == "__main__":
    reset_admin_root_db()

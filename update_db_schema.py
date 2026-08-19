
import sqlite3
import os

# Correct path relative to project root
db_path = "backend/grading.db"

if not os.path.exists(db_path):
    print(f"WARNING: DB file not found at {db_path}. Checking current directory...")
    if os.path.exists("grading.db"):
        db_path = "grading.db"
    else:
        print("ERROR: Could not find grading.db")
        exit(1)

print(f"Using database: {db_path}")

def add_column_if_not_exists(cursor, table, column, col_type):
    try:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
        print(f"Added column {column} to {table}")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print(f"Column {column} already exists in {table}")
        else:
            print(f"Error adding {column} to {table}: {e}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # New Columns for ScannerStep (Defaults)
    columns_steps = [
        ("default_thickness", "FLOAT"),
        ("default_width", "FLOAT"),
        ("default_length", "FLOAT")
    ]
    
    print("Updating ScannerStep schema...")
    for col_name, col_type in columns_steps:
        add_column_if_not_exists(cursor, "scanner_steps", col_name, col_type)

    # New Columns for ScannerItem (Dimensions)
    columns_items = [
         ("thickness", "FLOAT"),
         ("width", "FLOAT"),
         ("length", "FLOAT")
    ]
    print("Updating ScannerItem schema...")
    for col_name, col_type in columns_items:
        add_column_if_not_exists(cursor, "scanner_items", col_name, col_type)
        
    conn.commit()
    conn.close()
    print("Database structure updated successfully.")
    
except Exception as e:
    print(f"Critical Error: {e}")

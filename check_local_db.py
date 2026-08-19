import sqlite3
import os

db_path = "grading.db"
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    try:
        c.execute("SELECT * FROM catalog_items LIMIT 5;")
        print("Catalog Items (Local):", c.fetchall())
        c.execute("SELECT DISTINCT category FROM catalog_items;")
        print("Categories (Local):", c.fetchall())
    except Exception as e:
        print(f"Error querying table: {e}")
    conn.close()
else:
    print(f"Local {db_path} not found.")

import sqlite3
from backend.database_config import resolve_database_path

db_path = resolve_database_path()
if db_path.is_file():
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
    print(f"Configured database {db_path} not found.")

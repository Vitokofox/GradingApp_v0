import sqlite3
import os

db_path = 'backend/grading.db'
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("Tables:")
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
for t in tables:
    print(f"- {t[0]}")
    cursor.execute(f"PRAGMA table_info({t[0]})")
    cols = cursor.fetchall()
    for c in cols:
        print(f"  - {c[1]} ({c[2]})")

conn.close()

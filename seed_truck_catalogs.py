import sqlite3
import os

def seed_truck_catalogs(db_path):
    if not os.path.exists(db_path):
        print(f"Database {db_path} not found.")
        return

    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    
    # Ensure items exist for 'estate', 'logging_team' and 'characteristic'
    items = [
        ('estate', 'PREDIO EJEMPLO 1'),
        ('estate', 'PREDIO EJEMPLO 2'),
        ('logging_team', 'EQUIPO MADERERO 1'),
        ('logging_team', 'EQUIPO MADERERO 2'),
        ('characteristic', 'NUDOS FUERA RANGO'),
        ('characteristic', 'GRIETAS'),
        ('characteristic', 'DIAMETRO PEQUENO'),
        ('characteristic', 'LARGO INCORRECTO'),
        ('characteristic', 'MANCHA AZUL'),
        ('characteristic', 'PUDRICION'),
        # Adding common ones for desktop too if missing
        ('area', 'ASERRADERO'),
        ('shift', 'A'),
        ('shift', 'B'),
        ('shift', 'C'),
        ('supervisor', 'ADMINISTRADOR')
    ]
    
    try:
        # Check if table exists
        c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='catalog_items';")
        if not c.fetchone():
            print("Table catalog_items does not exist yet. Please run the app first.")
            return

        for cat, name in items:
            c.execute("SELECT id FROM catalog_items WHERE category=? AND name=?", (cat, name))
            if not c.fetchone():
                print(f"Seeding {cat}: {name}")
                c.execute("INSERT INTO catalog_items (category, name, active) VALUES (?, ?, 1)", (cat, name))
        
        conn.commit()
        print("Truck catalogs seeded successfully.")
    except Exception as e:
        print(f"Error seeding: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    # Check both current folder and backend/database
    paths = ["grading.db", "backend/database/grading.db"]
    for p in paths:
        if os.path.exists(p):
            print(f"Found DB at {p}")
            seed_truck_catalogs(p)

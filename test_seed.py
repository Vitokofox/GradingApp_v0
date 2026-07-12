import os
import sys
# Add backend to path
sys.path.append(os.path.abspath("backend"))

from backend.database import database, models
db = database.SessionLocal()

try:
    print("Checking catalog items for 'estate'...")
    if not db.query(models.CatalogItem).filter(models.CatalogItem.category == 'estate').first():
        print("Seeding initial Truck Study catalogs...")
        basic_items = [
            ('estate', 'PREDIO EJEMPLO 1'),
            ('estate', 'PREDIO EJEMPLO 2'),
            ('logging_team', 'EQUIPO MADERERO 1'),
            ('logging_team', 'EQUIPO TRABAJO 2'),
            ('characteristic', 'NUDOS FUERA DE NORMA'),
            ('characteristic', 'GRIETAS / RAJADURAS'),
            ('characteristic', 'MANCHA AZUL'),
            ('characteristic', 'DIAMETRO PEQUENO'),
            ('area', 'ASERRADERO'),
            ('area', 'CEPILLADO'),
            ('shift', 'A'),
            ('shift', 'B'),
            ('shift', 'C'),
            ('supervisor', 'ADMINISTRADOR'),
            ('termination', 'SIN TERMINAR'),
            ('termination', 'TERMINADO'),
            ('state', 'PLANIFICADO'),
            ('state', 'PROCESADO'),
            ('origin', 'INTERNO'),
            ('origin', 'EXTERNO'),
            ('journey', 'DIA'),
            ('journey', 'NOCHE')
        ]
        
        for cat, name in basic_items:
            if not db.query(models.CatalogItem).filter(models.CatalogItem.category == cat, models.CatalogItem.name == name).first():
                db.add(models.CatalogItem(category=cat, name=name, active=True))
        db.commit()
        print("Initial catalogs seeded.")
    else:
        print("Catalogs already exist.")
except Exception as e:
    print(f"Error: {e}")
finally:
    db.close()

from sqlalchemy.orm import Session
from database.database import SessionLocal, engine
from database import models

def seed_data():
    db = SessionLocal()
    
    # Listas de datos
    defects = [
        "Doble Curva", "Grieta Cabezal", "Esporas", "Mancha Azul", 
        "Mal desrame", "Sin defecto", "Astillamiento", "Hendidura", 
        "Peca Crítica", "Corona de Nudos", "Nudo insertado", 
        "Nudo sobre diámetro", "Daño cosechador", "Daño operacional", 
        "Curvatura", "Bajo diametro"
    ]
    
    equipos = [
        "5206", "FA13", "HT27", "BF01", "BF02", "S207", "S24", "HT18", 
        "T160", "T126", "5207", "5205", "T144", "S132", "P92", "T183", 
        "HT-18", "BF-01", "G 206", "FA-07", "S205", "G206", "G207", 
        "T177", "CF-74", "S196", "S206", "F-179", "HT21", "MT25"
    ]
    
    predios = [
        "NEBLINTO - NORTE", "SAN AGUSTIN - NORTE", "EL RAULI - NORTE", 
        "CHIPRE- 3 NORTE", "MONTENEGRO L-1 NORTE", "LAS LUMAS- NORTE", 
        "MONTE RICO -NORTE", "MONOLO - NORTE", "CAYURRANQUIL- NORTE", 
        "CUCHA-CHUCHA- NORTE", "LOS QUENES-NORTE", "COIGOS-NORTE", 
        "EL LLEQUEN", "RANQUIL ACOPIO - NORTE", "QUINIHUAO P-3- NORTE", 
        "MONTANA BUSTAMANTE-NORTE", "QUINIHUAO -P- 4- NORTE", 
        "LOS QUIÑES - NORTE", "QUINIHUAO -P-3- NORTE", "DE BOYEN", 
        "AGUA SANTA- NORTE", "SAN JOSE BOYEN - NORTE", "CUCHA CUCHA - NORTE", 
        "QUINIHUAO P-5- NORTE", "EL CACIQUE FBB-NORTE", "VALLE HERMOZO-NORTE", 
        "CUCHA - CUCHA", "EL RECUERDO- NORTE", "SAN JUAN BULANCO-NORTE", 
        "HUINGANAL - CHILLAN"
    ]

    try:
        # Seed Characteristics (Defectos)
        for d in defects:
            exists = db.query(models.CatalogItem).filter_by(category="characteristic", name=d).first()
            if not exists:
                db.add(models.CatalogItem(category="characteristic", name=d))
        
        # Seed Logging Teams (Equipos)
        for e in equipos:
            exists = db.query(models.CatalogItem).filter_by(category="logging_team", name=e).first()
            if not exists:
                db.add(models.CatalogItem(category="logging_team", name=e))
                
        # Seed Estates (Predios)
        for p in predios:
            exists = db.query(models.CatalogItem).filter_by(category="estate", name=p).first()
            if not exists:
                db.add(models.CatalogItem(category="estate", name=p))
        
        db.commit()
        print("Datos del Estudio Camión cargados exitosamente.")
        
    except Exception as ex:
        print(f"Error al cargar datos: {ex}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()

from database.database import engine
from database import models
from sqlalchemy import text

def update_schema():
    print("Actualizando esquema para Truck Study...")
    with engine.connect() as conn:
        # Drop dependent table first
        conn.execute(text("DROP TABLE IF EXISTS truck_study_defects"))
        # Drop main table
        conn.execute(text("DROP TABLE IF EXISTS truck_studies"))
        conn.commit()
    
    # Recreate all tables (this will recreate the ones we just dropped with the new schema)
    models.Base.metadata.create_all(bind=engine)
    print("Esquema actualizado exitosamente.")

if __name__ == "__main__":
    update_schema()

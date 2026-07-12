from database.database import engine
from database import models

def init_db():
    print("Iniciando creación de tablas...")
    models.Base.metadata.create_all(bind=engine)
    print("Tablas creadas/verificadas exitosamente.")

if __name__ == "__main__":
    init_db()

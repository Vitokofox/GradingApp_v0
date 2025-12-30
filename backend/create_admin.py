from database import database, models
from database import database, models
from services.auth_service import auth_service
from sqlalchemy.orm import Session

# Crear sesión manualmente
db = database.SessionLocal()

def create_admin_user():
    username = "admin"
    password = "admin"
    
    # Verificar si ya existe
    existing_user = db.query(models.User).filter(models.User.username == username).first()
    if existing_user:
        print(f"El usuario '{username}' ya existe.")
        return

    hashed_password = auth_service.get_password_hash(password)
    
    admin_user = models.User(
        username=username,
        password_hash=hashed_password,
        first_name="Admin",
        last_name="System",
        position="Administrador",
        level="admin",
        process_type="Verde", # Valor por defecto
        is_active=True
    )
    
    db.add(admin_user)
    db.commit()
    print(f"Usuario '{username}' creado exitosamente con privilegios de administrador.")

if __name__ == "__main__":
    try:
        create_admin_user()
    except Exception as e:
        print(f"Error al crear usuario admin: {e}")
    finally:
        db.close()

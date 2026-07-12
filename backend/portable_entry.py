import uvicorn
import os
import sys
import multiprocessing

# Verify if running as a PyInstaller bundle
def get_resource_path(relative_path):
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.abspath("."), relative_path)

if __name__ == "__main__":
    # Fix for multiprocessing (Windows specific for PyInstaller)
    multiprocessing.freeze_support()
    
    # Needs to import app AFTER environment path fix if we needed to patch paths, 
    # but here we just run it. 
    # However, 'main:app' string reference searches PYTHONPATH.
    # In frozen mode, source files are not in a standard layout.
    # We should import the app object directly.
    
    # Add current dir to sys.path so we can import 'main'
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))

    from main import app
    
    # Logic to adjust static mounts if frozen
    # In main.py we used "../frontend/dist". In frozen mode, assets are usually bundled INSIDE via --add-data.
    # We can patch the static mounts or the app state here, but modifying main.py to be dynamic is better.
    # Let's re-run main.py modification to be dynamic? 
    # Actually, simpler: we bundle 'frontend/dist' into 'static' in the temp dir.
    
    # BUT, main.py hardcodes "../frontend/dist".
    # Let's overwrite the mount in app.routes or similar if possible.
    # OR, we change main.py to check an env var or a function.
    
    # Let's keep it simple: We will ensure the 'dist' folder results in the expected relative path location,
    # OR we patch main.py to look at a variable location.
    
    from fastapi.staticfiles import StaticFiles
    
    # Detect frozen "dist" location
    if hasattr(sys, '_MEIPASS'):
        static_dir = os.path.join(sys._MEIPASS, "frontend_dist")
        # Remount /assets
        pass

    # --- Ensure Admin User and Basic Catalogs Exist ---
    try:
        from database import database, models
        from services.auth_service import auth_service
        
        db = database.SessionLocal()
        
        # 1. Admin User
        username = "admin"
        existing_user = db.query(models.User).filter(models.User.username == username).first()
        if not existing_user:
            print(f"Creating default admin user: {username}")
            hashed_password = auth_service.get_password_hash("admin")
            admin_user = models.User(
                username=username,
                password_hash=hashed_password,
                first_name="Admin",
                last_name="System",
                position="Administrador",
                level="admin",
                process_type="Verde",
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            print("Default admin user created.")
        
        # 2. Basic Catalogs for Truck Study and common navigation
        # Check if any catalog items exist for 'estate'
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
                # Double check to avoid duplicates if re-running
                if not db.query(models.CatalogItem).filter(models.CatalogItem.category == cat, models.CatalogItem.name == name).first():
                    db.add(models.CatalogItem(category=cat, name=name, active=True))
            db.commit()
            print("Initial catalogs seeded.")

        db.close()
    except Exception as e:
        print(f"Error ensuring initial data: {e}")
    # -------------------------------

    print("Starting Portable Grading App (Main Backend) on port 8000...")
    print("Starting Mobile Bridge Backend on port 8080...")
    
    import threading

    def run_main():
        uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")

    def run_mobile():
        uvicorn.run(app, host="0.0.0.0", port=8080, log_level="info")

    t1 = threading.Thread(target=run_mobile, daemon=True)
    t1.start()

    run_main()


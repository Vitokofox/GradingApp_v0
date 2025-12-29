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

    # --- Ensure Admin User Exists ---
    try:
        from database import database, models
        from routers.auth import get_password_hash
        
        db = database.SessionLocal()
        username = "admin"
        existing_user = db.query(models.User).filter(models.User.username == username).first()
        if not existing_user:
            print(f"Creating default admin user: {username}")
            hashed_password = get_password_hash("admin")
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
        db.close()
    except Exception as e:
        print(f"Error ensuring admin user: {e}")
    # -------------------------------

    print("Starting Portable Grading App...")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")


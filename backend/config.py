import os
import sys
from dotenv import load_dotenv
from app_paths import APP_ROOT, FROZEN

# Detect Base Directory
# If frozen (PyInstaller), use the directory of the executable.
# If dev, use the directory of this file.
if FROZEN:
    BASE_DIR = str(APP_ROOT)
    # Allow override with external .env
    load_dotenv(os.path.join(BASE_DIR, ".env"), override=True)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    # Load .env file from the base directory
    load_dotenv(os.path.join(BASE_DIR, ".env"))

class Settings:
    BASE_DIR: str = BASE_DIR

    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "changeme_in_production_please")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 300))

    # Database
    # We allow specifying a raw path in DATABASE_PATH for easier config
    _db_path = os.getenv("DATABASE_PATH")
    _configured_url = os.getenv("DATABASE_URL")
    
    # Logic for hybrid connection (Remote / Local Fallback)
    def _get_final_url(self):
        primary_url = None
        if self._db_path:
            db_path = self._db_path
            if not db_path.startswith(("sqlite:", "//")) and not os.path.isabs(db_path):
                db_path = os.path.join(BASE_DIR, db_path)
            primary_url = f"sqlite:///{db_path}" if not db_path.startswith("sqlite:") else db_path
        elif self._configured_url:
            primary_url = self._configured_url
            
        local_db = os.path.join(BASE_DIR, "grading.db")
        legacy_db = os.path.join(BASE_DIR, "database", "grading.db")
        # Preserve the existing database location. Only the primary path is
        # created later by SQLAlchemy when neither location exists.
        local_fallback = f"sqlite:///{local_db if os.path.exists(local_db) or not os.path.exists(legacy_db) else legacy_db}"
        
        if primary_url:
            # Extract the raw file path from the sqlite URL
            # Handles both sqlite:///path and sqlite:////path
            raw_path = primary_url.replace("sqlite:///", "").replace("sqlite://", "")
            
            # Check if the path or its parent directory exists
            # (If it's a network path or a different user's folder that doesn't exist, this returns False)
            if os.path.exists(raw_path) or os.path.exists(os.path.dirname(raw_path)):
                return primary_url
            else:
                print(f"INFO: Database path '{raw_path}' not reachable. Falling back to local: {local_fallback}")
                return local_fallback
        
        return local_fallback

    # Use property/attribute to store the final resolved URL
    def __init__(self):
        self.DATABASE_URL = self._get_final_url()

    # Directories
    LOG_DIR = os.path.join(BASE_DIR, "logs")
    os.makedirs(LOG_DIR, exist_ok=True)

    # CORS
    CORS_ORIGINS: list = os.getenv("CORS_ORIGINS", "*").split(",")

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FILE: str = os.path.join(LOG_DIR, "app.log")
    LOG_ROTATION: str = os.getenv("LOG_ROTATION", "10 MB")

settings = Settings()

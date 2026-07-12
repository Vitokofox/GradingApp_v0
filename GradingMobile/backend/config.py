import os
import sys
from dotenv import load_dotenv

# Detect Base Directory
# If frozen (PyInstaller), use the directory of the executable.
# If dev, use the directory of this file.
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Load .env file from the base directory
load_dotenv(os.path.join(BASE_DIR, ".env"))

class Settings:
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "changeme_in_production_please")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 43200)) # Default 30 days for mobile

    # Database
    # We allow specifying a raw path in DATABASE_PATH for easier config
    _db_path = os.getenv("DATABASE_PATH")
    if _db_path:
        # If it's just a path, prefix with sqlite:///
        if not _db_path.startswith("sqlite:"):
             DATABASE_URL: str = f"sqlite:///{_db_path}"
        else:
             DATABASE_URL: str = _db_path
    else:
        # Default to local grading.db in the BASE_DIR
        DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{os.path.join(BASE_DIR, 'grading.db')}")

    # Paths
    BASE_DIR: str = BASE_DIR
    
    # CORS
    CORS_ORIGINS: list = os.getenv("CORS_ORIGINS", "*").split(",")

settings = Settings()

import os
from pathlib import Path
from dotenv import load_dotenv
from app_paths import APP_ROOT, FROZEN
from database_config import get_database_config, resolve_primary_database_dir

# Detect Base Directory
# If frozen (PyInstaller), use the directory of the executable.
# If dev, use the directory of this file.
if FROZEN:
    BASE_DIR = APP_ROOT
    # Allow override with external .env
    load_dotenv(BASE_DIR / ".env", override=True)
else:
    BASE_DIR = Path(__file__).resolve().parent
    # Load .env file from the base directory
    load_dotenv(BASE_DIR / ".env")

class Settings:
    BASE_DIR: Path = BASE_DIR

    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "changeme_in_production_please")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 300))

    def __init__(self):
        self.DATABASE_PRIMARY_DIR = resolve_primary_database_dir()
        self.DATABASE_DIR, self.DATABASE_PATH, self.DATABASE_URL = get_database_config()
        self.DATABASE_USING_FALLBACK = self.DATABASE_DIR != self.DATABASE_PRIMARY_DIR

    # Directories
    LOG_DIR = BASE_DIR / "logs"
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    # CORS
    CORS_ORIGINS: list = os.getenv("CORS_ORIGINS", "*").split(",")

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FILE: Path = LOG_DIR / "app.log"
    LOG_ROTATION: str = os.getenv("LOG_ROTATION", "10 MB")

settings = Settings()

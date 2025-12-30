import os
from dotenv import load_dotenv

# Load .env file
load_dotenv()

class Settings:
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "changeme_in_production_please")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 300))

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./grading.db")

    # CORS
    CORS_ORIGINS: list = os.getenv("CORS_ORIGINS", "*").split(",")

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FILE: str = os.getenv("LOG_FILE", "logs/app.log")
    LOG_ROTATION: str = os.getenv("LOG_ROTATION", "10 MB")

settings = Settings()

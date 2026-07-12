from database import database, models
import sys

# Asegurar creación de tablas
print("Creating tables for Broken Pieces Study...")
models.Base.metadata.create_all(bind=database.engine)
print("Tables created (if not existed).")

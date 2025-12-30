from fastapi import FastAPI, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import models, database
from routers import registry, auth, users, master_data, scanner, exports
from config import settings
from loguru import logger
import sys

# Configure Logging
logger.remove()
logger.add(sys.stderr, level=settings.LOG_LEVEL)
logger.add(settings.LOG_FILE, rotation=settings.LOG_ROTATION, level=settings.LOG_LEVEL, compression="zip")

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Grading App Backend")

# Configuración CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(registry.router)
app.include_router(master_data.router)
app.include_router(scanner.router)
app.include_router(exports.router)


import sys

# Determinar ruta de archivos estáticos (Dev vs Congelado)
if hasattr(sys, '_MEIPASS'):
    # Directorio temporal de PyInstaller
    static_dir = os.path.join(sys._MEIPASS, "frontend_dist")
else:
    # Desarrollo local
    static_dir = os.path.join(os.path.dirname(__file__), "../frontend/dist")

if not os.path.exists(static_dir):
    print(f"WARNING: Static directory not found at {static_dir}")
    # Respaldo para evitar cierre, aunque la UI no funcionará
    os.makedirs(static_dir, exist_ok=True)

@app.get("/")
def read_root():
    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "UI not found. Please build frontend."}

# Montar archivos estáticos (JS, CSS, imágenes)
# Verificar si el directorio assets existe para evitar errores
assets_dir = os.path.join(static_dir, "assets")
if os.path.exists(assets_dir):
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

# Capturar todo para React Router (SPA) - debe ir al final
@app.get("/{full_path:path}")
async def serve_react_app(full_path: str):
    # Verificar si el archivo existe en dist (ej. favicon.ico, manifest.json)
    file_path = os.path.join(static_dir, full_path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
    # De lo contrario retornar index.html para enrutamiento del lado del cliente
    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"error": "File not found"}



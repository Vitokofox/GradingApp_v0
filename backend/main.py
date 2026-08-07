from fastapi import FastAPI, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import models, database
from routers import registry, auth, users, master_data, scanner, exports, broken_pieces, log_inspections, data_sync, reports, truck_studies, siniestrada_studies, ia_documental, rollizos, moisture
from config import settings
from loguru import logger
import sys
from services.rag_service import rag_service

# Configure Logging
logger.remove()
logger.add(sys.stderr, level=settings.LOG_LEVEL)
logger.add(settings.LOG_FILE, rotation=settings.LOG_ROTATION, level=settings.LOG_LEVEL, compression="zip")

models.Base.metadata.create_all(bind=database.engine)

# Migración simple: agregar columna 'process' a la tabla 'inspections' si no existe
from sqlalchemy import text
db_session = database.SessionLocal()
try:
    db_session.execute(text("ALTER TABLE inspections ADD COLUMN process VARCHAR"))
    db_session.commit()
    logger.info("Migración: Columna 'process' agregada exitosamente a la tabla 'inspections'.")
except Exception:
    db_session.rollback()
finally:
    db_session.close()

app = FastAPI(title="Grading App Backend")


@app.on_event("startup")
def warmup_ia_documental() -> None:
    try:
        rag_service.warmup()
    except Exception as exc:
        logger.warning(f"IA documental: startup parcial ({exc})")

# Configuración CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(master_data.router)
app.include_router(users.router)
app.include_router(registry.router)
app.include_router(scanner.router)
app.include_router(log_inspections.router)
app.include_router(broken_pieces.router)
app.include_router(exports.router)
app.include_router(data_sync.router)
app.include_router(reports.router)
app.include_router(truck_studies.router)
app.include_router(siniestrada_studies.router)
app.include_router(ia_documental.router)
app.include_router(rollizos.router)
app.include_router(moisture.router)



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

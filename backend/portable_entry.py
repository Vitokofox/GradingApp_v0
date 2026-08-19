"""Punto de entrada de la distribución autocontenida de GradingApp."""

import argparse
import multiprocessing
import os
from pathlib import Path
import sys

from app_paths import APP_ROOT, FROZEN, resource_path


def run_migrations() -> None:
    """Actualiza la base local antes de importar y arrancar FastAPI."""
    from alembic import command
    from alembic.config import Config

    ini_path = resource_path("alembic.ini")
    script_path = resource_path("alembic")
    if not ini_path.is_file() or not script_path.is_dir():
        raise RuntimeError(f"No se encontraron recursos Alembic en {ini_path.parent}")
    config = Config(str(ini_path))
    config.set_main_option("script_location", str(script_path))
    command.upgrade(config, "head")


def ensure_initial_data() -> None:
    """Crea únicamente los datos mínimos de una instalación nueva."""
    from database import database, models
    from services.auth_service import auth_service

    db = database.SessionLocal()
    try:
        username = "admin"
        if not db.query(models.User).filter(models.User.username == username).first():
            db.add(models.User(
                username=username,
                password_hash=auth_service.get_password_hash("admin"),
                first_name="Admin", last_name="System", position="Administrador",
                level="admin", process_type="Verde", is_active=True,
            ))
        basic_items = [
            ("estate", "PREDIO EJEMPLO 1"), ("estate", "PREDIO EJEMPLO 2"),
            ("logging_team", "EQUIPO MADERERO 1"), ("logging_team", "EQUIPO TRABAJO 2"),
            ("characteristic", "NUDOS FUERA DE NORMA"),
            ("characteristic", "GRIETAS / RAJADURAS"),
            ("characteristic", "MANCHA AZUL"), ("characteristic", "DIAMETRO PEQUENO"),
            ("area", "ASERRADERO"), ("area", "CEPILLADO"),
            ("shift", "A"), ("shift", "B"), ("shift", "C"),
            ("supervisor", "ADMINISTRADOR"),
            ("termination", "SIN TERMINAR"), ("termination", "TERMINADO"),
            ("state", "PLANIFICADO"), ("state", "PROCESADO"),
            ("origin", "INTERNO"), ("origin", "EXTERNO"),
            ("journey", "DIA"), ("journey", "NOCHE"),
        ]
        for category, name in basic_items:
            exists = db.query(models.CatalogItem).filter(
                models.CatalogItem.category == category,
                models.CatalogItem.name == name,
            ).first()
            if not exists:
                db.add(models.CatalogItem(category=category, name=name, active=True))
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def smoke_test() -> None:
    """Valida imports y recursos críticos sin abrir puertos ni hardware serial."""
    import faiss  # noqa: F401
    import numpy  # noqa: F401
    import sklearn  # noqa: F401
    import torch  # noqa: F401
    import transformers  # noqa: F401
    import serial  # noqa: F401
    from sentence_transformers import SentenceTransformer
    from services.ia_paths import DOCUMENTS_DIR, MODEL_DIR, VECTORSTORE_DIR
    from routers.moisture import _service

    frontend_index = resource_path("frontend_dist/index.html")
    if not frontend_index.is_file():
        raise RuntimeError(f"Frontend no encontrado: {frontend_index}")
    if not Path(MODEL_DIR).is_dir():
        raise RuntimeError(f"Modelo local no encontrado: {MODEL_DIR}")
    SentenceTransformer(str(MODEL_DIR))
    DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
    VECTORSTORE_DIR.mkdir(parents=True, exist_ok=True)
    if not _service.port or _service.timeout <= 0:
        raise RuntimeError("Configuración Wagner inválida")
    print("SMOKE TEST OK")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--smoke-test", action="store_true")
    args = parser.parse_args()
    os.chdir(APP_ROOT if FROZEN else Path(__file__).resolve().parent)
    try:
        run_migrations()
        ensure_initial_data()
        if args.smoke_test:
            smoke_test()
            return 0
    except Exception as exc:
        print(f"ERROR: no fue posible inicializar GradingApp: {exc}", file=sys.stderr)
        return 1

    from main import app
    import threading
    import uvicorn

    def run_mobile() -> None:
        uvicorn.run(app, host="0.0.0.0", port=8080, log_level="info")

    threading.Thread(target=run_mobile, daemon=True).start()
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
    return 0


if __name__ == "__main__":
    multiprocessing.freeze_support()
    raise SystemExit(main())

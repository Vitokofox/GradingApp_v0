"""Rutas estables para desarrollo y distribuciones PyInstaller."""

from pathlib import Path
import sys


FROZEN = bool(getattr(sys, "frozen", False))
APP_ROOT = Path(sys.executable).resolve().parent if FROZEN else Path(__file__).resolve().parent
RESOURCE_ROOT = Path(getattr(sys, "_MEIPASS", APP_ROOT)).resolve()


def persistent_path(relative_path: str) -> Path:
    """Ruta escribible/persistente, siempre junto al ejecutable congelado."""
    return APP_ROOT / relative_path


def resource_path(relative_path: str) -> Path:
    """Recurso de solo lectura incorporado por PyInstaller."""
    return RESOURCE_ROOT / relative_path

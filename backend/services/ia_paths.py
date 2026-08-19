import os
from pathlib import Path

from app_paths import APP_ROOT, FROZEN, RESOURCE_ROOT

# Base del backend: .../backend
BASE_DIR = RESOURCE_ROOT if FROZEN else Path(__file__).resolve().parent.parent

def _path_from_env(env_name: str, default: Path) -> Path:
    raw = (os.getenv(env_name) or "").strip()
    if not raw:
        return default
    p = Path(raw)
    if not p.is_absolute():
        return APP_ROOT / p
    return p


# Permite rutas compartidas para despliegues multiusuario (UNC, unidad de red, etc.).
DOCUMENTS_DIR = _path_from_env("NORMAS_PATH", APP_ROOT / "data" / "documentos")
VECTORSTORE_DIR = _path_from_env("VECTORSTORE_PATH", APP_ROOT / "data" / "vectorstore")

# Embeddings model path resolution
# 1. First check if it is next to exe/workspace root (external / offline)
MODEL_DIR = APP_ROOT / "models" / "all-MiniLM-L6-v2"
if not MODEL_DIR.exists():
    # 2. Check bundled inside (internal / sys._MEIPASS)
    MODEL_DIR = BASE_DIR / "models" / "all-MiniLM-L6-v2"
    if not MODEL_DIR.exists():
        # 3. Fallback to default name if both local paths are missing
        MODEL_DIR = Path("sentence-transformers/all-MiniLM-L6-v2")

DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
VECTORSTORE_DIR.mkdir(parents=True, exist_ok=True)

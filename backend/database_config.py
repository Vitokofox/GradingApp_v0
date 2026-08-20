"""Single source of truth for GradingApp's SQLite database location."""

from __future__ import annotations

import os
from pathlib import Path


DATABASE_DIR_ENV = "GRADINGAPP_DATABASE_DIR"
DEFAULT_DATABASE_DIR = Path(
    r"C:\Users\Victor.Valenzuela\OneDrive - ARAUCO\DataBase"
)
DATABASE_FILENAME = "grading.db"
LOCAL_DATA_ENV = "GRADINGAPP_LOCAL_DATA_DIR"


def resolve_local_data_dir(environ: dict[str, str] | None = None) -> Path:
    """Return persistent per-user storage for Windows and Linux."""
    environment = os.environ if environ is None else environ
    explicit = environment.get(LOCAL_DATA_ENV)
    if explicit:
        return Path(explicit).expanduser().resolve(strict=False)
    if os.name == "nt":
        base = environment.get("LOCALAPPDATA")
        if base:
            return (Path(base) / "GradingApp").resolve(strict=False)
    xdg_data = environment.get("XDG_DATA_HOME")
    base = Path(xdg_data).expanduser() if xdg_data else Path.home() / ".local" / "share"
    return (base / "gradingapp").resolve(strict=False)


def resolve_primary_database_dir(environ: dict[str, str] | None = None) -> Path:
    environment = os.environ if environ is None else environ
    configured = environment.get(DATABASE_DIR_ENV)
    directory = Path(configured).expanduser() if configured else DEFAULT_DATABASE_DIR
    return directory.resolve(strict=False)


def _directory_is_accessible(directory: Path) -> bool:
    return directory.is_dir() and os.access(directory, os.R_OK | os.W_OK)


def resolve_database_dir(environ: dict[str, str] | None = None) -> Path:
    """Prefer accessible corporate storage, otherwise use per-user storage."""
    primary = resolve_primary_database_dir(environ)
    if _directory_is_accessible(primary):
        return primary
    return resolve_local_data_dir(environ) / "DataBase"


def resolve_database_path(environ: dict[str, str] | None = None) -> Path:
    return resolve_database_dir(environ) / DATABASE_FILENAME


def sqlite_database_url(database_path: Path) -> str:
    """Build a SQLAlchemy SQLite URL which is safe for Windows drive paths."""
    absolute_path = database_path.expanduser().resolve(strict=False)
    return f"sqlite:///{absolute_path.as_posix()}"


def ensure_database_dir(database_dir: Path) -> Path:
    """Create and validate the one configured persistent directory."""
    database_dir.mkdir(parents=True, exist_ok=True)
    if not database_dir.is_dir():
        raise RuntimeError(f"Database directory is not a directory: {database_dir}")
    if not os.access(database_dir, os.R_OK | os.W_OK):
        raise PermissionError(f"Database directory is not accessible: {database_dir}")
    return database_dir


def get_database_config(
    environ: dict[str, str] | None = None, *, create_directory: bool = True
) -> tuple[Path, Path, str]:
    directory = resolve_database_dir(environ)
    if create_directory:
        ensure_database_dir(directory)
    path = directory / DATABASE_FILENAME
    return directory, path, sqlite_database_url(path)

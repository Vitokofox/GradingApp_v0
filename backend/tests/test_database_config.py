import os
from pathlib import Path

from database_config import (
    DATABASE_FILENAME,
    DEFAULT_DATABASE_DIR,
    ensure_database_dir,
    get_database_config,
    resolve_database_dir,
    resolve_local_data_dir,
    resolve_primary_database_dir,
    sqlite_database_url,
)


def test_default_directory_is_official_windows_location():
    assert DEFAULT_DATABASE_DIR == Path(
        r"C:\Users\Victor.Valenzuela\OneDrive - ARAUCO\DataBase"
    )
    assert resolve_primary_database_dir({}) == DEFAULT_DATABASE_DIR.resolve(strict=False)


def test_unavailable_primary_uses_local_persistent_directory(tmp_path):
    missing = tmp_path / "missing corporate"
    local = tmp_path / "local data"
    environment = {
        "GRADINGAPP_DATABASE_DIR": str(missing),
        "GRADINGAPP_LOCAL_DATA_DIR": str(local),
    }
    assert resolve_database_dir(environment) == local.resolve() / "DataBase"


def test_accessible_primary_wins_over_local(tmp_path):
    corporate = tmp_path / "corporate database"
    corporate.mkdir()
    environment = {
        "GRADINGAPP_DATABASE_DIR": str(corporate),
        "GRADINGAPP_LOCAL_DATA_DIR": str(tmp_path / "local"),
    }
    assert resolve_database_dir(environment) == corporate.resolve()


def test_environment_override_supports_spaces_and_creates_directory(tmp_path):
    configured = tmp_path / "OneDrive - Test" / "DataBase"
    configured.mkdir(parents=True)
    directory, database_path, url = get_database_config(
        {"GRADINGAPP_DATABASE_DIR": str(configured)}
    )
    assert directory == configured.resolve(strict=False)
    assert directory.is_dir()
    assert database_path == directory / DATABASE_FILENAME
    assert url == f"sqlite:///{database_path.as_posix()}"


def test_url_generation_for_windows_drive_path():
    path = Path(r"C:\Users\Victor.Valenzuela\OneDrive - ARAUCO\DataBase\grading.db")
    assert sqlite_database_url(path).endswith(
        "C:/Users/Victor.Valenzuela/OneDrive - ARAUCO/DataBase/grading.db"
    )


def test_resolution_does_not_depend_on_cwd(tmp_path, monkeypatch):
    configured = tmp_path / "configured database"
    configured.mkdir()
    environment = {"GRADINGAPP_DATABASE_DIR": str(configured)}
    expected = resolve_database_dir(environment)
    other_cwd = tmp_path / "other"
    other_cwd.mkdir()
    monkeypatch.chdir(other_cwd)
    assert resolve_database_dir(environment) == expected


def test_ensure_database_dir_rejects_file(tmp_path):
    target = tmp_path / "not-a-directory"
    target.write_text("x", encoding="utf-8")
    try:
        ensure_database_dir(target)
    except FileExistsError:
        pass
    else:
        raise AssertionError("A file must not be accepted as a database directory")

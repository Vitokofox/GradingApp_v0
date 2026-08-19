# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path

from PyInstaller.utils.hooks import collect_data_files, collect_dynamic_libs, collect_submodules, copy_metadata

BACKEND = Path(SPECPATH).resolve()
PROJECT = BACKEND.parent
datas = [
    (str(PROJECT / "frontend" / "dist"), "frontend_dist"),
    (str(BACKEND / "alembic"), "alembic"),
    (str(BACKEND / "alembic.ini"), "."),
]
binaries = []
hiddenimports = [
    "sqlalchemy.sql.default_comparator", "jose", "passlib.handlers.bcrypt",
    "uvicorn.logging", "uvicorn.loops.auto", "uvicorn.protocols.http.auto",
    "uvicorn.lifespan.on", "serial", "sklearn.feature_extraction.text",
]

for package in ("torch", "numpy", "sklearn", "faiss", "tokenizers"):
    binaries += collect_dynamic_libs(package)
for package in ("torch", "transformers", "sentence_transformers", "tokenizers",
                "scikit_learn", "numpy", "faiss_cpu"):
    datas += copy_metadata(package)
datas += collect_data_files("transformers", include_py_files=False)
datas += collect_data_files("sentence_transformers", include_py_files=False)
hiddenimports += collect_submodules("sentence_transformers")

a = Analysis(
    [str(BACKEND / "portable_entry.py")], pathex=[str(BACKEND)],
    binaries=binaries, datas=datas, hiddenimports=hiddenimports,
    hookspath=[], hooksconfig={}, runtime_hooks=[], excludes=["pytest", "tkinter"],
    noarchive=False, optimize=0,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz, a.scripts, [], exclude_binaries=True, name="GradingApp", debug=False,
    bootloader_ignore_signals=False, strip=False, upx=False, console=True,
)
coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=False, name="GradingApp")

from pathlib import Path
from typing import Dict, List

from loguru import logger

from services.ia_paths import DOCUMENTS_DIR

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}


def documentos_dir() -> Path:
    DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
    return DOCUMENTS_DIR


def archivo_permitido(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS


def _leer_pdf(path: Path) -> str:
    try:
        from PyPDF2 import PdfReader
    except Exception as exc:
        raise RuntimeError("PyPDF2 no está instalado.") from exc

    reader = PdfReader(str(path))
    pages = []
    for page in reader.pages:
        pages.append(page.extract_text() or "")

    text_content = "\n".join(pages).strip()

    # Extrae tablas estructuradas (durante indexacion, nunca en consulta).
    table_blocks: List[str] = []
    try:
        import pdfplumber  # type: ignore

        with pdfplumber.open(str(path)) as pdf:
            for page_idx, page in enumerate(pdf.pages, start=1):
                tables = page.extract_tables() or []
                for table_idx, table in enumerate(tables, start=1):
                    normalized_rows: List[str] = []
                    for row in table or []:
                        if not row:
                            continue
                        cells = [" ".join(str(cell or "").split()) for cell in row]
                        cells = [c for c in cells if c]
                        if not cells:
                            continue
                        normalized_rows.append(" | ".join(cells))

                    if normalized_rows:
                        block = "\n".join(normalized_rows)
                        table_blocks.append(f"[TABLA p{page_idx} t{table_idx}]\n{block}")
    except Exception as exc:
        logger.warning(f"IA documental: no se pudo extraer tabla en {path.name}: {exc}")

    if table_blocks:
        logger.info(f"IA documental: tablas detectadas en {path.name}: {len(table_blocks)}")
        return (text_content + "\n\n" + "\n\n".join(table_blocks)).strip()

    return text_content


def _leer_docx(path: Path) -> str:
    try:
        from docx import Document
    except Exception as exc:
        raise RuntimeError("python-docx no está instalado.") from exc

    doc = Document(str(path))
    paragraphs = [p.text for p in doc.paragraphs if p.text]
    return "\n".join(paragraphs).strip()


def _leer_txt(path: Path) -> str:
    # Intentos de codificación comunes para datos operativos en planta.
    for encoding in ("utf-8", "latin-1", "cp1252"):
        try:
            return path.read_text(encoding=encoding).strip()
        except UnicodeDecodeError:
            continue
    return path.read_text(errors="ignore").strip()


def leer_documento(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return _leer_pdf(path)
    if suffix == ".docx":
        return _leer_docx(path)
    if suffix == ".txt":
        return _leer_txt(path)
    raise ValueError(f"Tipo de archivo no soportado: {suffix}")


def listar_documentos() -> List[Path]:
    base = documentos_dir()
    logger.info(f"Buscando documentos en: {base}")

    all_files = [p for p in base.iterdir() if p.is_file()]
    valid_files = [p for p in all_files if archivo_permitido(p.name)]

    logger.info(
        "IA documental: archivos detectados -> "
        + (", ".join(sorted([p.name for p in all_files])) if all_files else "(ninguno)")
    )
    logger.info(
        "IA documental: archivos válidos para indexar -> "
        + (", ".join(sorted([p.name for p in valid_files])) if valid_files else "(ninguno)")
    )

    files = valid_files
    logger.info(f"IA documental: {len(files)} documento(s) válido(s) encontrado(s) en {base}")
    return sorted(files)


def cargar_documentos() -> List[Dict[str, str]]:
    documentos = []
    for path in listar_documentos():
        try:
            texto = leer_documento(path)
            if not texto:
                logger.warning(f"IA documental: documento vacío omitido -> {path.name}")
                continue

            documentos.append({
                "documento": path.name,
                "texto": texto,
            })
        except Exception as exc:
            logger.error(f"IA documental: error leyendo {path.name}: {exc}")

    return documentos


def guardar_archivo_subido(filename: str, content: bytes) -> str:
    base = documentos_dir()
    safe_name = Path(filename).name
    name = Path(safe_name).stem
    ext = Path(safe_name).suffix.lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError("Extensión no permitida.")

    final_name = safe_name
    candidate = base / final_name
    i = 1
    while candidate.exists():
        final_name = f"{name}_{i}{ext}"
        candidate = base / final_name
        i += 1

    logger.info(f"Guardando documento en: {candidate}")
    candidate.write_bytes(content)
    logger.info(f"IA documental: archivo guardado -> {candidate}")
    return final_name

"""
quality_table_extractor.py
Extrae reglas de calidad estructuradas desde PDFs de normas de selección.

Cada celda de la tabla genera un registro independiente:
  producto / norma / version / caracteristica / grado / regla / fuente / pagina

Soporta:
  - columnas de grado simples: COL, COB, COP, COE
  - columnas compartidas: "COP / COB", "COL/COP/COB"
  - sinónimos de características (FEATURE_SYNONYMS)
  - limpieza de ruido de tabla (páginas, fechas, encabezados)
"""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from loguru import logger

from services.ia_paths import DOCUMENTS_DIR

ATTRIBUTE_SYNONYMS: Dict[str, List[str]] = {
    "espesor": ["espesor", "grueso", "thickness"],
    "ancho": ["ancho", "width"],
    "largo": ["largo", "length"],
    "escuadria": ["escuadria", "escuadría", "square"],
}

# ─────────────────────────────────────────────────────────────────────────────
# Sinónimos de características — canónico → variantes normalizadas
# ─────────────────────────────────────────────────────────────────────────────
FEATURE_SYNONYMS: Dict[str, List[str]] = {
    "canto muerto": [
        "canto muerto", "wane", "pencil wane", "gema", "corteza",
        "falta de madera", "cara wane on face", "wane on face", "wane on reverse",
    ],
    "grietas naturales": [
        "grieta", "grietas", "rajadura", "rajaduras",
        "shake", "heart shake", "ring shake",
        "grietas naturales", "rajaduras naturales",
        "grieta natural", "grieta de crecimiento",
    ],
    "grietas de secado": [
        "grieta de secado", "grietas de secado", "secado",
        "seasoning check", "surface check", "end check",
    ],
    "nudos": [
        "nudo", "nudos", "knot", "knots", "nudo muerto", "nudo suelto",
        "nudo vivo", "nudo sano", "dead knot", "loose knot", "sound knot",
        "nudo abierto", "nudo superficial", "nudo medular", "pith knot",
    ],
    "alabeo": [
        "alabeo", "arqueadura", "encorvadura", "curvatura", "bow", "cup", "crook", "twist",
        "deformacion", "combado",
    ],
    "manchas": [
        "mancha", "manchas", "stain", "blue stain", "mancha azul",
    ],
    "pecas": [
        "peca", "pecas", "bird eye", "bird's eye", "ojo de pajaro", "ojo de pájaro",
    ],
    "bolsillos de resina": [
        "bolsillo", "bolsillo de resina", "pitch pocket", "bolsa de resina",
        "bolsillos", "bark pocket",
    ],
    "escuadria": [
        "escuadria", "escuadría", "cuadratura",
    ],
    "contenido de humedad": [
        "humedad", "contenido de humedad", "moisture content", "mc",
    ],
    "dimension": [
        "espesor", "ancho", "largo", "calibre", "medida", "dimension", "tolerancia dimensional",
    ],
    "acicula": [
        "acicula", "acecula", "pitch streak", "pitch wood",
    ],
    "perforaciones": [
        "perforacion", "perforaciones", "hoyo", "insecto", "taladro",
        "agujero", "boring", "worm hole",
    ],
    "moho": [
        "moho", "hongos", "mold", "mildew", "hongo",
    ],
}

# Grados reconocidos
GRADE_KEYS = ["COL", "COB", "COP", "COE", "SE", "FG2", "FG4", "FG5", "MSD", "G1", "G2", "M&B", "SBC", "SH2", "SH3", "P99", "RIP5", "RNC"]

# Noise patterns to skip
_NOISE_PATTERNS = re.compile(
    r"(pagina\s*\d|fecha\s*:|codigo\s*:|titulo\s*:|version\s*:|\bma\b|\breservados\b|arauco\s+s\.?a\.?)",
    re.IGNORECASE,
)

_TOL_PAIR_PATTERN = re.compile(r"(-?\d+)\s*\+\s*(\d+)")


# ─────────────────────────────────────────────────────────────────────────────
# Normalización básica
# ─────────────────────────────────────────────────────────────────────────────

def _norm(text: str) -> str:
    text = text or ""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return text.lower().strip()


def _clean_cell(text: str) -> str:
    s = " ".join((text or "").split())
    s = re.sub(r"\s{2,}", " ", s).strip()
    return s


def _format_tolerance_value(min_v: str, max_v: str) -> str:
    return f"{min_v} / +{max_v} mm"


def _extract_tolerance_values(row_text: str) -> Dict[str, str]:
    """Extrae tolerancias por atributo desde una fila tipo 'Tolerancias (mm)'"""
    n = _norm(row_text)

    attrs_with_pos: List[tuple[int, str]] = []
    for attr, aliases in ATTRIBUTE_SYNONYMS.items():
        positions = [n.find(_norm(a)) for a in aliases]
        positions = [p for p in positions if p >= 0]
        if positions:
            attrs_with_pos.append((min(positions), attr))

    if not attrs_with_pos:
        return {}

    attrs_with_pos.sort(key=lambda x: x[0])
    attrs_ordered = [a for _, a in attrs_with_pos if a in {"espesor", "ancho", "largo"}]

    pairs = _TOL_PAIR_PATTERN.findall(row_text)
    if not pairs:
        return {}

    values: Dict[str, str] = {}
    for idx, attr in enumerate(attrs_ordered):
        if idx >= len(pairs):
            break
        min_v, max_v = pairs[idx]
        values[attr] = _format_tolerance_value(min_v, max_v)

    return values


# ─────────────────────────────────────────────────────────────────────────────
# Detección de grados en texto de columna
# ─────────────────────────────────────────────────────────────────────────────

def _extract_grade_mentions(text: str) -> List[str]:
    """
    Detecta grados en texto de columna de tabla.

    NOTA: 'SE' se excluye intencionalmente porque también es el pronombre
    reflexivo español. Los grados extendidos (FG4, FG5, MSD, G1, G2, etc.)
    se detectan además de los estándar COL/COB/COP/COE.
    """
    # Grados estándar
    std = re.findall(r"\b(?:col|cob|cop|coe)\b", text or "", re.IGNORECASE)
    # Grados extendidos — orden más largo primero para evitar FG5 → FG
    ext = re.findall(r"\b(?:fg[245]|fg|msd|g[12]|sh[23]|p99|rip5|rnc|m&b|sbc)\b", text or "", re.IGNORECASE)
    found = std + ext
    return [g.upper() for g in dict.fromkeys(found)]  # dedup manteniendo orden


def _is_grade_header_col(col_text: str) -> bool:
    return bool(_extract_grade_mentions(col_text))


def _looks_like_grade_label(col_text: str) -> bool:
    text = _clean_cell(col_text)
    if not text:
        return False
    grades = _extract_grade_mentions(text)
    if not grades:
        return False

    text_n = _norm(text)
    if text_n.startswith("grado"):
        return True

    tokens = [t for t in re.split(r"\s+", text_n) if t]
    if len(tokens) <= 6:
        return True

    compact = re.sub(r"[^a-z0-9/&\-\s]", " ", text_n)
    if re.fullmatch(r"(?:grado\s+)?(?:col|cob|cop|coe|fg[245]?|fg|msd|g[12]|sh[23]|p99|rip5|rnc|m&b|sbc)(?:\s*[/\-]\s*(?:col|cob|cop|coe|fg[245]?|fg|msd|g[12]|sh[23]|p99|rip5|rnc|m&b|sbc))*", compact.strip()):
        return True

    return False


# ─────────────────────────────────────────────────────────────────────────────
# Detección de característica en texto de fila
# ─────────────────────────────────────────────────────────────────────────────

def _match_feature(row_text: str) -> Optional[str]:
    n = _norm(row_text)
    if not n:
        return None

    # Priorizar la etiqueta principal de la fila y no el texto descriptivo.
    # Ejemplo: en "NUDOS ... Nota: ... corteza ..." no debe ganar
    # "canto muerto" por la palabra secundaria "corteza".
    label_zone = n
    split_markers = [" nota", ' "', ' “', '"', "“", "("]
    cut_positions = [label_zone.find(marker) for marker in split_markers if label_zone.find(marker) > 0]
    if cut_positions:
        label_zone = label_zone[: min(cut_positions)].strip()

    def _rank_matches(text: str) -> List[Tuple[int, int, str, str]]:
        ranked_local: List[Tuple[int, int, str, str]] = []
        for canonical, synonyms in FEATURE_SYNONYMS.items():
            for syn in synonyms:
                syn_n = _norm(syn)
                if not syn_n:
                    continue
                match = re.search(rf"\b{re.escape(syn_n)}\b", text)
                if match:
                    ranked_local.append((len(syn_n), -match.start(), canonical, syn))
        return ranked_local

    # Prioriza alias más específicos para evitar colisiones por subcadenas.
    ranked = _rank_matches(label_zone)
    if not ranked:
        ranked = _rank_matches(n)

    if ranked:
        ranked.sort(key=lambda x: (x[0], x[1]), reverse=True)
        return ranked[0][2]
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Extracción del año/versión del nombre de archivo
# ─────────────────────────────────────────────────────────────────────────────

def _extract_year(text: str) -> int:
    years = [int(y) for y in re.findall(r"(?:19|20)\d{2}", text or "")]
    return max(years) if years else 0


def _extract_version(text: str) -> str:
    year = _extract_year(text)
    if year:
        return str(year)
    m = re.search(r"(?:version|ver\.?|v)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)", text, re.IGNORECASE)
    if m:
        return m.group(1)
    return "N/D"


def _infer_product(filename: str) -> str:
    """Infiere el producto/familia a partir del nombre de archivo.
    El orden importa: patrones más específicos primero.
    """
    n = _norm(filename)
    # FG antes de seco: "14.0 (SE) (FG4-FG5-MSD) SELECCION SECO" → FG
    if re.search(r"fg[245]?\b|\bfg4\b|\bfg5\b|\bmsd\b", n):
        return "FG"
    if "rip" in n:
        return "RIP"
    if "factory" in n:
        return "Factory"
    if "board" in n:
        return "Board"
    if "pallet" in n:
        return "Pallet"
    if "basa" in n or re.search(r"\bbs\b", n):
        return "Basa"
    if "rough" in n or re.search(r"\brgh\b|\bpdv\b", n):
        return "Rough"
    if re.search(r"\bap[ep]\b|apariencia", n):
        return "Apariencia"
    if "china" in n:
        return "Seleccion China"
    if "seco" in n:
        return "Seleccion Seco"
    if "rollizo" in n:
        return "Rollizos"
    if "arauco" in n:
        return "Arauco"
    return filename.rsplit(".", 1)[0]


def _product_grades(product: str) -> List[str]:
    p = _norm(product)
    if "china" in p:
        return ["COL", "COP", "COB", "COE"]
    if "seco" in p:
        return ["COL", "COP", "COB"]
    if "fg" in p or "msd" in p:
        # Orden real frecuente en normas: FG2 | MSD | FG4 | FG5
        return ["FG2", "MSD", "FG4", "FG5"]
    if "board" in p:
        return ["G1", "G2", "COL"]
    if "pallet" in p:
        return ["CHP", "CH2", "MST"]
    if "basa" in p:
        return ["BBY", "MED", "SML"]
    if "apariencia" in p or "app" in p:
        return ["APP", "APE"]
    return ["COL", "COP", "COB", "COE"]


def _collect_grades_for_cols(col_grade_map: Dict[int, List[str]], cols: List[int]) -> List[str]:
    grades: List[str] = []
    for c in cols:
        for g in col_grade_map.get(c, []):
            if g not in grades:
                grades.append(g)
    return grades


def _resolve_shared_grade_cell(
    cells: List[str],
    col_idx: int,
    grade_cols: List[int],
    col_grade_map: Dict[int, List[str]],
) -> Tuple[str, List[str], Optional[int]]:
    """
    Intenta resolver una celda vacia por colspan/merged horizontal.

    Estrategia:
    - Si la columna objetivo esta vacia, busca una celda no vacia contigua
      hacia izquierda o derecha dentro de columnas de grado.
    - Solo considera span cuando las columnas intermedias estan vacias.
    - Devuelve (texto_resuelto, grados_aplicables, col_fuente).
    """
    if col_idx not in grade_cols:
        return "", [], None

    pos = grade_cols.index(col_idx)
    target_text = cells[col_idx] if col_idx < len(cells) else ""
    if target_text:
        return "", [], None

    # Buscar izquierda (caso comun: texto en MSD y FG4 vacio por celda fusionada)
    source_col: Optional[int] = None
    span_cols: List[int] = []
    for li in range(pos - 1, -1, -1):
        cand_col = grade_cols[li]
        cand_text = cells[cand_col] if cand_col < len(cells) else ""
        if not cand_text:
            continue

        between = grade_cols[li + 1 : pos + 1]
        all_empty_between = all(not (cells[c] if c < len(cells) else "") for c in between if c != cand_col)
        if all_empty_between:
            source_col = cand_col
            span_cols = grade_cols[li : pos + 1]
            break

    # Fallback: buscar derecha
    if source_col is None:
        for ri in range(pos + 1, len(grade_cols)):
            cand_col = grade_cols[ri]
            cand_text = cells[cand_col] if cand_col < len(cells) else ""
            if not cand_text:
                continue

            between = grade_cols[pos:ri]
            all_empty_between = all(not (cells[c] if c < len(cells) else "") for c in between if c != cand_col)
            if all_empty_between:
                source_col = cand_col
                span_cols = grade_cols[pos : ri + 1]
                break

    if source_col is None:
        return "", [], None

    source_text = cells[source_col] if source_col < len(cells) else ""
    if not source_text:
        return "", [], None

    span_grades = _collect_grades_for_cols(col_grade_map, span_cols)
    return source_text, span_grades, source_col


# ─────────────────────────────────────────────────────────────────────────────
# Parser de tabla principal
# ─────────────────────────────────────────────────────────────────────────────

def _parse_table(
    table: List[List[str]],
    source_file: str,
    page: int,
) -> List[Dict[str, Any]]:
    """Convierte una tabla pdfplumber en registros de regla por grado/característica."""
    records: List[Dict[str, Any]] = []
    if not table:
        return records

    # Paso 1: mapear columnas a grados (puede haber múltiples filas de encabezado)
    col_grade_map: Dict[int, List[str]] = {}  # col_idx -> [grados]
    first_data_row = 0

    for row_idx, row in enumerate(table[:8]):  # encabezados solo en primeras filas
        cols = [_clean_cell(c) for c in (row or [])]
        has_grade = any(_looks_like_grade_label(c) for c in cols)
        if not has_grade:
            continue

        # Evitar confundir filas de datos con encabezado cuando la primera
        # columna ya representa una caracteristica (p.ej. "NUDOS...").
        c0 = cols[0] if cols else ""
        if _match_feature(c0):
            continue

        grade_cells_count = sum(1 for c in cols if _extract_grade_mentions(c))
        # Fila con solo una celda de grado suele ser dato (p.ej. celda MSD en
        # una fila de caracteristica). Permitimos 1 solo en filas muy altas.
        if grade_cells_count <= 1 and row_idx > 1:
            continue

        for col_idx, col_text in enumerate(cols):
            grades = _extract_grade_mentions(col_text)
            if grades and _looks_like_grade_label(col_text):
                existing = col_grade_map.get(col_idx, [])
                for g in grades:
                    if g not in existing:
                        existing.append(g)
                col_grade_map[col_idx] = existing

        # Heuristica de encabezado con colspan: si una celda trae multiples grados
        # y las columnas siguientes estan vacias, se distribuyen los grados.
        for col_idx, col_text in enumerate(cols):
            grades = _extract_grade_mentions(col_text)
            if len(grades) <= 1:
                continue
            if not _looks_like_grade_label(col_text):
                continue

            offset = 0
            for g in grades:
                target_col = col_idx + offset
                if target_col >= len(cols):
                    break
                existing = col_grade_map.get(target_col, [])
                if g not in existing:
                    existing.append(g)
                col_grade_map[target_col] = existing
                offset += 1

        first_data_row = row_idx + 1

    if not col_grade_map:
        return records  # Tabla sin columnas de grado reconocibles

    # Completar columnas sin grado por inferencia de orden esperado del producto
    # (util para headers incompletos por OCR/celdas combinadas).
    max_cols = max((len(r or []) for r in table), default=0)
    if max_cols > 2:
        expected_grades = _product_grades(_infer_product(source_file))
        mapped_grades = _collect_grades_for_cols(col_grade_map, sorted(col_grade_map.keys()))
        missing_grades = [g for g in expected_grades if g not in mapped_grades]
        # Asumimos col 0 como descriptor de caracteristica; columnas >=1 son de grado.
        candidate_grade_cols = [c for c in range(1, max_cols)]
        unmapped_cols = [c for c in candidate_grade_cols if c not in col_grade_map]
        if missing_grades and unmapped_cols and len(missing_grades) <= len(unmapped_cols):
            for idx, grade in enumerate(missing_grades):
                target_col = unmapped_cols[idx]
                existing = col_grade_map.get(target_col, [])
                if grade not in existing:
                    existing.append(grade)
                col_grade_map[target_col] = existing
            logger.info(
                "IA extractor: inferencia_header_grados "
                f"archivo='{source_file}' pagina={page} "
                f"missing={missing_grades} asignados_cols={unmapped_cols[:len(missing_grades)]}"
            )

    logger.info(
        f"IA extractor: tabla p{page} {source_file} "
        f"col_grade_map={col_grade_map} first_data_row={first_data_row}"
    )

    version = _extract_version(source_file)
    product = _infer_product(source_file)
    all_grades: List[str] = []
    for gs in col_grade_map.values():
        for g in gs:
            if g not in all_grades:
                all_grades.append(g)

    # Paso 2: recorrer filas de datos
    active_feature: Optional[str] = None
    active_feature_aliases: List[str] = []
    active_feature_raw: str = ""
    grade_cols = sorted(col_grade_map.keys())

    last_text_by_col: Dict[int, str] = {}

    for row_idx in range(first_data_row, len(table)):
        row = table[row_idx] or []
        cells = [_clean_cell(c) for c in row]
        if not cells:
            continue

        row_joined = " | ".join(cells)

        # Extraccion estructurada de tolerancias por atributo.
        tol_values = _extract_tolerance_values(row_joined)
        if tol_values and ("tolerancia" in _norm(row_joined) or len(tol_values) >= 2):
            target_grades = _product_grades(product)
            for grade in target_grades:
                for atributo, valor in tol_values.items():
                    records.append(
                        {
                            "tipo": "tolerancia",
                            "categoria": "tolerancias",
                            "table_title": "Tolerancias",
                            "producto": product,
                            "norma": source_file.rsplit(".", 1)[0],
                            "version": version,
                            "atributo": atributo,
                            "grado": grade,
                            "valor": valor,
                            "regla": f"{atributo}: {valor}",
                            "row_key": f"{source_file}::p{page}::r{row_idx}::tol::{atributo}::g{grade}",
                            "fuente": source_file,
                            "pagina": page,
                        }
                    )
            continue

        # Intenta detectar característica en la primera columna / celda izquierda
        row_feature_raw = cells[0] if cells else ""
        feature = _match_feature(row_feature_raw)
        had_explicit_feature = bool(feature)

        if feature:
            active_feature = feature
            active_feature_raw = row_feature_raw
            active_feature_aliases = FEATURE_SYNONYMS.get(active_feature, [])
        elif active_feature is None:
            continue  # fila sin característica aún
        elif row_feature_raw.strip():
            # Si la primera celda trae un nuevo encabezado/texto propio y no fue
            # reconocido como característica válida, no heredar la anterior.
            active_feature = None
            active_feature_aliases = []
            active_feature_raw = ""
            continue

        # Para cada columna de grado, extraer celda
        for col_idx, grades in col_grade_map.items():
            if col_idx >= len(cells):
                continue
            cell_text = cells[col_idx]
            shared_grades: List[str] = []
            source_col: Optional[int] = None

            # Si la celda de grado viene vacia, intentar resolver por celda compartida.
            if not cell_text:
                shared_text, shared_grades, source_col = _resolve_shared_grade_cell(
                    cells=cells,
                    col_idx=col_idx,
                    grade_cols=grade_cols,
                    col_grade_map=col_grade_map,
                )
                if shared_text:
                    cell_text = shared_text
                    logger.info(
                        "IA extractor: Celda compartida detectada "
                        f"atributo='{active_feature or 'N/A'}' "
                        f"grados={shared_grades or grades} "
                        f"fuente_col={source_col} target_col={col_idx} "
                        f"fila={row_idx} pagina={page} archivo='{source_file}'"
                    )

            # Heuristica adicional: a veces el OCR deja una version corta en una
            # columna y el contenido completo en la columna adyacente (spanning
            # parcial). Si el texto corto es subconjunto del adyacente rico,
            # promover el contenido rico para no perder reglas.
            if cell_text:
                cell_n = _norm(cell_text)
                if cell_n and len(cell_text) < 90:
                    pos = grade_cols.index(col_idx) if col_idx in grade_cols else -1
                    if pos >= 0:
                        for npos in (pos - 1, pos + 1):
                            if npos < 0 or npos >= len(grade_cols):
                                continue
                            ncol = grade_cols[npos]
                            ntext = cells[ncol] if ncol < len(cells) else ""
                            ntext_n = _norm(ntext)
                            if not ntext or len(ntext) < 120:
                                continue
                            overlap_match = False
                            if cell_n in ntext_n:
                                overlap_match = True
                            else:
                                tokens = [t for t in re.split(r"\s+", cell_n) if len(t) >= 4]
                                if tokens:
                                    hits = sum(1 for t in tokens if t in ntext_n)
                                    overlap_match = hits >= min(5, len(tokens))

                            if overlap_match:
                                cell_text = ntext
                                shared_grades = _collect_grades_for_cols(col_grade_map, [col_idx, ncol])
                                source_col = ncol
                                logger.info(
                                    "IA extractor: Celda compartida detectada (subset) "
                                    f"atributo='{active_feature or 'N/A'}' "
                                    f"grados={shared_grades or grades} "
                                    f"fuente_col={source_col} target_col={col_idx} "
                                    f"fila={row_idx} pagina={page} archivo='{source_file}'"
                                )
                                break

            # Rowspan conservador: fila de continuidad sin nueva caracteristica,
            # celda vacia y valor previo en la misma columna.
            if not cell_text and not had_explicit_feature and col_idx in last_text_by_col:
                any_grade_text = any(
                    (cells[c] if c < len(cells) else "")
                    for c in grade_cols
                )
                if any_grade_text:
                    cell_text = last_text_by_col[col_idx]
                    logger.info(
                        "IA extractor: Celda compartida detectada (rowspan) "
                        f"atributo='{active_feature or 'N/A'}' "
                        f"grados={grades} col={col_idx} fila={row_idx} pagina={page} archivo='{source_file}'"
                    )

            if not cell_text or _NOISE_PATTERNS.search(cell_text):
                continue
            if _norm(cell_text) in {"", "-", "n/a", "na", "nd", "no aplica"}:
                continue

            # Explode: "1. xxx 2. yyy" en reglas separadas
            rules_from_cell = _explode_cell(cell_text)
            if cell_text:
                last_text_by_col[col_idx] = cell_text
            for rule_text in rules_from_cell:
                if not rule_text:
                    continue
                for grade in grades:
                    row_key = f"{source_file}::p{page}::r{row_idx}::f{_norm(active_feature)}::g{grade}"
                    records.append(
                        {
                            "producto": product,
                            "norma": source_file.rsplit(".", 1)[0],
                            "version": version,
                            "caracteristica": active_feature,
                            "caracteristica_raw": active_feature_raw,
                            "alias": active_feature_aliases,
                            "grado": grade,
                            "grados_aplicables": shared_grades or [grade],
                            "regla": rule_text,
                            "row_key": row_key,
                            "fuente": source_file,
                            "pagina": page,
                        }
                    )

    return records


def _explode_cell(cell_text: str) -> List[str]:
    """Divide '1. xxx 2. yyy' en partes independientes."""
    parts = re.split(r"\s+(?=\d+[\.)]\s)", cell_text)
    results: List[str] = []

    for p in parts:
        cleaned = _clean_cell(p)
        if not cleaned:
            continue

        # Si no viene numerada y la celda es larga, separar en reglas por
        # oraciones para conservar unidades por criterio.
        if not re.match(r"^\d+[\.)]\s", cleaned) and len(cleaned) > 120:
            sentence_parts = re.split(r"(?<=[\.;:])\s+(?=[A-ZÁÉÍÓÚÑ0-9])", cleaned)
            for s in sentence_parts:
                s2 = _clean_cell(s)
                if s2:
                    results.append(s2)
            continue

        results.append(cleaned)

    return [r for r in results if r]


# ─────────────────────────────────────────────────────────────────────────────
# Extractor principal por PDF
# ─────────────────────────────────────────────────────────────────────────────

def extract_quality_rules_from_pdf(path: Path) -> List[Dict[str, Any]]:
    """
    Extrae reglas estructuradas de todas las tablas del PDF.

    Maneja el patrón común de las normas donde el encabezado de grados
    está en una tabla separada (Table N) y los datos en la siguiente (Table N+1).
    Cuando se detecta una tabla de 1 fila con grados, se conserva como
    encabezado persistente de la página y se inyecta en tablas siguientes
    que no tengan encabezado propio.
    """
    try:
        import pdfplumber
    except ImportError:
        logger.error("pdfplumber no está instalado.")
        return []

    all_records: List[Dict[str, Any]] = []
    source_file = path.name

    def _row_has_grades(row: Optional[List]) -> bool:
        if not row:
            return False
        return any(_looks_like_grade_label(str(c or "")) for c in row)

    def _table_has_own_header(table: List[List]) -> bool:
        for row_idx, row in enumerate(table[:5]):
            if not _row_has_grades(row):
                continue
            cells = [_clean_cell(c) for c in (row or [])]
            c0 = cells[0] if cells else ""
            if _match_feature(c0):
                continue
            grade_cells_count = sum(1 for c in cells if _looks_like_grade_label(c))
            if grade_cells_count >= 2 or row_idx <= 1:
                return True
        return False

    def _extract_header_from_table(table: List[List]) -> Optional[List]:
        """Construye un encabezado sintetico combinando varias filas de grado."""
        header_rows: List[List] = []
        for row_idx, row in enumerate(table[:8]):
            if not _row_has_grades(row):
                continue
            cells = [_clean_cell(c) for c in (row or [])]
            c0 = cells[0] if cells else ""
            if _match_feature(c0):
                continue
            grade_cells_count = sum(1 for c in cells if _looks_like_grade_label(c))
            if grade_cells_count >= 2 or row_idx <= 1:
                header_rows.append(row)

        if not header_rows:
            return None

        max_cols = max((len(r or []) for r in header_rows), default=0)
        combined: List[str] = ["" for _ in range(max_cols)]

        for col_idx in range(max_cols):
            grades_for_col: List[str] = []
            for row in header_rows:
                cell = _clean_cell(str((row[col_idx] if col_idx < len(row) else "") or ""))
                for g in _extract_grade_mentions(cell):
                    if g not in grades_for_col:
                        grades_for_col.append(g)
            combined[col_idx] = " / ".join(grades_for_col)

        return combined

    try:
        with pdfplumber.open(str(path)) as pdf:
            for page_idx, page in enumerate(pdf.pages, start=1):
                tables = page.extract_tables() or []
                page_grade_header: Optional[List] = None  # persistente por página

                for table in tables:
                    if not table:
                        continue

                    if _table_has_own_header(table):
                        # La tabla tiene su propio encabezado de grados
                        page_grade_header = _extract_header_from_table(table)
                        records = _parse_table(table, source_file, page_idx)
                    else:
                        # Sin encabezado propio → inyectar el de la tabla anterior
                        if page_grade_header is not None:
                            combined = [page_grade_header] + list(table)
                            records = _parse_table(combined, source_file, page_idx)
                        else:
                            records = _parse_table(table, source_file, page_idx)
                            # Si esta tabla es solo 1 fila y tiene grados, guardar como header
                            if len(table) == 1 and _row_has_grades(table[0]):
                                page_grade_header = table[0]

                    all_records.extend(records)
    except Exception as exc:
        logger.warning(f"IA extractor: error procesando {path.name}: {exc}")

    logger.info(
        f"IA extractor: {source_file} → {len(all_records)} reglas estructuradas extraídas"
    )
    return all_records


# ─────────────────────────────────────────────────────────────────────────────
# Extractor de todos los documentos + guardar JSON
# ─────────────────────────────────────────────────────────────────────────────

def extract_quality_rules_from_docx(path: Path) -> List[Dict[str, Any]]:
    """Extrae reglas estructuradas desde tablas de un archivo DOCX."""
    try:
        from docx import Document  # type: ignore
    except ImportError:
        logger.warning("python-docx no instalado. Instalar con: pip install python-docx")
        return []

    all_records: List[Dict[str, Any]] = []
    source_file = path.name
    product = _infer_product(source_file)
    version = _extract_version(source_file)

    try:
        doc = Document(str(path))
        for tbl_idx, table in enumerate(doc.tables):
            rows = [[cell.text.strip() for cell in row.cells] for row in table.rows]
            if not rows:
                continue
            records = _parse_table(rows, source_file, tbl_idx + 1)
            all_records.extend(records)
    except Exception as exc:
        logger.warning(f"IA extractor: error procesando DOCX {path.name}: {exc}")

    logger.info(f"IA extractor: {source_file} → {len(all_records)} reglas (DOCX)")
    return all_records


def build_quality_rules(documents_dir: Optional[Path] = None) -> List[Dict[str, Any]]:
    """
    Extrae reglas de todos los PDFs y DOCX en documents_dir.
    Retorna lista de reglas estructuradas y las guarda en quality_rules.json.
    """
    base = documents_dir or DOCUMENTS_DIR
    pdfs = sorted(base.glob("*.pdf"))
    docxs = sorted(base.glob("*.docx"))

    all_rules: List[Dict[str, Any]] = []
    for pdf in pdfs:
        rules = extract_quality_rules_from_pdf(pdf)
        all_rules.extend(rules)
    for docx in docxs:
        rules = extract_quality_rules_from_docx(docx)
        all_rules.extend(rules)

    # Guardar JSON junto al vectorstore
    out_dir = base.parent / "vectorstore"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "quality_rules.json"
    out_path.write_text(json.dumps(all_rules, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info(f"IA extractor: quality_rules.json guardado → {len(all_rules)} reglas en {out_path}")

    return all_rules


# ─────────────────────────────────────────────────────────────────────────────
# Búsqueda estructurada: find_rule_by_grade_and_feature
# ─────────────────────────────────────────────────────────────────────────────

def find_rule_by_grade_and_feature(
    grade: str,
    feature: str,
    rules: List[Dict[str, Any]],
    prefer_recent: bool = True,
    product_hint: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Busca la regla exacta para (grade, feature) en la lista estructurada.

    Prioridad:
    1. Coincidencia exacta de grado
    2. Coincidencia exacta de característica canónica
    3. Pista de producto si se provee
    4. Versión más reciente

    Retorna dict con: found, grado, caracteristica, reglas, fuente, version.
    """
    grade_u = grade.upper()
    feature_n = _norm(feature)

    # Resolver alias de característica al canónico
    canonical_feature: Optional[str] = None
    for canon, synonyms in FEATURE_SYNONYMS.items():
        if any(syn in feature_n for syn in [_norm(s) for s in synonyms]) or _norm(canon) in feature_n:
            canonical_feature = canon
            break

    if canonical_feature is None:
        canonical_feature = feature  # usar como viene

    logger.info(
        f"IA extractor: busqueda_estructurada "
        f"grado={grade_u} caracteristica_canonica='{canonical_feature}' "
        f"producto_hint={product_hint or 'N/A'}"
    )

    feature_matches = [
        r for r in rules
        if _norm(r.get("caracteristica", "")) == _norm(canonical_feature)
    ]

    if product_hint:
        hint_n = _norm(product_hint)
        product_feature_matches = [
            r for r in feature_matches
            if hint_n in _norm(r.get("producto", "")) or hint_n in _norm(r.get("fuente", ""))
        ]
        if product_feature_matches:
            feature_matches = product_feature_matches

    if not feature_matches:
        logger.info(
            f"IA extractor: sin coincidencia para grado={grade_u} caracteristica='{canonical_feature}'"
        )
        return {
            "found": False,
            "grado": grade,
            "caracteristica": canonical_feature,
            "reglas": [],
            "fuente": "N/D",
            "version": "N/D",
        }

    # Agrupar por fila (unidad de conocimiento independiente).
    row_groups: Dict[str, Dict[str, Any]] = {}
    for r in feature_matches:
        row_key = r.get("row_key") or (
            f"{r.get('fuente','N/D')}::p{r.get('pagina','N/D')}::f{_norm(r.get('caracteristica',''))}::g{r.get('grado','N/D')}"
        )
        group = row_groups.setdefault(
            row_key,
            {
                "row_key": row_key,
                "caracteristica": r.get("caracteristica", canonical_feature),
                "caracteristica_raw": r.get("caracteristica_raw", ""),
                "grado": r.get("grado", ""),
                "producto": r.get("producto", "N/D"),
                "fuente": r.get("fuente", "N/D"),
                "version": r.get("version", "N/D"),
                "pagina": r.get("pagina", "N/D"),
                "alias": r.get("alias", FEATURE_SYNONYMS.get(canonical_feature, [])),
                "rules": [],
            },
        )
        rule_text = r.get("regla", "")
        if rule_text and all(_norm(rule_text) != _norm(x) for x in group["rules"]):
            group["rules"].append(rule_text)

    candidates: List[Dict[str, Any]] = [g for g in row_groups.values() if g.get("rules")]

    if prefer_recent:
        max_year = max((_extract_year(str(c.get("version", "")) + " " + str(c.get("fuente", ""))) for c in candidates), default=0)
    else:
        max_year = 0

    # Score obligatorio:
    # score = 0.5 * caracteristica_exacta + 0.3 * grado_exacto + 0.2 * version
    for c in candidates:
        feature_exact = 1.0 if _norm(c.get("caracteristica", "")) == _norm(canonical_feature) else 0.0
        grade_exact = 1.0 if str(c.get("grado", "")).upper() == grade_u else 0.0
        year = _extract_year(str(c.get("version", "")) + " " + str(c.get("fuente", "")))
        version_score = 1.0 if (max_year and year == max_year) else 0.0
        c["score"] = round((0.5 * feature_exact) + (0.3 * grade_exact) + (0.2 * version_score), 6)
        c["grade_exact"] = bool(grade_exact)

    candidates.sort(
        key=lambda x: (
            float(x.get("score", 0.0)),
            int(_extract_year(str(x.get("version", "")) + " " + str(x.get("fuente", ""))) or 0),
            len(x.get("rules", [])),
        ),
        reverse=True,
    )

    logger.info(
        "IA extractor: filas_candidatas "
        f"grado_detectado={grade_u} caracteristica_detectada='{canonical_feature}' "
        f"total={len(candidates)} preview={[
            {
                'row_key': c.get('row_key'),
                'grado': c.get('grado'),
                'score': c.get('score'),
                'fuente': c.get('fuente'),
            }
            for c in candidates[:8]
        ]}"
    )

    selected = candidates[0] if candidates else None
    if not selected:
        return {
            "found": False,
            "grado": grade,
            "caracteristica": canonical_feature,
            "reglas": [],
            "fuente": "N/D",
            "version": "N/D",
        }

    # Nunca mezclar filas/características.
    if _norm(selected.get("caracteristica", "")) != _norm(canonical_feature):
        logger.warning(
            "IA extractor: fila_descartada_por_caracteristica "
            f"seleccionada='{selected.get('caracteristica')}' detectada='{canonical_feature}'"
        )
        return {
            "found": False,
            "grado": grade,
            "caracteristica": canonical_feature,
            "reglas": [],
            "fuente": "N/D",
            "version": "N/D",
        }

    discarded_rules: List[str] = []
    for c in candidates[1:]:
        discarded_rules.extend(c.get("rules", []))

    logger.info(
        "IA extractor: fila_seleccionada "
        f"grado_detectado={grade_u} caracteristica_detectada='{canonical_feature}' "
        f"row_key='{selected.get('row_key')}' score={selected.get('score')} "
        f"grado_fila='{selected.get('grado')}' reglas_descartadas={len(discarded_rules)}"
    )

    return {
        "found": True,
        "aproximada": not bool(selected.get("grade_exact", False)),
        "grado": grade,
        "caracteristica": canonical_feature,
        "caracteristica_raw": selected.get("caracteristica_raw", ""),
        "alias": selected.get("alias", FEATURE_SYNONYMS.get(canonical_feature, [])),
        "reglas": selected.get("rules", [])[:8],
        "fuente": selected.get("fuente", "N/D"),
        "version": selected.get("version", "N/D"),
        "score": selected.get("score", 0.0),
        "row_key": selected.get("row_key", "N/D"),
        "reglas_descartadas": len(discarded_rules),
    }


def find_tolerance_by_grade_and_attribute(
    grade: str,
    atributo: str,
    rules: List[Dict[str, Any]],
    product_hint: Optional[str] = None,
) -> Dict[str, Any]:
    """Busca tolerancias por atributo (y opcionalmente grado/producto).
    Si no se especifica grado, devuelve todos los grados disponibles.
    """
    grade_u = (grade or "").upper()
    attr_n = _norm(atributo)

    tolerances = [
        r
        for r in rules
        if r.get("tipo") == "tolerancia"
        and _norm(r.get("atributo", "")) == attr_n
    ]

    if product_hint:
        hint_n = _norm(product_hint)
        product_matches = [
            r
            for r in tolerances
            if hint_n in _norm(r.get("producto", "")) or hint_n in _norm(r.get("fuente", ""))
        ]
        if product_matches:
            tolerances = product_matches

    if not tolerances:
        return {
            "found": False,
            "tipo": "tolerancia",
            "atributo": atributo,
            "grado": grade,
            "valor": "",
            "fuente": "N/D",
            "version": "N/D",
        }

    # Si se especificó grado, intentar filtrado exacto
    if grade_u:
        exact_grade_rows = [r for r in tolerances if str(r.get("grado", "")).upper() == grade_u]
        if exact_grade_rows:
            tolerances = exact_grade_rows
        # Si no hay match exacto de grado, continuar con todos los disponibles (no bloquear)

    max_year = max((_extract_year(str(r.get("version", "")) + " " + str(r.get("fuente", ""))) for r in tolerances), default=0)
    for r in tolerances:
        category_exact = 1.0 if _norm(r.get("table_title", "")) == "tolerancias" else 0.0
        grade_exact = 1.0 if (grade_u and str(r.get("grado", "")).upper() == grade_u) else 0.5
        year = _extract_year(str(r.get("version", "")) + " " + str(r.get("fuente", "")))
        version_score = 1.0 if (max_year and year == max_year) else 0.0
        r["score"] = round((0.5 * category_exact) + (0.3 * grade_exact) + (0.2 * version_score), 6)

    tolerances.sort(
        key=lambda x: (
            float(x.get("score", 0.0)),
            int(_extract_year(str(x.get("version", "")) + " " + str(x.get("fuente", ""))) or 0),
        ),
        reverse=True,
    )

    # Si no se especificó grado, devolver todos los grados disponibles como multi_rows
    if not grade_u:
        seen_grades: Dict[str, Dict[str, Any]] = {}
        for r in tolerances:
            g = str(r.get("grado", "")).upper()
            if g and g not in seen_grades:
                seen_grades[g] = r
        multi_rows = list(seen_grades.values())
        if multi_rows:
            first = multi_rows[0]
            return {
                "found": True,
                "tipo": "tolerancia",
                "atributo": first.get("atributo", atributo),
                "grado": "",
                "multi_grados": [
                    {"grado": str(r.get("grado", "")), "valor": str(r.get("valor", ""))}
                    for r in multi_rows
                ],
                "valor": ", ".join(f"{str(r.get('grado','')).upper()}: {r.get('valor','')}" for r in multi_rows[:6]),
                "table_title": first.get("table_title", "N/D"),
                "fuente": first.get("fuente", "N/D"),
                "version": first.get("version", "N/D"),
                "score": first.get("score", 0.0),
                "row_key": first.get("row_key", "N/D"),
            }

    selected = tolerances[0]
    return {
        "found": True,
        "tipo": "tolerancia",
        "atributo": selected.get("atributo", atributo),
        "grado": grade,
        "valor": selected.get("valor", ""),
        "table_title": selected.get("table_title", "N/D"),
        "fuente": selected.get("fuente", "N/D"),
        "version": selected.get("version", "N/D"),
        "score": selected.get("score", 0.0),
        "row_key": selected.get("row_key", "N/D"),
    }

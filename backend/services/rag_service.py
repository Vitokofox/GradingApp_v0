import os
import re
import time
import unicodedata
from difflib import SequenceMatcher
from functools import lru_cache
from typing import Any, Dict, List, Optional, Set, Tuple

import numpy as np
from loguru import logger

try:
    # Import estático para que PyInstaller incluya el paquete en el ejecutable.
    from sentence_transformers import SentenceTransformer as _SentenceTransformer
except Exception as _st_exc:
    _SentenceTransformer = None
    _SENTENCE_TRANSFORMERS_IMPORT_ERROR = _st_exc
else:
    _SENTENCE_TRANSFORMERS_IMPORT_ERROR = None

from services import document_loader
from services.ia_paths import DOCUMENTS_DIR
from services.ia_paths import VECTORSTORE_DIR
from services.vector_store import VectorStore
from services.quality_table_extractor import (
    FEATURE_SYNONYMS,
    ATTRIBUTE_SYNONYMS,
    build_quality_rules,
    find_rule_by_grade_and_feature as qt_find_rule,
    find_tolerance_by_grade_and_attribute as qt_find_tolerance,
)


class _HashingEmbeddingsModel:
    """Fallback liviano para entornos donde SentenceTransformer no puede iniciar (ej. DLL de torch)."""

    def __init__(self, n_features: int = 1024) -> None:
        from sklearn.feature_extraction.text import HashingVectorizer

        self._vectorizer = HashingVectorizer(
            n_features=n_features,
            alternate_sign=False,
            norm=None,
            ngram_range=(1, 2),
        )

    def encode(self, texts, convert_to_numpy: bool = True, show_progress_bar: bool = False):
        del show_progress_bar
        if isinstance(texts, str):
            texts = [texts]
        rows = [str(t or "") for t in texts]
        mat = self._vectorizer.transform(rows)
        arr = mat.astype(np.float32).toarray()
        if convert_to_numpy:
            return arr
        return arr.tolist()

TERM_EQUIVALENCES = {
    "canto muerto": {"canto muerto", "wane", "pencil wane", "gema", "corteza"},
    "nudo muerto": {"nudo muerto", "nudo suelto", "dead knot", "loose knot"},
    "degradacion": {"degradar", "degradacion", "rechazo", "aceptacion", "clasificacion"},
    "limite dimensional": {"mm", "cm", "%", "porcentaje", "dimension", "largo", "ancho"},
}

# DEFECT_MAP construido desde FEATURE_SYNONYMS + entradas legacy
DEFECT_MAP: Dict[str, List[str]] = {
    **FEATURE_SYNONYMS,
    "nudo muerto": ["nudo muerto", "nudo suelto", "dead knot", "loose knot"],
    "degradacion": ["degradacion", "degrada"],
}

FOREIGN_DEFECT_HINTS = {
    "nudo",
    "bolsillo",
    "pitch pocket",
    "resina",
    "mancha",
    "acicula",
    "grieta",
    "rajadura",
    "hongo",
    "deformacion",
}

GRADE_KEYS = ["COL", "COB", "COP", "COE", "SE"]

QUERY_CATEGORIES: Dict[str, List[str]] = {
    "defectos": [
        "canto muerto",
        "grietas",
        "nudos",
        "pecas",
        "manchas",
        "alabeo",
    ],
    "dimensiones": ["espesor", "ancho", "largo", "escuadria"],
    "tolerancias": ["espesor", "ancho", "largo"],
    "generales": ["producto", "grado", "clasificacion"],
}

GRADE_GENERAL_PATTERNS = [
    re.compile(r"^\s*(col|cop|cob|coe)\s*\??\s*$", re.IGNORECASE),
    re.compile(r"^\s*(que es|qué es|explica|norma(?:\s+para)?|grado|que significa|qué significa)\s+(el\s+)?(grado\s+)?(col|cop|cob|coe)\s*\??\s*$", re.IGNORECASE),
]

PRODUCT_SYNONYMS: Dict[str, List[str]] = {
    "China": ["china", "seleccion china", "selección china"],
    "RIP": ["rip", "rpc", "rip5", "rnc"],
    "Factory": ["factory", "fa"],
    "FG": ["fg", "fg2", "fg4", "fg5", "msd"],
    "Rough": ["rough", "rgh", "pdv"],
    "Seleccion Seco": ["seleccion seco", "selección seco", "seco"],
    "Board": ["board", "bo", "mlr"],
    "Pallet": ["pallet", "pa", "chp"],
    "Basa": ["basa", "bs", "bby"],
    "Apariencia": ["apariencia", "app", "ape", "apm", "clear"],
    "Arauco": ["arauco"],
}
HISTORICAL_HINTS = {"antigua", "anterior", "historia", "historica", "version vieja", "comparar", "2018"}

NUMERIC_PATTERNS = [
    re.compile(r"\b\d+\s?x\s?\d+\s?mm\b", re.IGNORECASE),
    re.compile(r"\b\d+(?:[\.,]\d+)?\s?%\b", re.IGNORECASE),
    re.compile(r"\b\d+(?:[\.,]\d+)?\s?(?:mm|cm|m|pulgadas?|\")\b", re.IGNORECASE),
]

ACTION_HINTS = {"acepta", "maximo", "minimo", "hasta", "aplica", "permit", "degrada", "rechaza"}

CLARIFICATION_HINTS = {
    "cual",
    "cuál",
    "que",
    "qué",
    "indica",
    "muestra",
    "detalle",
    "completa",
    "completo",
    "exacta",
    "exacto",
    "norma",
}

NOISE_HINTS = {
    "maderas arauco",
    "area",
    "area:",
    "codigo",
    "codigo:",
    "titulo",
    "titulo:",
    "fecha",
    "pagina",
    "pagina:",
    "version",
    "version:",
    "encabezado",
    "normas grados",
    "metadata",
}


class RAGService:
    def __init__(self) -> None:
        self._model = None
        self._embedding_backend = "desconocido"
        self.store = VectorStore()
        self._quality_rules: Optional[List[Dict[str, Any]]] = None

    def warmup(self) -> None:
        start = time.perf_counter()
        self._get_model()
        if self.store.exists():
            self.store.preload()
            self._load_quality_rules()
            logger.info("IA documental: startup con modelo e indice en memoria")
        else:
            logger.warning("IA documental: startup sin indice, ejecutar /indice/reconstruir")
        logger.info(f"IA documental: startup_tiempo_total={time.perf_counter() - start:.3f}s")

    def _get_model(self):
        if self._model is not None:
            return self._model

        if _SentenceTransformer is not None:
            model_name = "sentence-transformers/all-MiniLM-L6-v2"
            try:
                logger.info(f"IA documental: cargando modelo de embeddings '{model_name}'")
                self._model = _SentenceTransformer(model_name)
                self._embedding_backend = "sentence-transformers"
                return self._model
            except Exception as exc:
                logger.warning(f"IA documental: fallback a hashing embeddings ({exc})")
        else:
            if _SENTENCE_TRANSFORMERS_IMPORT_ERROR is not None:
                logger.warning(
                    "IA documental: sentence-transformers no disponible "
                    f"({type(_SENTENCE_TRANSFORMERS_IMPORT_ERROR).__name__}: {_SENTENCE_TRANSFORMERS_IMPORT_ERROR})"
                )

        try:
            self._model = _HashingEmbeddingsModel()
            self._embedding_backend = "hashing"
            logger.warning("IA documental: usando backend de embeddings fallback 'hashing'")
            return self._model
        except Exception as exc:
            raise RuntimeError(f"No fue posible inicializar motor de embeddings fallback: {exc}") from exc

    @staticmethod
    def _normalize(text: str) -> str:
        text = text or ""
        text = unicodedata.normalize("NFKD", text)
        text = "".join(ch for ch in text if not unicodedata.combining(ch))
        return text.lower()

    @staticmethod
    def _extract_year(text: str) -> int:
        years = [int(y) for y in re.findall(r"(?:19|20)\d{2}", text or "")]
        return max(years) if years else 0

    @staticmethod
    def _extract_version_value(text: str) -> float:
        vals: List[float] = []
        for raw in re.findall(r"(?:version|ver\.?|rev(?:ision)?\.?|v)\s*[:\-]?\s*(\d+(?:\.\d+)?)", text or "", flags=re.IGNORECASE):
            try:
                vals.append(float(raw))
            except ValueError:
                continue
        return max(vals) if vals else 0.0

    @staticmethod
    def _version_text(year: int, version_value: float) -> str:
        if year:
            return str(year)
        if version_value:
            return str(version_value)
        return "N/D"

    @staticmethod
    def _memory_usage_mb() -> float:
        try:
            import psutil  # type: ignore

            rss = psutil.Process(os.getpid()).memory_info().rss
            return round(rss / (1024 * 1024), 2)
        except Exception:
            return -1.0

    def _query_terms(self, question: str) -> Set[str]:
        q = self._normalize(question)
        found: Set[str] = set()
        for canonical, terms in TERM_EQUIVALENCES.items():
            if any(term in q for term in terms):
                found.add(canonical)
        return found

    def _chunk_terms(self, text: str) -> List[str]:
        t = self._normalize(text)
        found: List[str] = []
        for canonical, terms in TERM_EQUIVALENCES.items():
            if any(term in t for term in terms):
                found.append(canonical)
        return found

    def _detect_grade(self, question: str) -> str:
        q = question.upper()
        # Grados estándar
        m = re.search(r"\b(COL|COB|COP|COE|SE)\b", q)
        if m:
            return m.group(1)
        # Grados extendidos (FG4/FG5 antes de FG para evitar match parcial)
        m = re.search(r"\b(FG[245]|MSD|G[12]|SH[23]|P99|RIP5|RNC|M&B|SBC)\b", q)
        if m:
            return m.group(1)
        return ""

    def _detect_defecto(self, question: str) -> str:
        q = self._normalize(question)
        for canon, aliases in DEFECT_MAP.items():
            norm_aliases = [self._normalize(a) for a in aliases]
            if any(alias in q for alias in norm_aliases):
                logger.info(f"IA documental: caracteristica_detectada='{canon}' pregunta='{question}'")
                return canon
        # Fallback operativo para preguntas de aceptacion por grado sin defecto explicito.
        if "acepta" in q and any(g.lower() in q for g in GRADE_KEYS):
            return "canto muerto"
        return ""

    def _detect_document_hints(self, question: str) -> Set[str]:
        q = self._normalize(question)
        hints: Set[str] = set()
        for aliases in PRODUCT_SYNONYMS.values():
            for alias in aliases:
                alias_n = self._normalize(alias)
                if alias_n and re.search(rf"\b{re.escape(alias_n)}\b", q):
                    hints.add(alias_n)
        return hints

    def _detect_product(self, question: str) -> str:
        q = self._normalize(question)
        ranked: List[Tuple[int, str]] = []
        for canonical, aliases in PRODUCT_SYNONYMS.items():
            for alias in aliases:
                alias_n = self._normalize(alias)
                if not alias_n:
                    continue
                if re.search(rf"\b{re.escape(alias_n)}\b", q):
                    ranked.append((len(alias_n), canonical))
        if not ranked:
            return ""
        ranked.sort(key=lambda x: x[0], reverse=True)
        return ranked[0][1]

    def _canonical_product(self, product: str) -> str:
        p = self._normalize(product)
        if not p:
            return ""
        for canonical, aliases in PRODUCT_SYNONYMS.items():
            all_aliases = [canonical] + aliases
            for alias in all_aliases:
                alias_n = self._normalize(alias)
                if not alias_n:
                    continue
                if p == alias_n or alias_n in p or p in alias_n:
                    return canonical
        return product

    def _canonical_feature(self, feature: str) -> str:
        f = self._normalize(feature)
        if not f:
            return ""
        for canon, synonyms in FEATURE_SYNONYMS.items():
            if self._normalize(canon) == f:
                return canon
            if any(self._normalize(s) == f for s in synonyms):
                return canon
        return feature

    def _attribute_similarity(self, left: str, right: str) -> float:
        left_n = self._normalize(left)
        right_n = self._normalize(right)
        if not left_n or not right_n:
            return 0.0
        if left_n == right_n:
            return 1.0
        return SequenceMatcher(None, left_n, right_n).ratio()

    def _infer_default_product(self, grade: str, detected_product: str, feature: str, attribute: str) -> str:
        if detected_product:
            return detected_product
        return detected_product

    def _strict_rule_candidates(
        self,
        rules: List[Dict[str, Any]],
        product: str,
        grade: str,
        feature: str,
    ) -> List[Dict[str, Any]]:
        canonical_product = self._canonical_product(product)
        canonical_feature = self._canonical_feature(feature)
        grade_u = (grade or "").upper()

        filtered: List[Dict[str, Any]] = []
        for rule in rules:
            rule_feature = str(rule.get("caracteristica", ""))
            sim = self._attribute_similarity(canonical_feature, rule_feature)
            if sim < 0.90:
                continue
            if grade_u and str(rule.get("grado", "")).upper() != grade_u:
                continue
            if canonical_product:
                rule_product = self._canonical_product(str(rule.get("producto", "")))
                if rule_product != canonical_product:
                    continue
            rule_copy = dict(rule)
            rule_copy["attribute_similarity"] = sim
            filtered.append(rule_copy)
        return filtered

    def _detect_attribute(self, question: str) -> str:
        q = self._normalize(question)
        ranked: List[Tuple[int, str]] = []
        for attr, aliases in ATTRIBUTE_SYNONYMS.items():
            for alias in aliases:
                alias_n = self._normalize(alias)
                if not alias_n:
                    continue
                if re.search(rf"\b{re.escape(alias_n)}\b", q):
                    ranked.append((len(alias_n), attr))
        if not ranked:
            return ""
        ranked.sort(key=lambda x: x[0], reverse=True)
        return ranked[0][1]

    def _is_grade_general_question(self, question: str, grade: str, atributo: str, defecto: str) -> bool:
        if not grade:
            return False
        if atributo or defecto:
            return False

        q = (question or "").strip()
        for pattern in GRADE_GENERAL_PATTERNS:
            if pattern.match(q):
                return True
        return False

    def _build_grade_general_summary(self, classification: Dict[str, str]) -> Dict[str, Any]:
        grade = classification.get("grado", "")
        if not grade:
            return {"found": False}

        rules = self._load_quality_rules()
        if not rules:
            return {"found": False}

        grade_rows = [r for r in rules if str(r.get("grado", "")).upper() == grade.upper()]
        if not grade_rows:
            return {"found": False}

        products: Dict[str, int] = {}
        normas_set: Set[str] = set()
        features: List[str] = []
        attrs: List[str] = []

        for r in grade_rows:
            producto = str(r.get("producto", "") or "N/D").strip() or "N/D"
            year = self._extract_year(str(r.get("version", "")) + " " + str(r.get("fuente", "")))
            products[producto] = max(products.get(producto, 0), year)

            fuente = str(r.get("fuente", "")).strip()
            if fuente:
                normas_set.add(fuente)

            caract = str(r.get("caracteristica", "")).strip()
            if caract and caract not in features:
                features.append(caract)

            if r.get("tipo") == "tolerancia":
                attr = str(r.get("atributo", "")).strip()
                if attr and attr not in attrs:
                    attrs.append(attr)

        product_items = [
            {
                "producto": p,
                "version": str(v) if v else "N/D",
            }
            for p, v in sorted(products.items(), key=lambda x: x[0].lower())
        ]

        logger.info(
            "IA documental: grado_general_contexto "
            f"grado_detectado='{grade}' productos_asociados={product_items} normas_encontradas={sorted(list(normas_set))[:10]}"
        )

        return {
            "found": True,
            "grado": grade.upper(),
            "productos": product_items,
            "normas": sorted(list(normas_set)),
            "caracteristicas": features,
            "atributos": attrs,
        }

    def classify_question(self, question: str) -> Dict[str, str]:
        q = self._normalize(question)
        grade = self._detect_grade(question)
        product = self._detect_product(question)

        atributo = self._detect_attribute(question)
        defecto = self._detect_defecto(question)
        product = self._infer_default_product(grade, product, defecto, atributo)

        tipo_consulta = "desconocido"
        if any(k in q for k in ["tolerancia", "tolerancias", "tolerance"]):
            tipo_consulta = "tolerancia"
        elif product and defecto:
            # Consulta mixta: producto + defecto → buscar regla de ese defecto en ese producto
            tipo_consulta = "regla_defecto"
        elif product and not defecto:
            tipo_consulta = "producto_general"
        elif self._is_grade_general_question(question, grade, atributo, defecto):
            tipo_consulta = "grado_general"
        elif defecto:
            tipo_consulta = "regla_defecto"
        elif atributo:
            if atributo in QUERY_CATEGORIES["dimensiones"]:
                tipo_consulta = "desconocido"

        categoria = tipo_consulta

        result = {
            "tipo_consulta": tipo_consulta,
            "categoria": categoria,
            "atributo": atributo,
            "grado": grade,
            "producto": product,
            "defecto": defecto,
            "caracteristica": defecto,
            "requiere_aclaracion": self._needs_clarification(question, grade, product, atributo, defecto),
        }

        logger.info(
            "IA documental: classify_question "
            f"tipo_consulta_detectado='{tipo_consulta}' atributo_detectado='{atributo or 'N/A'}' "
            f"producto_detectado='{product or 'N/A'}' grado_detectado='{grade or 'N/A'}' "
            f"caracteristica_detectada='{defecto or 'N/A'}'"
        )
        return result

    def _needs_clarification(self, question: str, grade: str, product: str, atributo: str, defecto: str) -> bool:
        q = self._normalize(question)
        if not q:
            return True

        if grade and (product or atributo or defecto):
            return False

        if any(h in q for h in CLARIFICATION_HINTS):
            if not grade and not product and not atributo and not defecto:
                return True

        if len(q.split()) <= 2 and not (grade or product or atributo or defecto):
            return True

        return False

    def _build_product_general_summary(self, classification: Dict[str, str]) -> Dict[str, Any]:
        producto = classification.get("producto", "")
        if not producto:
            return {"found": False}

        product_n = self._normalize(producto)
        norms: List[str] = []
        grades: List[str] = []
        features: List[str] = []
        attrs: List[str] = []
        versions: Dict[str, int] = {}

        # 1. Buscar en documentos del vectorstore por nombre
        items = self.store.get_items() if self.store else []
        found_by_doc = False
        for item in items:
            doc_name = str(item.get("documento", "")).strip()
            doc_norm = self._normalize(doc_name)
            
            if product_n in doc_norm:
                found_by_doc = True
                if doc_name and doc_name not in norms:
                    norms.append(doc_name)
                version = self._extract_year(doc_name)
                versions[doc_name] = max(versions.get(doc_name, 0), version)

        # 2. Buscar en reglas estructuradas
        rules = self._load_quality_rules()
        if rules:
            matches = [
                r
                for r in rules
                if product_n in self._normalize(str(r.get("producto", "")))
                or product_n in self._normalize(str(r.get("fuente", "")))
            ]

            for r in matches:
                fuente = str(r.get("fuente", "")).strip()
                if fuente and fuente not in norms:
                    norms.append(fuente)
                version = self._extract_year(str(r.get("version", "")) + " " + fuente)
                doc_name = str(r.get("producto", producto)).strip()
                versions[doc_name] = max(versions.get(doc_name, 0), version)

                grade = str(r.get("grado", "")).upper().strip()
                if grade and grade not in grades:
                    grades.append(grade)

                caract = str(r.get("caracteristica", "")).strip()
                if caract and caract not in features:
                    features.append(caract)

                if r.get("tipo") == "tolerancia":
                    attr = str(r.get("atributo", "")).strip()
                    if attr and attr not in attrs:
                        attrs.append(attr)

        # Si no encontramos nada, retornar false
        if not norms and not found_by_doc:
            return {"found": False}

        product_items = [
            {"producto": k, "version": str(v) if v else "N/D"}
            for k, v in sorted(versions.items(), key=lambda x: x[0].lower())
        ]

        logger.info(
            "IA documental: product_general_contexto "
            f"tipo_consulta='producto_general' producto_detectado='{producto}' "
            f"productos_asociados={product_items} normas_encontradas={norms[:10]}"
        )

        return {
            "found": True,
            "producto": producto,
            "productos": product_items,
            "normas": norms,
            "grados": grades,
            "caracteristicas": features,
            "atributos": attrs,
        }

    def _build_clarification_response(self, classification: Dict[str, str]) -> Dict[str, Any]:
        parts: List[str] = []
        if not classification.get("producto"):
            parts.append("producto")
        if not classification.get("grado"):
            parts.append("grado")
        if not classification.get("defecto") and not classification.get("atributo"):
            parts.append("defecto o atributo")

        ask_for = ", ".join(parts[:2]) if parts else "más detalle"
        return {
            "respuesta": (
                f"Necesito {ask_for} para darte una respuesta más precisa.\n\n"
                "Ejemplos rápidos:\n"
                "• nudo muerto COP\n"
                "• tolerancia espesor RIP\n"
                "• producto general board\n"
            ),
            "fuente_principal": "N/D",
            "version_utilizada": "N/D",
            "norma_vigente": False,
            "evidencias": [],
            "requiere_aclaracion": True,
        }

    @staticmethod
    def _shorten_list(items: List[str], limit: int = 4) -> List[str]:
        return [item for item in items if item][:limit]

    def _response_with_next_step(self, main_text: str, source: str, version: str, evidence: Optional[List[Dict[str, Any]]] = None, next_step: Optional[str] = None, norma_vigente: bool = False) -> Dict[str, Any]:
        parts = [main_text.strip()]
        if source and source != "N/D":
            parts.append(f"Fuente: {source}")
        if version and version != "N/D":
            parts[-1] = parts[-1] + f" ({version})" if parts else f"({version})"
        if next_step:
            parts.append(f"Próximo paso: {next_step}")

        return {
            "respuesta": "\n\n".join(parts),
            "fuente_principal": source or "N/D",
            "version_utilizada": version or "N/D",
            "norma_vigente": norma_vigente,
            "evidencias": (evidence or [])[:2],
        }

    def _find_structured_tolerance(self, classification: Dict[str, str]) -> Dict[str, Any]:
        atributo = classification.get("atributo", "")
        grado = classification.get("grado", "")
        producto = classification.get("producto", "")

        # Solo atributo es obligatorio; grado y producto son opcionales (mejoran el resultado)
        if not atributo:
            return {"found": False}

        rules = self._load_quality_rules()
        if not rules:
            return {"found": False}

        result = qt_find_tolerance(
            grade=grado,
            atributo=atributo,
            rules=rules,
            product_hint=producto,
        )

        logger.info(
            "IA documental: tolerance_lookup "
            f"tabla_encontrada='{result.get('table_title', 'N/D')}' "
            f"celda_encontrada='{result.get('valor', 'N/D')}' row_key='{result.get('row_key', 'N/D')}'"
        )
        return result

    def _load_quality_rules(self) -> List[Dict[str, Any]]:
        if self._quality_rules is not None:
            return self._quality_rules

        import json
        rules_path = VECTORSTORE_DIR / "quality_rules.json"
        if rules_path.exists():
            try:
                self._quality_rules = json.loads(rules_path.read_text(encoding="utf-8"))
                logger.info(f"IA documental: quality_rules cargado {len(self._quality_rules)} reglas desde {rules_path}")
            except Exception as exc:
                logger.warning(f"IA documental: error cargando quality_rules.json: {exc}")
                self._quality_rules = []
        else:
            logger.info("IA documental: quality_rules.json no encontrado, solo FAISS disponible")
            self._quality_rules = []
        return self._quality_rules

    def _find_structured_rule(self, question: str, product_override: str = "") -> Dict[str, Any]:
        """Busca la regla en quality_rules.json (primer nivel). Retorna found=True si existe.
        Si no hay grado detectado, devuelve todos los grados disponibles para la característica.
        """
        grade = self._detect_grade(question)
        feature = self._detect_defecto(question)
        doc_hints = self._detect_document_hints(question)
        detected_product = product_override or self._detect_product(question) or (next(iter(doc_hints), None) if doc_hints else None) or ""
        product_hint = self._infer_default_product(grade, detected_product, feature, "")

        logger.info(f"[INFO] Pregunta:\n{question}")
        logger.info(
            f"[INFO] Detectado:\nproducto={product_hint or 'N/A'}\ngrado={grade or 'N/A'}\natributo={feature or 'N/A'}"
        )

        logger.info(
            f"IA documental: find_structured_rule "
            f"grado='{grade or 'N/A'}' caracteristica='{feature or 'N/A'}' "
            f"producto_hint='{product_hint or 'N/A'}'"
        )

        if not feature:
            return {"found": False}

        rules = self._load_quality_rules()
        if not rules:
            return {"found": False}

        strict_candidates = self._strict_rule_candidates(
            rules=rules,
            product=product_hint,
            grade=grade,
            feature=feature,
        )
        logger.info(f"[INFO] Reglas candidatas:\n{len(strict_candidates)}")
        if not strict_candidates:
            return {"found": False}

        # Si hay grado específico, búsqueda directa
        if grade:
            result = qt_find_rule(
                grade=grade,
                feature=feature,
                rules=strict_candidates,
                prefer_recent=True,
                product_hint="",
            )
            if result.get("found"):
                logger.info(
                    f"[INFO] Regla seleccionada:\natributo={result.get('caracteristica', 'N/A')}\ngrado={result.get('grado', 'N/A')}"
                )
            logger.info(
                "IA documental: structured_result "
                f"grado_detectado='{grade}' caracteristica_detectada='{feature}' "
                f"found={result.get('found', False)} row_key={result.get('row_key', 'N/D')} "
                f"score={result.get('score', 0.0)}"
            )
            return result

        # Sin grado: buscar todos los grados disponibles para esa característica
        feature_n = self._normalize(feature)
        canonical_feature = feature
        for canon, synonyms in FEATURE_SYNONYMS.items():
            norm_syns = [self._normalize(s) for s in synonyms]
            if any(syn in feature_n for syn in norm_syns) or self._normalize(canon) in feature_n:
                canonical_feature = canon
                break

        feature_rules = [
            r for r in strict_candidates
            if self._normalize(r.get("caracteristica", "")) == self._normalize(canonical_feature)
        ]

        if not feature_rules:
            return {"found": False}

        # Agrupar por grado con la mejor regla
        grade_map: Dict[str, Dict[str, Any]] = {}
        for r in feature_rules:
            g = str(r.get("grado", "")).upper().strip()
            if not g:
                continue
            rule_text = r.get("regla", "")
            if g not in grade_map:
                grade_map[g] = {
                    "grado": g,
                    "reglas": [rule_text] if rule_text else [],
                    "fuente": r.get("fuente", "N/D"),
                    "version": r.get("version", "N/D"),
                }
            elif rule_text and rule_text not in grade_map[g]["reglas"]:
                grade_map[g]["reglas"].append(rule_text)

        if not grade_map:
            return {"found": False}

        first = next(iter(grade_map.values()))
        logger.info(
            f"IA documental: structured_result_multigrado caracteristica='{canonical_feature}' "
            f"grados_encontrados={list(grade_map.keys())}"
        )
        return {
            "found": True,
            "multi_grado": True,
            "grado": "",
            "caracteristica": canonical_feature,
            "grade_map": grade_map,
            "fuente": first.get("fuente", "N/D"),
            "version": first.get("version", "N/D"),
            "score": 0.9,
            "row_key": "multi",
        }

    def _requested_year(self, question: str) -> Optional[int]:
        m = re.search(r"\b(19\d{2}|20\d{2})\b", question)
        if not m:
            return None
        return int(m.group(1))

    def _is_noise_line(self, line: str) -> bool:
        n = self._normalize(line)
        if len(n.strip()) < 5:
            return True
        if any(h in n for h in NOISE_HINTS):
            return True
        if re.fullmatch(r"[\W_\d\s]+", n):
            return True
        return False

    def _clean_line(self, line: str) -> str:
        s = " ".join((line or "").split())
        s = re.sub(r"\bpagina\s*:?\s*\d+\s*(?:de\s*\d+)?\b", "", s, flags=re.IGNORECASE)
        s = re.sub(r"\bfecha\s*:?\s*\d{1,2}[\./-]\d{1,2}[\./-]\d{2,4}\b", "", s, flags=re.IGNORECASE)
        s = re.sub(r"\bcodigo\s*:?\s*\S+\b", "", s, flags=re.IGNORECASE)
        s = re.sub(r"\bversion\s*:?\s*\d+(?:[\.,]\d+)?\b", "", s, flags=re.IGNORECASE)
        s = re.sub(r"\s{2,}", " ", s).strip(" -•\t")
        s = re.sub(r"\s+,", ",", s)
        s = re.sub(r",\s*\.", ".", s)
        s = re.sub(r"\.{2,}", ".", s)
        return s.strip(" ,;")

    @staticmethod
    def _trim_fragment(text: str, max_len: int = 300) -> str:
        if not text:
            return ""
        s = " ".join(text.split())
        if len(s) <= max_len:
            return s
        return s[: max_len - 1].rstrip() + "..."

    @staticmethod
    def _extract_numeric_tokens(text: str) -> List[str]:
        tokens: List[str] = []
        src = text or ""
        for pattern in NUMERIC_PATTERNS:
            for match in pattern.findall(src):
                val = " ".join(str(match).split())
                if val and val not in tokens:
                    tokens.append(val)
        return tokens

    def _extract_grade_mentions(self, text: str) -> Set[str]:
        normalized = self._normalize(text)
        matches = re.findall(r"\b(?:col|cob|cop|coe)\b", normalized)
        return {m.upper() for m in matches}

    def _line_matches_grade(self, line: str, requested_grade: str, row_grades: Optional[List[str]] = None) -> bool:
        if row_grades:
            return requested_grade.upper() in {g.upper() for g in row_grades}

        mentions = self._extract_grade_mentions(line)
        if mentions:
            return requested_grade.upper() in mentions

        # Regla estricta: si no hay asociacion explicita de grado, descartar.
        return False

    def _is_header_like_row(self, cols: List[str]) -> bool:
        joined = self._normalize(" ".join(cols))
        grade_mentions = self._extract_grade_mentions(joined)
        if len(grade_mentions) >= 2:
            return True
        if "grado" in joined and grade_mentions:
            return True
        return False

    def _detect_table_row_feature(self, line: str) -> str:
        cols = [c.strip() for c in line.split("|")]
        if not cols:
            return ""
        first_col = self._normalize(cols[0])
        if not first_col:
            return ""

        ranked: List[Tuple[int, str]] = []
        for canon, aliases in DEFECT_MAP.items():
            for alias in aliases:
                alias_n = self._normalize(alias)
                if not alias_n:
                    continue
                if re.search(rf"\b{re.escape(alias_n)}\b", first_col):
                    ranked.append((len(alias_n), canon))

        if not ranked:
            return ""
        ranked.sort(key=lambda x: x[0], reverse=True)
        return ranked[0][1]

    def _split_table_block_by_feature(self, lines: List[str]) -> List[str]:
        if not lines:
            return []

        header_lines: List[str] = []
        row_chunks: List[str] = []
        current_rows: List[str] = []

        for line in lines:
            cols = [c.strip() for c in line.split("|")]
            if len(cols) < 2:
                continue

            if self._is_header_like_row(cols):
                header_lines.append(line)
                continue

            feature = self._detect_table_row_feature(line)
            if feature and current_rows:
                row_chunks.append("\n".join(header_lines + current_rows))
                current_rows = [line]
                continue

            current_rows.append(line)

        if current_rows:
            row_chunks.append("\n".join(header_lines + current_rows))

        return [c for c in row_chunks if c.strip()]

    def _build_column_grade_map(self, lines: List[str]) -> Dict[int, List[str]]:
        col_grade_map: Dict[int, Set[str]] = {}
        for line in lines:
            cols = [c.strip() for c in line.split("|")]
            if len(cols) < 2:
                continue
            if not self._is_header_like_row(cols):
                continue

            row_debug: Dict[int, List[str]] = {}
            for idx, col in enumerate(cols):
                mentions = self._extract_grade_mentions(col)
                if mentions:
                    col_grade_map.setdefault(idx, set()).update(mentions)
                    row_debug[idx] = sorted(list(mentions))
            if row_debug:
                logger.info(f"IA documental: grados_detectados_encabezado={row_debug}")

        return {k: sorted(list(v)) for k, v in col_grade_map.items()}

    def _split_text(self, text: str, chunk_size: int = 850, overlap: int = 0) -> List[str]:
        blocks = [b.strip() for b in re.split(r"\n\s*\n", text or "") if b.strip()]
        chunks: List[str] = []

        for block in blocks:
            lines = [self._clean_line(x) for x in block.splitlines()]
            lines = [x for x in lines if x and not self._is_noise_line(x)]
            if not lines:
                continue

            # Bloques tipo tabla se separan por fila/caracteristica para evitar
            # mezclar defectos dentro del mismo chunk.
            if any("|" in x for x in lines):
                table_rows = self._split_table_block_by_feature(lines)
                chunks.extend(table_rows if table_rows else ["\n".join(lines)])
                continue

            # Listas numeradas se mantienen juntas.
            if any(re.match(r"^\d+[\.)]", x) for x in lines):
                chunks.append("\n".join(lines))
                continue

            current = ""
            for line in lines:
                candidate = f"{current} {line}".strip() if current else line
                if len(candidate) <= chunk_size:
                    current = candidate
                else:
                    if current:
                        chunks.append(current)
                    current = line
            if current:
                chunks.append(current)

        if len(chunks) < 3:
            clean = " ".join((text or "").split())
            if clean:
                start = 0
                n = len(clean)
                while start < n:
                    end = min(n, start + chunk_size)
                    chunk = clean[start:end].strip()
                    if chunk:
                        chunks.append(chunk)
                    if end == n:
                        break
                    start = end if overlap <= 0 else max(end - overlap, 0)

        seen: Set[str] = set()
        deduped: List[str] = []
        for chunk in chunks:
            key = self._normalize(chunk)
            if key in seen:
                continue
            seen.add(key)
            deduped.append(chunk)
        return deduped

    @lru_cache(maxsize=100)
    def _cached_query_embedding(self, normalized_question: str) -> np.ndarray:
        model = self._get_model()
        return model.encode([normalized_question], convert_to_numpy=True, show_progress_bar=False)[0]

    @lru_cache(maxsize=100)
    def _cached_semantic_search(self, normalized_question: str, top_k: int) -> Tuple[Dict[str, Any], ...]:
        embedding = self._cached_query_embedding(normalized_question)
        evidencias = self.store.search(embedding, top_k=top_k)
        return tuple(dict(ev) for ev in evidencias)

    def _table_cell_rule(self, fragment: str, grade: str, defect_terms: List[str]) -> List[Dict[str, Any]]:
        lines = [self._clean_line(x) for x in fragment.splitlines()]
        lines = [x for x in lines if x]
        if not lines or not any("|" in x for x in lines):
            return []

        col_grade_map = self._build_column_grade_map(lines)
        target_cols = [idx for idx, grades in col_grade_map.items() if grade.upper() in grades]

        if not target_cols:
            logger.info(
                "IA documental: tabla_descartada_sin_columna_grado "
                f"grado={grade} fragmento={self._trim_fragment(fragment, max_len=120)}"
            )
            return []

        logger.info(
            "IA documental: bloque_asociado_tabla "
            f"grado_consultado={grade} columnas_objetivo={target_cols} mapa={col_grade_map}"
        )

        rules: List[Dict[str, Any]] = []
        active_defect = False
        for line in lines:
            cols = [c.strip() for c in line.split("|")]
            if len(cols) < 2:
                continue

            row_joined = self._normalize(" ".join(cols))
            if defect_terms and any(t in row_joined for t in defect_terms):
                active_defect = True

            if self._is_header_like_row(cols):
                continue

            if not active_defect and defect_terms and not any(t in row_joined for t in defect_terms):
                continue

            for idx in target_cols:
                if len(cols) <= idx:
                    continue
                grades_for_col = col_grade_map.get(idx, [grade])
                cell = self._clean_line(cols[idx])
                if not cell:
                    continue

                cell_parts = self._explode_rule_cell(cell)
                cell_defect_on = False
                for part in cell_parts:
                    n_part = self._normalize(part)
                    if defect_terms and any(t in n_part for t in defect_terms):
                        cell_defect_on = True

                    if not self._extract_numeric_tokens(part):
                        continue
                    if self._line_has_foreign_defect(part, defect_terms):
                        continue
                    if defect_terms and not cell_defect_on and not any(t in n_part for t in defect_terms):
                        continue

                    rule_item = {"grados": grades_for_col, "regla": part}
                    rules.append(rule_item)
                    logger.info(
                        "IA documental: grados_asociados_regla "
                        f"grado_consultado={grade} grados_regla={grades_for_col} regla={self._trim_fragment(part, 140)}"
                    )
        return rules

    def _explode_rule_cell(self, cell: str) -> List[str]:
        text = self._clean_line(cell)
        if not text:
            return []

        # Divide "1. ... 2. ... 3. ..." en reglas separadas.
        numbered = re.split(r"\s+(?=\d+[\.)]\s)", text)
        out: List[str] = []
        for chunk in numbered:
            cleaned = self._clean_line(chunk)
            if not cleaned:
                continue
            out.append(cleaned)
        return out if out else [text]

    def _line_has_foreign_defect(self, line: str, defect_terms: List[str]) -> bool:
        n = self._normalize(line)
        allowed = set(defect_terms)
        for hint in FOREIGN_DEFECT_HINTS:
            if hint in n and hint not in allowed:
                return True
        return False

    def _extract_exact_rule_lines(self, fragment: str, grade: str, defect_terms: List[str]) -> List[Dict[str, Any]]:
        rules = self._table_cell_rule(fragment, grade, defect_terms)
        if rules:
            return [r for r in rules if not self._line_has_foreign_defect(r.get("regla", ""), defect_terms)]

        cleaned_lines = [self._clean_line(x) for x in fragment.splitlines()]
        cleaned_lines = [x for x in cleaned_lines if x and not self._is_noise_line(x)]

        extracted: List[Dict[str, Any]] = []
        active_defect = False

        for line in cleaned_lines:
            n = self._normalize(line)
            has_defect = any(t in n for t in defect_terms) if defect_terms else False
            has_grade = bool(grade and re.search(rf"\b{re.escape(grade.lower())}\b", n))
            has_numeric = bool(self._extract_numeric_tokens(line))
            is_numbered = bool(re.match(r"^\d+[\.)]", line))

            if has_defect:
                active_defect = True

            if not has_numeric:
                if has_defect:
                    active_defect = True
                continue

            if has_defect:
                extracted.append({"grados": [grade] if has_grade else [], "regla": line})
                continue

            if active_defect and (is_numbered or any(k in n for k in ["maximo", "minimo", "hasta", "%", "mm", "x"])):
                extracted.append({"grados": [grade] if has_grade else [], "regla": line})
                continue

            if has_grade and defect_terms:
                extracted.append({"grados": [grade], "regla": line})

        # Dedup + solo lineas numericas directas.
        out: List[Dict[str, Any]] = []
        seen: Set[str] = set()
        for item in extracted:
            line = item.get("regla", "")
            if self._line_has_foreign_defect(line, defect_terms):
                continue
            key = self._normalize(line)
            if key in seen:
                continue
            seen.add(key)
            out.append(item)
        return out

    def _hybrid_candidates(self, question: str, requested_top_k: int = 3) -> List[Dict[str, Any]]:
        t0 = time.perf_counter()
        normalized = self._normalize(question)
        query_terms = self._query_terms(question)
        grade = self._detect_grade(question)
        defect = self._detect_defecto(question)
        defect_terms = DEFECT_MAP.get(defect, [])
        doc_hints = self._detect_document_hints(question)

        semantic = [dict(x) for x in self._cached_semantic_search(normalized, max(3, requested_top_k))]
        items = self.store.get_items()

        lexical_ranked: List[Tuple[float, Dict[str, Any]]] = []
        for item in items:
            doc_name = str(item.get("documento", ""))
            doc_norm = self._normalize(doc_name)
            hint_match = bool(doc_hints and any(h in doc_norm for h in doc_hints))

            fragment = str(item.get("fragmento", ""))
            if not fragment:
                continue
            nfrag = self._normalize(fragment)
            score = 0.0

            overlap = len([qt for qt in query_terms if qt in nfrag])
            score += overlap * 0.25

            if defect_terms and any(t in nfrag for t in defect_terms):
                score += 0.45
            if grade and re.search(rf"\b{re.escape(grade.lower())}\b", nfrag):
                score += 0.35

            numeric = self._extract_numeric_tokens(fragment)
            if numeric:
                score += 0.2

            if any(k in nfrag for k in ["maximo", "minimo", "hasta", "largo", "mm", "%", " x "]):
                score += 0.1

            if hint_match:
                score += 0.2

            if score <= 0.0:
                continue

            row = dict(item)
            row["base_score"] = float(row.get("base_score", 0.0))
            row["score"] = score
            row["search_mode"] = "lexical"
            lexical_ranked.append((score, row))

        lexical_ranked.sort(key=lambda x: x[0], reverse=True)
        lexical = [x[1] for x in lexical_ranked[:8]]

        merged: List[Dict[str, Any]] = []
        seen: Set[str] = set()

        for row in semantic:
            doc_norm = self._normalize(str(row.get("documento", "")))
            hint_match = bool(doc_hints and any(h in doc_norm for h in doc_hints))
            row["search_mode"] = "semantic"
            if hint_match:
                row["score"] = float(row.get("score", 0.0) or 0.0) + 0.2
            key = f"{row.get('documento','')}::{self._normalize(str(row.get('fragmento','')))[:240]}"
            if key in seen:
                continue
            seen.add(key)
            merged.append(row)

        for row in lexical:
            key = f"{row.get('documento','')}::{self._normalize(str(row.get('fragmento','')))[:240]}"
            if key in seen:
                continue
            seen.add(key)
            merged.append(row)

        # Rerank final con prioridad vigente/exacta.
        ask_historical = any(h in normalized for h in HISTORICAL_HINTS)
        requested_year = self._requested_year(question)
        max_year = max([int(x.get("doc_year") or 0) for x in merged] or [0])

        reranked: List[Dict[str, Any]] = []
        descartados: List[str] = []
        for row in merged:
            fragment = str(row.get("fragmento", ""))
            text = f"{row.get('documento','')} {fragment}".strip()
            ntext = self._normalize(text)
            year = int(row.get("doc_year") or self._extract_year(text) or 0)
            version_value = float(row.get("doc_version_value") or self._extract_version_value(text) or 0.0)
            vigente = bool(row.get("norma_vigente") or (year and year == max_year))

            score = float(row.get("base_score", row.get("score", 0.0)) or 0.0)
            if defect_terms and any(t in ntext for t in defect_terms):
                score += 0.55
            if grade and re.search(rf"\b{re.escape(grade.lower())}\b", ntext):
                score += 0.4
            if self._extract_numeric_tokens(fragment):
                score += 0.25

            if requested_year:
                if year == requested_year:
                    score += 0.9
                else:
                    score -= 0.5
            elif not ask_historical and max_year and year and year < max_year:
                score -= 1.2
                descartados.append(str(row.get("documento", "N/D")))

            if max_year and year == max_year:
                score += 0.45
            if version_value:
                score += version_value / 1000.0

            out = dict(row)
            out["doc_year"] = year
            out["doc_version_value"] = version_value
            out["norma_vigente"] = vigente
            out["score"] = float(score)
            reranked.append(out)

        reranked.sort(key=lambda x: float(x.get("score", 0.0)), reverse=True)
        candidate_preview = [
            {
                "doc": r.get("documento", "N/D"),
                "score": round(float(r.get("score", 0.0)), 4),
                "mode": r.get("search_mode", "N/A"),
            }
            for r in reranked[:6]
        ]
        logger.info(
            "IA documental: candidatos_hibridos "
            f"pregunta='{question}' grado='{grade or 'N/A'}' defecto='{defect or 'N/A'}' "
            f"max_year={max_year} descartados={list(set(descartados))[:6]} top={candidate_preview} "
            f"tiempo={time.perf_counter() - t0:.3f}s"
        )

        return reranked

    def find_exact_quality_rule(self, question: str) -> Dict[str, Any]:
        grade = self._detect_grade(question)
        defecto = self._detect_defecto(question)
        defect_terms = DEFECT_MAP.get(defecto, [])

        logger.info(
            "IA documental: pregunta_recibida "
            f"pregunta='{question}' grado_detectado='{grade or 'N/A'}' defecto_detectado='{defecto or 'N/A'}'"
        )

        if not grade or not defecto:
            return {
                "found": False,
                "respuesta": "No encontre una regla exacta para ese grado y defecto en la norma vigente cargada.",
                "evidencias": [],
                "fuente_principal": "N/D",
                "version_utilizada": "N/D",
                "norma_vigente": False,
                "defecto": defecto,
                "grado": grade,
                "reglas": [],
            }

        candidates = self._hybrid_candidates(question, requested_top_k=3)

        rules: List[Dict[str, Any]] = []
        used_evidence: List[Dict[str, Any]] = []
        selected_doc = "N/D"
        selected_year = 0
        discarded_by_grade: List[str] = []

        for cand in candidates:
            fragment = str(cand.get("fragmento", ""))
            cand_doc = str(cand.get("documento", "N/D"))

            # Evita mezclar defectos/versiones entre documentos cuando ya hay un ganador.
            if selected_doc != "N/D" and cand_doc != selected_doc:
                continue

            extracted = self._extract_exact_rule_lines(fragment, grade, defect_terms)
            if not extracted:
                continue

            doc = cand_doc
            year = int(cand.get("doc_year") or self._extract_year(doc))

            cand_grade_mentions = self._extract_grade_mentions(fragment)
            logger.info(
                "IA documental: candidato_grado "
                f"doc='{doc}' grados_detectados={sorted(list(cand_grade_mentions)) if cand_grade_mentions else ['N/A']}"
            )

            for item in extracted:
                line = item.get("regla", "")
                row_grades = item.get("grados", []) or []
                clean = self._clean_line(line)
                if not clean:
                    continue
                if self._is_noise_line(clean):
                    continue

                if not self._line_matches_grade(clean, grade, row_grades=row_grades):
                    discarded_by_grade.append(clean)
                    continue

                if all(self._normalize(clean) != self._normalize(x.get("regla", "")) for x in rules):
                    rules.append({"grados": row_grades if row_grades else [grade], "regla": clean})

            if fragment and all(self._normalize(fragment) != self._normalize(ev.get("fragmento", "")) for ev in used_evidence):
                used_evidence.append(
                    {
                        "documento": doc,
                        "fragmento": self._trim_fragment(fragment, max_len=300),
                        "score": float(cand.get("score", 0.0)),
                    }
                )

            if selected_doc == "N/D":
                selected_doc = doc
                selected_year = year

            if len(rules) >= 4:
                break

        # Dedup reglas y filtrar no numericas.
        dedup_rules: List[str] = []
        seen_rules: Set[str] = set()
        for rule_item in rules:
            rule = rule_item.get("regla", "")
            key = self._normalize(rule)
            if key in seen_rules:
                continue
            seen_rules.add(key)
            if not self._extract_numeric_tokens(rule):
                continue
            dedup_rules.append(rule)

        numeric_found = []
        for r in dedup_rules:
            numeric_found.extend(self._extract_numeric_tokens(r))

        logger.info(
            "IA documental: extraccion_regla "
            f"documento_seleccionado='{selected_doc}' version_seleccionada='{selected_year or 'N/D'}' "
            f"reglas_descartadas_por_grado={len(discarded_by_grade)} "
            f"fragmentos_candidatos={len(candidates)} valores_encontrados={numeric_found[:12]} "
            f"regla_final={dedup_rules[:3]}"
        )

        if not dedup_rules:
            return {
                "found": False,
                "respuesta": f"No encontre una regla exacta para {defecto} en grado {grade} dentro de la norma vigente cargada.",
                "evidencias": used_evidence[:2],
                "fuente_principal": selected_doc,
                "version_utilizada": self._version_text(selected_year, 0.0),
                "norma_vigente": bool(selected_year),
                "defecto": defecto,
                "grado": grade,
                "reglas": [],
                "rule_struct": {
                    "grados": [grade],
                    "defecto": defecto,
                    "reglas": [],
                    "fuente": selected_doc,
                    "version": self._version_text(selected_year, 0.0),
                },
            }

        title = f"{grade} acepta {defecto}:"
        bullets = "\n".join([f"• {line.rstrip('.')}." for line in dedup_rules[:3]])
        fuente = selected_doc.rsplit(".", 1)[0] if selected_doc and selected_doc != "N/D" else "Norma vigente"

        return {
            "found": True,
            "respuesta": f"{title}\n\n{bullets}\n\nFuente: {fuente}.",
            "evidencias": used_evidence[:2],
            "fuente_principal": selected_doc,
            "version_utilizada": self._version_text(selected_year, 0.0),
            "norma_vigente": True,
            "defecto": defecto,
            "grado": grade,
            "reglas": dedup_rules[:3],
            "rule_struct": {
                "grados": [grade],
                "defecto": defecto,
                "reglas": dedup_rules[:3],
                "fuente": selected_doc,
                "version": self._version_text(selected_year, 0.0),
            },
        }

    def _compose_chat_response(self, question: str, evidencias: List[Dict[str, Any]]) -> str:
        points: List[str] = []
        for ev in evidencias:
            fragment = str(ev.get("fragmento", ""))
            for sentence in re.split(r"(?<=[\.;:])\s+", " ".join(fragment.split())):
                s = self._clean_line(sentence)
                if not s or self._is_noise_line(s):
                    continue
                if self._extract_numeric_tokens(s):
                    points.append(self._trim_fragment(s, max_len=140))
                if len(points) >= 2:
                    break
            if len(points) >= 2:
                break

        if not points:
            return "No encontre una regla exacta para ese grado y defecto en la norma vigente cargada."
        return "\n".join([f"• {p}" for p in points])

    def rebuild_index(self) -> Dict[str, Any]:
        t0 = time.perf_counter()
        logger.info(f"Buscando documentos en: {DOCUMENTS_DIR}")
        docs = document_loader.cargar_documentos()
        if not docs:
            raise FileNotFoundError(f"No hay documentos validos para indexar en {DOCUMENTS_DIR}.")

        doc_meta: Dict[str, Dict[str, Any]] = {}
        global_latest_year = 0

        for doc in docs:
            name = doc["documento"]
            text = doc["texto"]
            year = max(self._extract_year(name), self._extract_year(text[:6000]))
            version_value = max(self._extract_version_value(name), self._extract_version_value(text[:6000]))
            has_vigente = "vigente" in self._normalize(f"{name} {text[:3000]}")

            doc_meta[name] = {
                "doc_year": year,
                "doc_version_value": version_value,
                "has_vigente_word": has_vigente,
            }
            if year > global_latest_year:
                global_latest_year = year

        all_chunks: List[Dict[str, Any]] = []
        for doc in docs:
            chunks = self._split_text(doc["texto"], chunk_size=850, overlap=0)
            for chunk in chunks:
                meta = doc_meta[doc["documento"]]
                numeric_tokens = self._extract_numeric_tokens(chunk)
                all_chunks.append(
                    {
                        "documento": doc["documento"],
                        "fragmento": chunk,
                        "doc_year": meta["doc_year"],
                        "doc_version_value": meta["doc_version_value"],
                        "norma_vigente": bool(meta["has_vigente_word"] or (global_latest_year and meta["doc_year"] == global_latest_year)),
                        "chunk_terms": self._chunk_terms(chunk),
                        "chunk_numeric": bool(numeric_tokens),
                        "chunk_numeric_tokens": numeric_tokens,
                    }
                )

        if not all_chunks:
            raise ValueError("Los documentos estan vacios o no se pudieron fragmentar.")

        model = self._get_model()
        texts = [row["fragmento"] for row in all_chunks]
        t_embed = time.perf_counter()
        embeddings = model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
        logger.info(f"IA documental: reconstruccion_embeddings_tiempo={time.perf_counter() - t_embed:.3f}s")

        if not isinstance(embeddings, np.ndarray) or embeddings.size == 0:
            raise ValueError("No fue posible generar embeddings.")

        self.store.clear()
        stats = self.store.save(embeddings, all_chunks)
        self.store.preload(force=True)
        self._cached_query_embedding.cache_clear()
        self._cached_semantic_search.cache_clear()

        # Extraer reglas estructuradas de calidad desde tablas PDF
        try:
            struct_rules = build_quality_rules()
            self._quality_rules = struct_rules
            logger.info(f"IA documental: reglas_estructuradas_reconstruidas total={len(struct_rules)}")
        except Exception as exc:
            logger.warning(f"IA documental: error extrayendo reglas estructuradas: {exc}")

        logger.info(
            "IA documental: reconstruccion_completa "
            f"tiempo_total={time.perf_counter() - t0:.3f}s docs={len(docs)} chunks={len(all_chunks)} memoria_mb={self._memory_usage_mb()}"
        )

        return {
            "ruta_documentos": str(DOCUMENTS_DIR),
            "archivos_detectados": [doc["documento"] for doc in docs],
            "documentos": len(docs),
            "fragmentos": len(all_chunks),
            **stats,
        }

    def consultar(self, pregunta: str, top_k: int = 5) -> Dict[str, Any]:
        if not pregunta or not pregunta.strip():
            raise ValueError("La consulta esta vacia.")

        if not self.store.exists():
            raise FileNotFoundError("Indice inexistente. Ejecute /indice/reconstruir primero.")

        total_start = time.perf_counter()
        pregunta_clean = pregunta.strip()
        approx_struct_response: Optional[Dict[str, Any]] = None
        classification = self.classify_question(pregunta_clean)

        if classification.get("requiere_aclaracion"):
            clarification = self._build_clarification_response(classification)
            logger.info(
                "IA documental: respuesta_aclaracion "
                f"pregunta='{pregunta_clean}'"
            )
            return clarification

        if classification.get("tipo_consulta") == "producto_general":
            product_summary = self._build_product_general_summary(classification)
            product = classification.get("producto", "")

            if not product_summary.get("found"):
                return self._response_with_next_step(
                    main_text=f"No encontré normas asociadas a {product or 'ese producto'}.",
                    source="N/D",
                    version="N/D",
                    next_step="prueba con otro nombre comercial o agrega el grado",
                )

            productos = product_summary.get("productos", [])
            normas = product_summary.get("normas", [])
            grados = product_summary.get("grados", [])
            caracteristicas = product_summary.get("caracteristicas", [])
            atributos = product_summary.get("atributos", [])

            bullets_normas = "\n".join([f"• {p.get('producto', 'N/D')} versión {p.get('version', 'N/D')}" for p in productos]) if productos else "• N/D"
            bullets_grados = "\n".join([f"• {g}" for g in grados]) if grados else "• N/D"
            bullets_caracts = "\n".join([f"• {c}" for c in (caracteristicas[:10] or [])]) if caracteristicas else "• N/D"
            bullets_attrs = "\n".join([f"• {a}" for a in (atributos[:6] or [])]) if atributos else "• N/D"

            respuesta = (
                f"Sí, encontré referencias para {product}.\n"
                f"Normas: {', '.join(self._shorten_list(normas, 3)) or 'N/D'}\n"
                f"Grados: {', '.join(self._shorten_list(grados, 4)) or 'N/D'}\n"
                f"Características: {', '.join(self._shorten_list(caracteristicas, 4)) or 'N/D'}\n"
                f"Tolerancias: {', '.join(self._shorten_list(atributos, 3)) or 'N/D'}"
            )

            fuente = normas[0] if normas else "N/D"
            version_utilizada = "N/D"
            for p in productos:
                if p.get("version") and p.get("version") != "N/D":
                    version_utilizada = p.get("version")
                    break

            logger.info(
                "IA documental: respuesta_final_producto_general "
                f"tipo_consulta='producto_general' producto_detectado='{product}' grado_detectado='{classification.get('grado') or 'N/A'}' "
                f"caracteristica_detectada='{classification.get('caracteristica') or 'N/A'}' norma_seleccionada='{fuente}' "
                f"tiempo={time.perf_counter()-total_start:.3f}s"
            )

            return self._response_with_next_step(
                main_text=respuesta,
                source=fuente,
                version=version_utilizada,
                next_step=f"pregunta por una regla concreta, por ejemplo: nudo muerto {product} COL",
                norma_vigente=True,
            )

        if classification.get("categoria") == "grado_general":
            grade_summary = self._build_grade_general_summary(classification)
            grade = classification.get("grado", "")

            if not grade_summary.get("found"):
                return self._response_with_next_step(
                    main_text=f"No encontré información general del grado {grade or 'N/D'}.",
                    source="N/D",
                    version="N/D",
                    next_step="intenta agregar el producto o un defecto específico",
                )

            productos = grade_summary.get("productos", [])
            normas = grade_summary.get("normas", [])
            caracteristicas = grade_summary.get("caracteristicas", [])
            atributos = grade_summary.get("atributos", [])

            bullets_productos = "\n".join([f"• {p.get('producto', 'N/D')}" for p in productos]) if productos else "• N/D"

            limites: List[str] = []
            for x in caracteristicas[:8]:
                if x not in limites:
                    limites.append(x)
            for x in atributos[:4]:
                if x not in limites:
                    limites.append(x)
            bullets_limites = "\n".join([f"• {x}" for x in limites]) if limites else "• No se detectaron atributos específicos en las normas cargadas"

            grade_u = grade_summary.get("grado", grade).upper()
            respuesta = (
                f"Grado {grade_u} encontrado.\n"
                f"Normas: {', '.join(self._shorten_list(normas, 3)) or 'N/D'}\n"
                f"Productos asociados: {', '.join(self._shorten_list([p.get('producto', 'N/D') for p in productos], 4)) or 'N/D'}\n"
                f"Límites detectados: {', '.join(self._shorten_list(limites, 5)) or 'N/D'}"
            )

            fuente = normas[0] if normas else "N/D"
            version_utilizada = "N/D"
            for p in productos:
                if p.get("version") and p.get("version") != "N/D":
                    version_utilizada = p.get("version")
                    break

            logger.info(
                "IA documental: respuesta_final_grado_general "
                f"categoria_detectada='grado_general' grado_detectado='{grade_u}' "
                f"productos_asociados={productos} normas_encontradas={normas[:10]} "
                f"tiempo={time.perf_counter()-total_start:.3f}s"
            )

            return self._response_with_next_step(
                main_text=respuesta,
                source=fuente,
                version=version_utilizada,
                next_step=f"pregunta por una regla concreta, por ejemplo: canto muerto {grade_u}",
                norma_vigente=True,
            )

        if classification.get("tipo_consulta") == "tolerancia" or classification.get("categoria") == "tolerancia":
            tol = self._find_structured_tolerance(classification)
            if tol.get("found"):
                atributo = tol.get("atributo", "")
                grado = tol.get("grado", "")
                producto = classification.get("producto", "")
                valor = tol.get("valor", "")
                fuente_raw = tol.get("fuente", "Norma vigente")
                version = tol.get("version", "N/D")
                fuente_display = "Norma Selección China vigente" if producto == "CHINA" else fuente_raw.rsplit(".", 1)[0]
                # Si hay múltiples grados, formateamos listado
                multi = tol.get("multi_grados", [])
                if multi and not grado:
                    lineas = "\n".join(f"• {item['grado']}: {item['valor']}" for item in multi)
                    respuesta = f"Tolerancias de {atributo}{' ' + producto if producto else ''}:\n{lineas}"
                else:
                    respuesta = f"Tolerancia {atributo}{' ' + producto if producto else ''}{' ' + grado if grado else ''}: {valor}"
                logger.info(
                    "IA documental: respuesta_final_tolerancia "
                    f"categoria_detectada='tolerancias' atributo='{atributo}' producto='{producto}' grado='{grado}' "
                    f"tabla='{tol.get('table_title', 'N/D')}' celda='{valor}' "
                    f"tiempo={time.perf_counter()-total_start:.3f}s"
                )
                return self._response_with_next_step(
                    main_text=respuesta,
                    source=fuente_raw,
                    version=version,
                    next_step="si quieres, te muestro la tabla completa",
                    norma_vigente=True,
                )

            # Regla pedida: no usar similitud general cuando hay coincidencia
            # exacta de categoria/atributo en modo tolerancias.
            return {
                "respuesta": "No encontré una celda exacta para esa tolerancia.\n\nPróximo paso: agrega producto o grado si lo tienes.",
                "fuente_principal": "N/D",
                "version_utilizada": "N/D",
                "norma_vigente": False,
                "evidencias": [],
            }

        # ── Nivel 1: reglas estructuradas (quality_rules.json) ──────────────────
        product_override = classification.get("producto", "")
        struct_result = self._find_structured_rule(pregunta_clean, product_override=product_override)
        if struct_result.get("found"):
            feature_detected = self._detect_defecto(pregunta_clean)
            feature_display = struct_result.get("caracteristica", "regla")
            grade = struct_result.get("grado", "")
            reglas = struct_result.get("reglas", [])
            aproximada = bool(struct_result.get("aproximada", False))

            if feature_detected and self._normalize(feature_display) != self._normalize(feature_detected):
                logger.warning(
                    "IA documental: regla_descartada_por_mezcla_caracteristica "
                    f"caracteristica_detectada='{feature_detected}' caracteristica_respuesta='{feature_display}' "
                    f"grado_detectado='{grade}'"
                )
                struct_result = {"found": False}

        if struct_result.get("found"):
            feature_display = struct_result.get("caracteristica", "regla")
            grade = struct_result.get("grado", "")
            reglas = struct_result.get("reglas", [])
            aproximada = bool(struct_result.get("aproximada", False))
            fuente_raw = struct_result.get("fuente", "Norma vigente")
            fuente_display = fuente_raw.rsplit(".", 1)[0] if fuente_raw and fuente_raw != "N/D" else "Norma vigente"
            version = struct_result.get("version", "N/D")

            # Respuesta multi-grado (cuando no se especificó grado)
            if struct_result.get("multi_grado"):
                grade_map = struct_result.get("grade_map", {})
                seccion_producto = f" ({product_override})" if product_override else ""
                lineas: List[str] = []
                for g, gdata in grade_map.items():
                    regla_texto = gdata["reglas"][0] if gdata.get("reglas") else "Sin detalle"
                    lineas.append(f"• {g}: {regla_texto.rstrip('.')}")
                respuesta = (
                    f"Reglas de {feature_display}{seccion_producto} por grado:\n\n"
                    + "\n".join(lineas)
                    + f"\n\nFuente: {fuente_display} ({version})."
                )
                logger.info(
                    f"IA documental: respuesta_via_multigrado "
                    f"caracteristica={feature_display} grados={list(grade_map.keys())} "
                    f"tiempo={time.perf_counter()-total_start:.3f}s"
                )
                return {
                    "respuesta": respuesta + "\n\nPróximo paso: pide la regla puntual si quieres más detalle.",
                    "fuente_principal": fuente_raw,
                    "version_utilizada": version,
                    "norma_vigente": True,
                    "evidencias": [],
                }

            bullets = "\n".join([f"• {r.rstrip('.')}." for r in reglas]) if reglas else "Sin detalle disponible."
            nota = "\n\nNota: no hay celda explicita para ese grado; se reporta criterio compartido de la misma caracteristica." if aproximada else ""
            respuesta = f"{grade} acepta {feature_display}:\n\n{bullets}{nota}\n\nFuente: {fuente_display} ({version})."

            if aproximada:
                # Guardar como respaldo y continuar a FAISS para intentar una
                # evidencia exacta mas específica.
                approx_struct_response = {
                    "respuesta": respuesta,
                    "fuente_principal": fuente_raw,
                    "version_utilizada": version,
                    "norma_vigente": True,
                    "evidencias": [],
                }
            else:
                logger.info(
                    f"IA documental: respuesta_via_reglas_estructuradas "
                    f"grado={grade} caracteristica={feature_display} "
                    f"reglas={len(reglas)} aproximada={aproximada} fuente={fuente_raw} version={version} "
                    f"tiempo={time.perf_counter()-total_start:.3f}s"
                )
                return {
                    "respuesta": respuesta + "\n\nPróximo paso: pide la regla puntual si quieres más detalle.",
                    "fuente_principal": fuente_raw,
                    "version_utilizada": version,
                    "norma_vigente": True,
                    "evidencias": [],
                }

        if (
            classification.get("tipo_consulta") == "regla_defecto"
            and classification.get("defecto")
            and classification.get("grado")
        ):
            producto = classification.get("producto", "") or "N/D"
            grado = classification.get("grado", "") or "N/D"
            atributo = classification.get("defecto", "") or "N/D"
            logger.info(
                "IA documental: sin_match_estricto_regla_defecto "
                f"producto='{producto}' grado='{grado}' atributo='{atributo}'"
            )
            return {
                "respuesta": "No encontré una regla exacta.\n\nPróximo paso: agrega el producto o prueba con una redacción más simple.",
                "fuente_principal": "N/D",
                "version_utilizada": "N/D",
                "norma_vigente": False,
                "evidencias": [],
            }

        # ── Nivel 2: búsqueda exacta texto/tabla (FAISS + léxico) ───────────────
        result = self.find_exact_quality_rule(pregunta_clean)

        if not result.get("found"):
            fuzzy = self._fallback_fuzzy_response(pregunta_clean, classification, top_k=top_k)
            if fuzzy:
                return fuzzy

        if result.get("found"):
            response = {
                "respuesta": result["respuesta"],
                "fuente_principal": result.get("fuente_principal", "N/D"),
                "version_utilizada": result.get("version_utilizada", "N/D"),
                "norma_vigente": result.get("norma_vigente", False),
                "evidencias": (result.get("evidencias") or [])[:2],
            }
        elif approx_struct_response is not None:
            response = approx_struct_response
        else:
            response = {
                "respuesta": result.get("respuesta", "No encontré una regla exacta."),
                "fuente_principal": result.get("fuente_principal", "N/D"),
                "version_utilizada": result.get("version_utilizada", "N/D"),
                "norma_vigente": result.get("norma_vigente", False),
                "evidencias": (result.get("evidencias") or [])[:2],
            }

        logger.info(
            "IA documental: consulta_perfil "
            f"tiempo_total={time.perf_counter() - total_start:.3f}s chunks_usados={len(response.get('evidencias', []))} "
            f"documentos_usados={len({x.get('documento') for x in response.get('evidencias', [])})} "
            f"documento_ganador={response.get('fuente_principal','N/D')} memoria_mb={self._memory_usage_mb()}"
        )

        return response

    def _fallback_fuzzy_response(self, question: str, classification: Dict[str, str], top_k: int = 5) -> Optional[Dict[str, Any]]:
        if not self.store.exists():
            return None

        qn = self._normalize(question)
        evidencias = list(self._cached_semantic_search(qn, max(1, top_k)))
        if not evidencias:
            return None

        best = evidencias[0]
        fragment = self._trim_fragment(str(best.get("fragmento", "")), max_len=260)
        documento = str(best.get("documento", "N/D"))
        grado = classification.get("grado", "") or self._detect_grade(question)
        defecto = classification.get("defecto", "") or self._detect_defecto(question)
        producto = classification.get("producto", "") or self._detect_product(question)

        response_text = "Encontré una coincidencia cercana."
        if defecto and grado:
            response_text = f"Encontré una referencia cercana para {defecto} en {grado}."
        elif producto:
            response_text = f"Encontré una referencia cercana para {producto}."
        elif grado:
            response_text = f"Encontré una referencia cercana para {grado}."

        return {
            "respuesta": (
                f"{response_text}\n\n"
                f"Referencia:\n• {fragment}\n\n"
                "Si quieres, reformulo la búsqueda con más precisión."
            ),
            "fuente_principal": documento,
            "version_utilizada": self._version_text(int(best.get("doc_year") or 0), float(best.get("doc_version_value") or 0.0)),
            "norma_vigente": bool(best.get("norma_vigente", False)),
            "evidencias": evidencias[:2],
        }


rag_service = RAGService()

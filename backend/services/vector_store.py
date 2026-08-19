import json
from typing import Dict, List

import numpy as np
from loguru import logger

from services.ia_paths import VECTORSTORE_DIR


class VectorStore:
    def __init__(self) -> None:
        self.base_path = VECTORSTORE_DIR
        self.base_path.mkdir(parents=True, exist_ok=True)

        self.index_path = self.base_path / "index.faiss"
        self.metadata_path = self.base_path / "metadata.json"
        self._index = None
        self._items: List[Dict] = []
        self._index_mtime = 0.0
        self._metadata_mtime = 0.0

    def _load_faiss(self):
        try:
            import faiss  # type: ignore
        except Exception as exc:
            raise RuntimeError("faiss-cpu no está instalado.") from exc
        return faiss

    def save(self, embeddings: np.ndarray, metadata: List[Dict]) -> Dict[str, int]:
        if embeddings.size == 0:
            raise ValueError("No hay embeddings para persistir.")

        faiss = self._load_faiss()

        emb = embeddings.astype("float32")
        faiss.normalize_L2(emb)

        dim = emb.shape[1]
        index = faiss.IndexFlatIP(dim)
        index.add(emb)

        faiss.write_index(index, str(self.index_path))
        self.metadata_path.write_text(
            json.dumps({"items": metadata}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        self._index = index
        self._items = list(metadata)
        self._index_mtime = self.index_path.stat().st_mtime if self.index_path.exists() else 0.0
        self._metadata_mtime = self.metadata_path.stat().st_mtime if self.metadata_path.exists() else 0.0

        logger.info(
            f"IA documental: índice persistido con {len(metadata)} fragmento(s) en {self.base_path}"
        )
        return {"fragmentos": len(metadata), "dimension": dim}

    def exists(self) -> bool:
        return self.index_path.exists() and self.metadata_path.exists()

    def clear(self) -> None:
        for path in (self.index_path, self.metadata_path):
            if path.exists():
                path.unlink()
        self._index = None
        self._items = []
        self._index_mtime = 0.0
        self._metadata_mtime = 0.0
        logger.info("IA documental: vectorstore anterior limpiado")

    def get_items(self) -> List[Dict]:
        if not self.exists():
            return []
        self.preload()
        return list(self._items)

    def preload(self, force: bool = False) -> None:
        if not self.exists():
            raise FileNotFoundError("Indice vectorial no encontrado. Ejecute /indice/reconstruir.")

        current_index_mtime = self.index_path.stat().st_mtime
        current_metadata_mtime = self.metadata_path.stat().st_mtime

        has_changes = (
            self._index is None
            or force
            or current_index_mtime != self._index_mtime
            or current_metadata_mtime != self._metadata_mtime
        )

        if not has_changes:
            return

        faiss = self._load_faiss()
        index = faiss.read_index(str(self.index_path))
        raw = json.loads(self.metadata_path.read_text(encoding="utf-8"))
        items = raw.get("items", [])

        self._index = index
        self._items = items
        self._index_mtime = current_index_mtime
        self._metadata_mtime = current_metadata_mtime

        logger.info(f"IA documental: preload indice ok, items={len(self._items)}")

    def search(self, query_embedding: np.ndarray, top_k: int) -> List[Dict]:
        if not self.exists():
            raise FileNotFoundError("Índice vectorial no encontrado. Ejecute /indice/reconstruir.")

        self.preload()
        faiss = self._load_faiss()
        index = self._index
        items = self._items

        if index.ntotal == 0 or not items:
            raise ValueError("Índice vacío. Cargue documentos y reconstruya el índice.")

        query = query_embedding.astype("float32").reshape(1, -1)
        faiss.normalize_L2(query)

        scores, idxs = index.search(query, max(1, top_k))

        evidencias: List[Dict] = []
        for score, idx in zip(scores[0], idxs[0]):
            if idx < 0 or idx >= len(items):
                continue
            item = items[idx]
            row = dict(item)
            row["documento"] = item.get("documento", "Documento sin nombre")
            row["fragmento"] = item.get("fragmento", "")
            row["score"] = float(score)
            row["base_score"] = float(score)
            evidencias.append(row)

        logger.info(f"IA documental: búsqueda completada con {len(evidencias)} evidencia(s)")
        return evidencias

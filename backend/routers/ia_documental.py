from typing import List

from fastapi import APIRouter, File, HTTPException, UploadFile
from loguru import logger
from pydantic import BaseModel, Field

from services import document_loader
from services.ia_paths import DOCUMENTS_DIR
from services.rag_service import rag_service

router = APIRouter(tags=["IA Documental"])


class ConsultaRequest(BaseModel):
    pregunta: str = Field(..., description="Pregunta a consultar")
    top_k: int = Field(5, ge=1, le=20, description="Cantidad de evidencias")


@router.post("/documentos/subir")
async def subir_documentos(files: List[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No se enviaron archivos.")

    guardados = []
    rechazados = []

    for file in files:
        filename = file.filename or ""
        if not filename or not document_loader.archivo_permitido(filename):
            rechazados.append({"archivo": filename or "sin_nombre", "motivo": "archivo inválido"})
            continue

        try:
            content = await file.read()
            if not content:
                rechazados.append({"archivo": filename, "motivo": "archivo vacío"})
                continue

            final_name = document_loader.guardar_archivo_subido(filename, content)
            guardados.append(final_name)
        except ValueError as exc:
            rechazados.append({"archivo": filename, "motivo": str(exc)})
        except Exception as exc:
            logger.error(f"IA documental: error guardando {filename}: {exc}")
            rechazados.append({"archivo": filename, "motivo": "error interno"})

    if not guardados:
        raise HTTPException(status_code=400, detail={"mensaje": "Ningún archivo válido para procesar.", "rechazados": rechazados})

    logger.info(f"IA documental: archivos cargados {len(guardados)}, rechazados {len(rechazados)}")
    return {
        "mensaje": "Documentos cargados correctamente.",
        "ruta_documentos": str(DOCUMENTS_DIR),
        "archivos_guardados": guardados,
        "rechazados": rechazados,
    }


@router.post("/indice/reconstruir")
def reconstruir_indice():
    try:
        stats = rag_service.rebuild_index()
        return {
            "mensaje": "Índice semántico reconstruido correctamente.",
            **stats,
        }
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        logger.exception(f"IA documental: error inesperado reconstruyendo índice: {exc}")
        raise HTTPException(status_code=500, detail="Error interno al reconstruir el índice.")


@router.post("/consultar")
def consultar_documentos(payload: ConsultaRequest):
    pregunta = (payload.pregunta or "").strip()
    if not pregunta:
        raise HTTPException(status_code=400, detail="La consulta está vacía.")

    try:
        result = rag_service.consultar(pregunta=pregunta, top_k=payload.top_k)
        return {
            "pregunta": pregunta,
            "respuesta": result["respuesta"],
            "fuente_principal": result.get("fuente_principal", "N/D"),
            "version_utilizada": result.get("version_utilizada", "N/D"),
            "norma_vigente": result.get("norma_vigente", False),
            "evidencias": result["evidencias"],
        }
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        logger.exception(f"IA documental: error inesperado en consulta: {exc}")
        raise HTTPException(status_code=500, detail="Error interno al consultar documentación.")

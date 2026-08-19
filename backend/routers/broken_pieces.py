from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from database import database, models
import schemas
from datetime import datetime
import shutil
import os
import uuid
from config import settings
from PIL import Image

router = APIRouter(
    prefix="/broken-pieces",
    tags=["broken-pieces"],
)

@router.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    try:
        # Definir directorio de subida (dentro de static para que sea accesible)
        # Usamos BASE_DIR de settings para ubicar la raiz
        # En prod (portable), static está en assets/ o similar. 
        # Vamos a guardar en una carpeta 'uploads' persistente al lado de la DB
        
        # O mejor, usar el directorio de assets que FastAPI sirve.
        # En config.py definimos BASE_DIR. 
        # Creemos una carpeta 'uploads' en el BASE_DIR del ejecutable/backend
        
        upload_dir = os.path.join(settings.BASE_DIR, "uploads")
        os.makedirs(upload_dir, exist_ok=True)
        
        # Generar nombre único
        ext = file.filename.split(".")[-1]
        filename = f"{uuid.uuid4()}.{ext}"
        file_path = os.path.join(upload_dir, filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Generate Thumbnail
        try:
            with Image.open(file_path) as img:
                img.thumbnail((200, 200)) # Max dim 200
                thumb_filename = f"thumb_{filename}"
                thumb_path = os.path.join(upload_dir, thumb_filename)
                img.save(thumb_path)
        except Exception as e:
            print(f"Error al crear miniatura: {e}")
            # Continue, non-fatal
            
        # Retornar ruta relativa para que el frontend la use
        # Necesitamos un endpoint para SERVIR estos archivos si no están en static del frontend.
        # Por simplicidad añadiremos un mount en main.py o usaremos una ruta de API para obtener la imagen.
        # Retornemos el nombre del archivo y creemos un endpoint GET /images/{name}
        
        return {"filename": filename, "url": f"/broken-pieces/images/{filename}"}
        
    except Exception as e:
        print(f"ERROR uploading image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/images/{filename}")
def get_image(filename: str):
    from fastapi.responses import FileResponse
    upload_dir = os.path.join(settings.BASE_DIR, "uploads")
    path = os.path.join(upload_dir, filename)
    if os.path.exists(path):
        return FileResponse(path)
    raise HTTPException(status_code=404, detail="Image not found")


def calculate_m3(thickness_mm: float, width_mm: float, length_m: float, pieces: int) -> float:
    """Calcula M3 basado en dimensiones MM, MM, M"""
    # E(mm) * A(mm) * L(m) * Piezas / 1,000,000
    if pieces <= 0: return 0.0
    return (thickness_mm * width_mm * length_m * pieces) / 1_000_000.0

@router.post("/", response_model=schemas.BrokenPieceStudyResponse)
def create_study(study_data: schemas.BrokenPieceStudyCreate, db: Session = Depends(database.get_db)):
    try:
        # 1. Crear Estudio Header
        db_study = models.BrokenPieceStudy(
            date=study_data.date or datetime.now(),
            supervisor=study_data.supervisor,
            responsible=study_data.responsible
        )
        db.add(db_study)
        db.flush() # Para obtener ID
        
        total_p_theor = 0
        total_m3_theor = 0.0
        total_loss_vol = 0.0
        
        # 2. Procesar Lotes y Calcular
        for lot_in in study_data.lots:
            # Calcular M3 Teórico
            m3_theor = calculate_m3(lot_in.thickness, lot_in.width, lot_in.length, lot_in.pieces_theoretical)
            
            # Sumar Defectos (Piezas rotas/perdidas)
            total_defects = (
                lot_in.broken_mobile + lot_in.broken_sawmill + lot_in.broken_knot +
                lot_in.missing_pieces + lot_in.over_width + lot_in.under_width +
                lot_in.warped + lot_in.in_process
            )
            
            # Diferencia Físicas (Asumiendo que Físicas = Teóricas - Faltantes/Rotas? 
            # O el usuario ingresa Físicas?
            # En el esquema Excel: Pza SAP vs M3. Quebrada...
            # Pza Físicas en Excel es un input o calculado?
            # La fórmula Excel dice: "Se encuentra una pérdida total del...".
            # Asumamos que para el INPUT, el usuario cuenta lo que ve.
            # PERO en la planilla de ejemplo: "Pza Físicas" = "Pza SAP" (198). Y hay 1 quebrada.
            # Esto implica que la 1 quebrada ESTÁ PRESENTE.
            # Entonces Pza Físicas es el total contado.
            # Pérdida es la suma de los defectos (que son piezas malas).
            
            # Calculamos Volúmen de Pérdida
            # Vol = (Total Defectos * M3_Unitario)
            m3_unit = 0
            if lot_in.pieces_theoretical > 0:
                m3_unit = m3_theor / lot_in.pieces_theoretical
            
            loss_vol = total_defects * m3_unit
            
            # % Pérdida Lote
            loss_pct = 0.0
            if m3_theor > 0:
                loss_pct = (loss_vol / m3_theor)
            
            # Crear Lote DB
            db_lot = models.BrokenPieceLot(
                study_id=db_study.id,
                lot_code=lot_in.lot_code,
                thickness=lot_in.thickness,
                width=lot_in.width,
                length=lot_in.length,
                pieces_theoretical=lot_in.pieces_theoretical,
                m3_theoretical=m3_theor,
                pieces_physical=lot_in.pieces_theoretical, # Asumimos igualdad por defecto si no se pide explícito
                diff_pieces=0, 
                
                broken_mobile=lot_in.broken_mobile,
                broken_sawmill=lot_in.broken_sawmill,
                broken_knot=lot_in.broken_knot,
                missing_pieces=lot_in.missing_pieces,
                over_width=lot_in.over_width,
                under_width=lot_in.under_width,
                warped=lot_in.warped,
                in_process=lot_in.in_process,
                
                loss_m3=loss_vol,
                loss_percentage=loss_pct,
                image_path=lot_in.image_path
            )
            db.add(db_lot)
            
            # Acumular Totales Estudio
            total_p_theor += lot_in.pieces_theoretical
            total_m3_theor += m3_theor
            total_loss_vol += loss_vol
            
        # 3. Actualizar Totales Estudio
        db_study.total_pieces = total_p_theor
        db_study.total_m3 = total_m3_theor
        db_study.total_loss_m3 = total_loss_vol
        if total_m3_theor > 0:
            db_study.total_loss_percentage = (total_loss_vol / total_m3_theor)
            
        db.commit()
        db.refresh(db_study)
        return db_study
        
    except Exception as e:
        print(f"ERROR creating broken piece study: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[schemas.BrokenPieceStudyResponse])
def get_studies(skip: int = 0, limit: int = 5000, db: Session = Depends(database.get_db)):
    return db.query(models.BrokenPieceStudy).order_by(models.BrokenPieceStudy.date.desc()).offset(skip).limit(limit).all()

@router.get("/{id}", response_model=schemas.BrokenPieceStudyResponse)
def get_study(id: int, db: Session = Depends(database.get_db)):
    study = db.query(models.BrokenPieceStudy).filter(models.BrokenPieceStudy.id == id).first()
    if not study:
        raise HTTPException(status_code=404, detail="Study not found")
    return study

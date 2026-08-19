from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import database, models
import schemas
from datetime import datetime

router = APIRouter(
    prefix="/api/siniestrada-studies",
    tags=["Siniestrada Woodchip Study"],
)

@router.post("/", response_model=schemas.SiniestradaStudyResponse)
def create_siniestrada_study(study_data: schemas.SiniestradaStudyCreate, db: Session = Depends(database.get_db)):
    try:
        db_study = models.SiniestradaStudy(
            date=study_data.date,
            time=study_data.time,
            area=study_data.area,
            shift=study_data.shift,
            journey=study_data.journey,
            screen=study_data.screen,
            total_weight=study_data.total_weight,
            burnt_bark_weight=study_data.burnt_bark_weight,
            burnt_cambium_weight=study_data.burnt_cambium_weight,
            burnt_wood_weight=study_data.burnt_wood_weight,
            soot_chip_weight=study_data.soot_chip_weight,
            pulpable_chip_weight=study_data.pulpable_chip_weight,
            responsible=study_data.responsible
        )
        db.add(db_study)
        db.commit()
        db.refresh(db_study)
        return db_study
    except Exception as e:
        db.rollback()
        print(f"DEBUG Error saving Siniestrada Study: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[schemas.SiniestradaStudyResponse])
def get_siniestrada_studies(db: Session = Depends(database.get_db)):
    return db.query(models.SiniestradaStudy).order_by(models.SiniestradaStudy.timestamp.desc()).all()

@router.get("/{id}", response_model=schemas.SiniestradaStudyResponse)
def get_siniestrada_study(id: int, db: Session = Depends(database.get_db)):
    study = db.query(models.SiniestradaStudy).filter(models.SiniestradaStudy.id == id).first()
    if not study:
        raise HTTPException(status_code=404, detail="Estudio no encontrado")
    return study

@router.delete("/{id}")
def delete_siniestrada_study(id: int, db: Session = Depends(database.get_db)):
    study = db.query(models.SiniestradaStudy).filter(models.SiniestradaStudy.id == id).first()
    if not study:
        raise HTTPException(status_code=404, detail="Estudio no encontrado")
    
    try:
        db.delete(study)
        db.commit()
        return {"status": "success", "message": "Estudio eliminado"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

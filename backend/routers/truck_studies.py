from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import database, models
import schemas
from datetime import datetime

router = APIRouter(
    prefix="/api/truck-studies",
    tags=["Truck Studies"],
)

@router.post("/", response_model=schemas.TruckStudyResponse)
def create_truck_study(study_data: schemas.TruckStudyCreate, db: Session = Depends(database.get_db)):
    print(f"DEBUG: Incoming Truck Study Data: {study_data}")
    
    # Check for duplicates: Same guide number
    existing = db.query(models.TruckStudy).filter(
        models.TruckStudy.guide_number == study_data.guide_number
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"Ya existe un estudio registrado para la guía {study_data.guide_number}."
        )

    try:
        # Create Main Study record
        new_study = models.TruckStudy(
            reception_date=study_data.reception_date,
            cutting_date=study_data.cutting_date,
            guide_number=study_data.guide_number,
            estate=study_data.estate,
            logging_team=study_data.logging_team,
            total_logs=study_data.total_logs,
            responsible=study_data.responsible
        )
        db.add(new_study)
        db.flush() # Get ID

        # Sum of specific defects
        provisioned_count = sum(d.count for d in study_data.defects)
        remainder = study_data.total_logs - provisioned_count
        
        if remainder < 0:
            db.rollback()
            raise HTTPException(status_code=400, detail="La suma de trozos con defectos no puede superar el Total de Trozos.")

        # Add provided defects
        for d in study_data.defects:
            if d.count > 0:
                db_defect = models.TruckStudyDefect(
                    study_id=new_study.id,
                    defect_name=d.defect_name,
                    count=d.count
                )
                db.add(db_defect)
            
        # Add 'Sin defecto' automatically
        has_sin_defecto = any(d.defect_name.lower() == "sin defecto" for d in study_data.defects)
        
        if not has_sin_defecto and remainder >= 0:
            sin_defecto = models.TruckStudyDefect(
                study_id=new_study.id,
                defect_name="Sin defecto",
                count=remainder
            )
            db.add(sin_defecto)

        db.commit()
        db.refresh(new_study)
        print(f"DEBUG: Truck Study saved with ID: {new_study.id}")
        return new_study
    except HTTPException:
        raise
    except Exception as e:
        print(f"DEBUG Error saving Truck Study: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[schemas.TruckStudyResponse])
def get_truck_studies(db: Session = Depends(database.get_db)):
    return db.query(models.TruckStudy).order_by(models.TruckStudy.timestamp.desc()).all()

@router.delete("/{id}")
def delete_truck_study(id: int, db: Session = Depends(database.get_db)):
    study = db.query(models.TruckStudy).filter(models.TruckStudy.id == id).first()
    if not study:
        raise HTTPException(status_code=404, detail="Study not found")
    
    try:
        db.delete(study)
        db.commit()
        return {"status": "success", "message": "Estudio eliminado"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
@router.get("/{id}", response_model=schemas.TruckStudyResponse)
def get_truck_study(id: int, db: Session = Depends(database.get_db)):
    study = db.query(models.TruckStudy).filter(models.TruckStudy.id == id).first()
    if not study:
        raise HTTPException(status_code=404, detail="Estudio no encontrado")
    return study


from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from database import database, models
from schemas import LogQualityControlCreate, LogQualityControlResponse

router = APIRouter(
    prefix="/api/log-inspections",
    tags=["Log Inspections"]
)

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/", response_model=LogQualityControlResponse)
def create_log_inspection(inspection: LogQualityControlCreate, db: Session = Depends(get_db)):
    # Create Control Header
    db_control = models.LogQualityControl(
        date=inspection.date,
        shift=inspection.shift,
        responsible=inspection.responsible,
        target_diameter=inspection.target_diameter,
        target_length=inspection.target_length,
        wood_type=inspection.wood_type,
        bin_number=inspection.bin_number,
        timestamp=datetime.now()
    )
    db.add(db_control)
    db.commit()
    db.refresh(db_control)
    
    # Create Log Entries
    for log_data in inspection.logs:
        db_log = models.LogInspection(
            control_id=db_control.id,
            jas_diameter=log_data.jas_diameter,
            actual_length=log_data.actual_length,
            curvature=log_data.curvature,
            double_curvature=log_data.double_curvature,
            freckles=log_data.freckles,
            splintering=log_data.splintering,
            fissures=log_data.fissures,
            spores=log_data.spores,
            blue_stain=log_data.blue_stain,
            bark=log_data.bark,
            rot=log_data.rot,
            bad_pruning=log_data.bad_pruning,
            other=log_data.other
        )
        db.add(db_log)
        
    db.commit()
    db.refresh(db_control) # Refresh to load relationships
    return db_control

@router.get("/", response_model=List[LogQualityControlResponse])
def get_log_inspections(db: Session = Depends(get_db)):
    return db.query(models.LogQualityControl).order_by(models.LogQualityControl.timestamp.desc()).limit(5000).all()

@router.get("/{inspection_id}", response_model=LogQualityControlResponse)
def get_log_inspection(inspection_id: int, db: Session = Depends(get_db)):
    db_inspection = db.query(models.LogQualityControl).filter(models.LogQualityControl.id == inspection_id).first()
    if not db_inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    return db_inspection

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from database import database, models
import schemas

router = APIRouter(
    prefix="/api",
    tags=["registry"],
)

@router.get("/markets", response_model=List[schemas.MarketBase])
def read_markets(db: Session = Depends(database.get_db)):
    # Assuming MarketBase includes grades relation logic
    markets = db.query(models.Market).all()
    return markets

@router.get("/inspections", response_model=List[schemas.InspectionResponse])
def read_inspections(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    inspections = db.query(models.Inspection).options(joinedload(models.Inspection.market)).offset(skip).limit(limit).all()
    return inspections

from datetime import datetime

@router.post("/inspections", response_model=schemas.InspectionResponse)
def create_inspection(inspection: schemas.InspectionCreate, db: Session = Depends(database.get_db)):
    print(f"DEBUG: Creating inspection with: {inspection}")
    try:
        data = inspection.model_dump()
        
        # Parse dates if they are strings
        if isinstance(data.get('date'), str):
            data['date'] = datetime.strptime(data['date'], '%Y-%m-%d').date()
        if isinstance(data.get('production_date'), str):
            data['production_date'] = datetime.strptime(data['production_date'], '%Y-%m-%d').date()

        db_inspection = models.Inspection(**data)
        db.add(db_inspection)
        db.commit()
        db.refresh(db_inspection)
        print(f"DEBUG: Created inspection ID: {db_inspection.id}")
        return db_inspection
    except Exception as e:
        print(f"ERROR creating inspection: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/inspections/{inspection_id}", response_model=schemas.InspectionResponse)
def get_inspection(inspection_id: int, db: Session = Depends(database.get_db)):
    inspection = db.query(models.Inspection).options(joinedload(models.Inspection.market)).filter(models.Inspection.id == inspection_id).first()
    if not inspection:
         raise HTTPException(status_code=404, detail="Inspection not found")
    return inspection

@router.post("/inspections/{inspection_id}/results", response_model=schemas.InspectionResultResponse)
def add_inspection_result(inspection_id: int, result: schemas.InspectionResultCreate, db: Session = Depends(database.get_db)):
    print(f"DEBUG: Add Result for Inspection {inspection_id}, Grade {result.grade_id}, Defect {result.defect_id}")
    
    # query builder
    query = db.query(models.InspectionResult).filter(
        models.InspectionResult.inspection_id == inspection_id,
        models.InspectionResult.grade_id == result.grade_id
    )
    
    if result.defect_id is not None:
        query = query.filter(models.InspectionResult.defect_id == result.defect_id)
    else:
        query = query.filter(models.InspectionResult.defect_id == None)
        
    existing = query.first()

    if existing:
        print(f"DEBUG: Updating existing count from {existing.pieces_count}")
        existing.pieces_count += result.pieces_count
        db.commit()
        db.refresh(existing)
        return existing
    else:
        print("DEBUG: Creating new result entry")
        new_result = models.InspectionResult(inspection_id=inspection_id, **result.model_dump())
        db.add(new_result)
        db.commit()
        db.refresh(new_result)
        return new_result



@router.get("/inspections/{inspection_id}/results")
def get_inspection_results(inspection_id: int, db: Session = Depends(database.get_db)):
    try:
        results = db.query(models.InspectionResult).options(
            joinedload(models.InspectionResult.grade),
            joinedload(models.InspectionResult.defect)
        ).filter(models.InspectionResult.inspection_id == inspection_id).all()
        
        # Manual serialization to avoid Pydantic/Recursion issues
        serialized = []
        for r in results:
            item = {
                "id": r.id,
                "inspection_id": r.inspection_id,
                "pieces_count": r.pieces_count,
                "grade_id": r.grade_id,
                "defect_id": r.defect_id,
                "grade": {"id": r.grade.id, "name": r.grade.name, "grade_rank": r.grade.grade_rank} if r.grade else None,
                "defect": {"id": r.defect.id, "name": r.defect.name} if r.defect else None
            }
            serialized.append(item)
            
        print(f"DEBUG: Returning {len(serialized)} results for inspection {inspection_id}")
        return serialized
    except Exception as e:
        print(f"ERROR fetching results: {e}")
        raise HTTPException(status_code=500, detail=str(e))

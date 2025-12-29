from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from database import database, models
import schemas
from datetime import datetime

router = APIRouter(
    prefix="/api/scanner",
    tags=["scanner"],
)

@router.post("/steps", response_model=schemas.ScannerStepResponse)
def create_scanner_step(step: schemas.ScannerStepCreate, db: Session = Depends(database.get_db)):
    try:
        data = step.model_dump()
        # Ensure date is set preferably from client, else now
        if not data.get('date'):
            data['date'] = datetime.now()
            
        db_step = models.ScannerStep(**data)
        db.add(db_step)
        db.commit()
        db.refresh(db_step)
        return db_step
    except Exception as e:
        print(f"ERROR creating scanner step: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/steps", response_model=List[schemas.ScannerStepResponse])
def read_scanner_steps(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    steps = db.query(models.ScannerStep).order_by(models.ScannerStep.date.desc()).offset(skip).limit(limit).all()
    return steps

@router.get("/steps/{step_id}", response_model=schemas.ScannerStepResponse)
def read_scanner_step(step_id: int, db: Session = Depends(database.get_db)):
    step = db.query(models.ScannerStep).options(
        joinedload(models.ScannerStep.items)
    ).filter(models.ScannerStep.id == step_id).first()
    if not step:
        raise HTTPException(status_code=404, detail="Scanner Step not found")
    return step

@router.post("/steps/{step_id}/items", response_model=schemas.ScannerItemResponse)
def add_scanner_item(step_id: int, item: schemas.ScannerItemCreate, db: Session = Depends(database.get_db)):
    try:
        # Determine Winner and Over/Under Grade
        inspector_grade = db.query(models.Grade).filter(models.Grade.id == item.inspector_grade_id).first()
        scanner_grade = db.query(models.Grade).filter(models.Grade.id == item.scanner_grade_id).first()
        
        if not inspector_grade or not scanner_grade:
             raise HTTPException(status_code=400, detail="Invalid Grade IDs")
             
        winner = "Tie"
        # Logic: 1 is best. 
        # If Inspector=1 (Best), Scanner=2 (Worse). Scanner Rank > Inspector Rank. 
        # This means Scanner gave a worse grade than reality. Undergraded (Bajo Grado)?
        # Wait, if I have a clear board (1) and scanner says it's knotty (2). It downgraded it. "Bajo Grado".
        # If I have a knotty board (2) and scanner says it's clear (1). Scanner Rank < Inspector Rank.
        # It Overgraded it (Sobre Grado).
        
        # Let's verify standard industry terms.
        # Sobre Grado / Overgrade: Giving a piece a higher value than it has.
        # Bajo Grado / Undergrade: Giving a piece a lower value than it has.
        
        if scanner_grade.grade_rank < inspector_grade.grade_rank:
            winner = "Scanner" # Scanner says it's better. Overgraded.
            # But usually winner means who is right?
            # In Models.py: winner = Column(String) # "Inspector", "Scanner", "Tie"
            # If they differ, usually Inspector is Truth. So Scanner is WRONG.
            # Maybe the column "winner" meant who "won" in a different context.
            # Let's simple check if they match.
            pass
        elif scanner_grade.grade_rank > inspector_grade.grade_rank:
            winner = "Scanner" # Scanner says it's worse. Undergraded.
            pass
        else:
            winner = "Tie"
        
        # Actually, let's just store the item. We calculate stats on aggregate.
        # But we can store "winner" as a classification of the error if needed.
        # Models has 'winner' column. Let's use it to store "Match", "Overgrade", "Undergrade".
        
        status = "Match"
        if scanner_grade.grade_rank < inspector_grade.grade_rank:
            status = "Overgrade"
        elif scanner_grade.grade_rank > inspector_grade.grade_rank:
            status = "Undergrade"
            
        db_item = models.ScannerItem(
            step_id=step_id,
            item_number=item.item_number,
            inspector_grade_id=item.inspector_grade_id,
            scanner_grade_id=item.scanner_grade_id,
            winner=status, # Reusing this column for status
            thickness=item.thickness,
            width=item.width,
            length=item.length
        )
        
        db.add(db_item)
        db.commit()
        db.refresh(db_item)
        return db_item
        
    except Exception as e:
        print(f"ERROR adding scanner item: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/steps/{step_id}/stats", response_model=schemas.ScannerStats)
def get_scanner_stats(step_id: int, db: Session = Depends(database.get_db)):
    step = db.query(models.ScannerStep).options(
        joinedload(models.ScannerStep.items).joinedload(models.ScannerItem.inspector_grade),
        joinedload(models.ScannerStep.items).joinedload(models.ScannerItem.scanner_grade)
    ).filter(models.ScannerStep.id == step_id).first()
    
    if not step:
         raise HTTPException(status_code=404, detail="Scanner Step not found")
         
    total = len(step.items)
    if total == 0:
        return schemas.ScannerStats(
            pieces_evaluated=0, pieces_in_grade=0, pieces_over_grade=0, pieces_under_grade=0,
            assertiveness=0.0, error=0.0
        )
    
    in_grade = 0
    over_grade = 0
    under_grade = 0
    
    for item in step.items:
        # Calculate on the fly or rely on 'winner' column if populated correctly
        if item.inspector_grade.grade_rank == item.scanner_grade.grade_rank:
            in_grade += 1
        elif item.scanner_grade.grade_rank < item.inspector_grade.grade_rank:
            over_grade += 1
        else:
            under_grade += 1
            
    return schemas.ScannerStats(
        pieces_evaluated=total,
        pieces_in_grade=in_grade,
        pieces_over_grade=over_grade,
        pieces_under_grade=under_grade,
        assertiveness=(in_grade / total),
        error=((over_grade + under_grade) / total)
    )

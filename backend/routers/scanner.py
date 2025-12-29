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
        # Asegurar que la fecha esté establecida preferiblemente desde el cliente, si no, ahora
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
        # Determinar Ganador y Sobre/Bajo Grado
        inspector_grade = db.query(models.Grade).filter(models.Grade.id == item.inspector_grade_id).first()
        scanner_grade = db.query(models.Grade).filter(models.Grade.id == item.scanner_grade_id).first()
        
        if not inspector_grade or not scanner_grade:
             raise HTTPException(status_code=400, detail="Invalid Grade IDs")
             
        winner = "Tie"
        # Lógica: 1 es mejor. 
        # Si Inspector=1 (Mejor), Escáner=2 (Peor). Rango Escáner > Rango Inspector. 
        # Esto significa que el Escáner dio un grado peor que la realidad. Bajo Grado?
        # Espera, si tengo una tabla limpia (1) y el escáner dice que tiene nudos (2). Lo degradó. "Bajo Grado".
        # Si tengo una tabla con nudos (2) y el escáner dice que está limpia (1). Rango Escáner < Rango Inspector.
        # Lo Sobregraduó (Sobre Grado).
        
        # Verifiquemos términos estándar de la industria.
        # Sobre Grado / Overgrade: Dar a una pieza un valor mayor al que tiene.
        # Bajo Grado / Undergrade: Dar a una pieza un valor menor al que tiene.
        
        if scanner_grade.grade_rank < inspector_grade.grade_rank:
            winner = "Scanner" # Escáner dice que es mejor. Sobregraduado.
            # Pero usualmente ganador significa quién tiene la razón?
            # En Models.py: winner = Column(String) # "Inspector", "Escáner", "Empate"
            # Si difieren, usualmente el Inspector es la Verdad. Así que el Escáner está EQUIVOCADO.
            # Quizás la columna "winner" significaba quién "ganó" en un contexto diferente.
            # Revisemos simplemente si coinciden.
            pass
        elif scanner_grade.grade_rank > inspector_grade.grade_rank:
            winner = "Scanner" # Escáner dice que es peor. Subgraduado.
            pass
        else:
            winner = "Tie"
        
        # De hecho, solo guardemos el ítem. Calculamos estadísticas en agregado.
        # Pero podemos guardar "winner" como una clasificación del error si es necesario.
        # Models tiene columna 'winner'. Usémosla para guardar "Coincidencia", "Sobregrado", "Subgrado".
        
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
            winner=status, # Reutilizando esta columna para estado
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
        # Calcular al vuelo o confiar en la columna 'winner' si está poblada correctamente
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

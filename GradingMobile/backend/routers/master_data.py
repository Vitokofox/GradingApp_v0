from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from database import database, models
from routers.auth import get_current_admin_user, get_current_active_user

import csv
import io

router = APIRouter(
    prefix="/master-data",
    tags=["Master Data"],
    # dependencies=[Depends(get_current_admin_user)] # ELIMINADO restricción global de Admin
)


# Esquemas
class CatalogItemBase(BaseModel):
    category: str
    name: str
    active: bool = True

class CatalogItemCreate(CatalogItemBase):
    pass

class CatalogItemResponse(CatalogItemBase):
    id: int
    class Config:
        from_attributes = True

class DefectCreate(BaseModel):
    name: str

class DefectResponse(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True

# --- Ítems de Catálogo (Listas Genéricas) ---
@router.get("/catalogs/{category}", response_model=List[CatalogItemResponse])
def get_catalog_items(category: str, db: Session = Depends(database.get_db), current_user = Depends(get_current_active_user)):

    return db.query(models.CatalogItem).filter(models.CatalogItem.category == category).all()

@router.post("/catalogs", response_model=CatalogItemResponse)
def create_catalog_item(item: CatalogItemCreate, db: Session = Depends(database.get_db), current_user = Depends(get_current_admin_user)):

    db_item = models.CatalogItem(**item.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/catalogs/{id}")
def delete_catalog_item(id: int, db: Session = Depends(database.get_db), current_user = Depends(get_current_admin_user)):

    item = db.query(models.CatalogItem).filter(models.CatalogItem.id == id).first()
    if item:
        db.delete(item)
        db.commit()
    return {"detail": "Item deleted"}

# --- Defectos ---
@router.get("/defects", response_model=List[DefectResponse])
def get_defects(db: Session = Depends(database.get_db), current_user = Depends(get_current_active_user)):

    return db.query(models.Defect).all()

@router.post("/defects", response_model=DefectResponse)
def create_defect(defect: DefectCreate, db: Session = Depends(database.get_db), current_user = Depends(get_current_admin_user)):

    db_defect = models.Defect(name=defect.name)
    db.add(db_defect)
    db.commit()
    db.refresh(db_defect)
    return db_defect

@router.delete("/defects/{id}")
def delete_defect(id: int, db: Session = Depends(database.get_db), current_user = Depends(get_current_admin_user)):

    item = db.query(models.Defect).filter(models.Defect.id == id).first()
    if item:
        db.delete(item)
        db.commit()
    return {"detail": "Defect deleted"}


# --- Código auxiliar de Carga Masiva ---
@router.post("/upload")
async def upload_master_data(type: str, file: UploadFile = File(...), db: Session = Depends(database.get_db), current_user = Depends(get_current_admin_user)):

    """
    El tipo puede ser: 'catalog', 'markets', 'defects'
    El archivo debe ser CSV.
    """
    content = await file.read()
    # Lógica para analizar CSV y poblar tablas
    # Por ahora, solo un éxito de marcador de posición

# --- Jerarquía de Clasificación (Producto -> Grado -> Defecto) ---

class ProductCreate(BaseModel):
    name: str

class ProductResponse(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True

class GradeCreate(BaseModel):
    product_id: int
    name: str
    grade_rank: int

class GradeResponse(BaseModel):
    id: int
    name: str
    product_id: int
    grade_rank: int
    defects: List[DefectResponse] = []
    # Los defectos pueden cargarse por separado o incluirse
    class Config:
        from_attributes = True

# Productos
@router.get("/products", response_model=List[ProductResponse])
def get_products(db: Session = Depends(database.get_db), current_user = Depends(get_current_active_user)):

    return db.query(models.Product).all()

@router.post("/products", response_model=ProductResponse)
def create_product(product: ProductCreate, db: Session = Depends(database.get_db), current_user = Depends(get_current_admin_user)):

    db_prod = models.Product(**product.model_dump())
    db.add(db_prod)
    db.commit()
    db.refresh(db_prod)
    return db_prod

@router.delete("/products/{id}")
def delete_product(id: int, db: Session = Depends(database.get_db), current_user = Depends(get_current_admin_user)):

    item = db.query(models.Product).filter(models.Product.id == id).first()
    if item:
        db.delete(item)
        db.commit()
    return {"detail": "Product deleted"}

# Grados (Cascadas)
@router.get("/products/{product_id}/grades", response_model=List[GradeResponse])
def get_grades_by_product(product_id: int, db: Session = Depends(database.get_db), current_user = Depends(get_current_active_user)):

    return db.query(models.Grade).filter(models.Grade.product_id == product_id).all()

@router.post("/grades", response_model=GradeResponse)
def create_grade(grade: GradeCreate, db: Session = Depends(database.get_db), current_user = Depends(get_current_admin_user)):

    print(f"DEBUG: Attempting to create grade: {grade}")
    try:
        db_grade = models.Grade(**grade.model_dump())
        db.add(db_grade)
        db.commit()
        db.refresh(db_grade)
        print(f"DEBUG: Successfully created grade: {db_grade.id}")
        return db_grade
    except Exception as e:
        print(f"ERROR creating grade: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/grades/{id}")
def delete_grade(id: int, db: Session = Depends(database.get_db), current_user = Depends(get_current_admin_user)):

    item = db.query(models.Grade).filter(models.Grade.id == id).first()
    if item:
        db.delete(item)
        db.commit()
    return {"detail": "Grade deleted"}

# Asociación Grado-Defecto
class GradeDefectLink(BaseModel):
    grade_id: int
    defect_id: int

@router.post("/grades/defects")
def add_defect_to_grade(link: GradeDefectLink, db: Session = Depends(database.get_db), current_user = Depends(get_current_admin_user)):

    grade = db.query(models.Grade).filter(models.Grade.id == link.grade_id).first()
    defect = db.query(models.Defect).filter(models.Defect.id == link.defect_id).first()
    if not grade or not defect:
        raise HTTPException(status_code=404, detail="Grade or Defect not found")
    
    # Verificar existencia
    if defect in grade.defects:
        return {"detail": "Defect already assigned to grade"}
        
    grade.defects.append(defect)
    db.commit()
    return {"detail": "Defect added to grade"}

@router.delete("/grades/{grade_id}/defects/{defect_id}")
def remove_defect_from_grade(grade_id: int, defect_id: int, db: Session = Depends(database.get_db), current_user = Depends(get_current_admin_user)):

    grade = db.query(models.Grade).filter(models.Grade.id == grade_id).first()
    defect = db.query(models.Defect).filter(models.Defect.id == defect_id).first()
    
    if grade and defect:
        if defect in grade.defects:
            grade.defects.remove(defect)
            db.commit()
            return {"detail": "Defect removed"}
            
    raise HTTPException(status_code=404, detail="Association not found")

@router.get("/grades/{grade_id}/defects", response_model=List[DefectResponse])
def get_defects_by_grade(grade_id: int, db: Session = Depends(database.get_db), current_user = Depends(get_current_active_user)):

    grade = db.query(models.Grade).filter(models.Grade.id == grade_id).first()
    if not grade:
        raise HTTPException(status_code=404, detail="Grade not found")
    return grade.defects

# --- Mercados ---
class MarketCreate(BaseModel):
    name: str

class MarketResponse(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True

@router.get("/markets", response_model=List[MarketResponse])
def get_markets(db: Session = Depends(database.get_db), current_user = Depends(get_current_active_user)):

    return db.query(models.Market).all()

@router.post("/markets", response_model=MarketResponse)
def create_market(market: MarketCreate, db: Session = Depends(database.get_db), current_user = Depends(get_current_admin_user)):

    db_market = models.Market(name=market.name)
    db.add(db_market)
    db.commit()
    db.refresh(db_market)
    return db_market

@router.delete("/markets/{id}")
def delete_market(id: int, db: Session = Depends(database.get_db), current_user = Depends(get_current_admin_user)):

    item = db.query(models.Market).filter(models.Market.id == id).first()
    if item:
        db.delete(item)
        db.commit()
    return {"detail": "Market deleted"}

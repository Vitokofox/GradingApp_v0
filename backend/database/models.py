from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Date, DateTime, Float, Table
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base
# Tabla de asociación para Grado-Defecto
grade_defects = Table('grade_defects', Base.metadata,
    Column('grade_id', Integer, ForeignKey('grades.id')),
    Column('defect_id', Integer, ForeignKey('defects.id'))
)

class Product(Base):
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    
    grades = relationship("Grade", back_populates="product")

class Market(Base):
    __tablename__ = "markets"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    
    # Mercado podría ser relevante para el destino
    inspections = relationship("Inspection", back_populates="market")

class Grade(Base):
    __tablename__ = "grades"
    
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id")) # Cambiado de market_id a product_id
    name = Column(String)
    grade_rank = Column(Integer)  # 1 es mejor, mayor es peor
    
    product = relationship("Product", back_populates="grades")
    defects = relationship("Defect", secondary=grade_defects, back_populates="grades")

class CatalogItem(Base):
    __tablename__ = "catalog_items"
    
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String, index=True) # ej., "Área", "Máquina", "Producto", "Turno"
    name = Column(String)
    active = Column(Boolean, default=True)

class Defect(Base):
    __tablename__ = "defects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    description = Column(String, nullable=False)
    
    grades = relationship("Grade", secondary="grade_defects", back_populates="defects")

class Inspection(Base):
    __tablename__ = "inspections"
    
    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, default=datetime.now)
    production_date = Column(Date, nullable=False)
    shift = Column(String, nullable=False)
    journey = Column(String, nullable=False) # Jornada
    supervisor = Column(String, nullable=False)
    responsible = Column(String, nullable=False)
    
    area = Column(String, nullable=False)
    machine = Column(String, nullable=False)
    origin = Column(String, nullable=False)
    lot = Column(String, nullable=False)
    
    market_id = Column(Integer, ForeignKey("markets.id"), nullable=False)
    product_name = Column(String, nullable=False) # O ID si está catalogado
    
    state = Column(String, nullable=False) # Estado
    termination = Column(String, nullable=False) # Terminación
    
    thickness = Column(String, nullable=False)
    width = Column(String, nullable=False)
    length = Column(String, nullable=False)
    
    pieces_inspected = Column(Integer, default=0) # Cantidad planificada
    
    type = Column(String) # Discriminador
    
    market = relationship("Market", back_populates="inspections")
    
    __mapper_args__ = {
        "polymorphic_on": type,
        "polymorphic_identity": "inspection",
    }

class FinishedProductInspection(Inspection):
    __mapper_args__ = {
        "polymorphic_identity": "finished_product",
    }
    # Agregar columnas específicas si las hay, por ahora reutiliza la base

class LineGradingInspection(Inspection):
    __mapper_args__ = {
        "polymorphic_identity": "line_grading",
    }

class RejectionTypingInspection(Inspection):
    __mapper_args__ = {
        "polymorphic_identity": "rejection_typing",
    }

class InspectionResult(Base):
    __tablename__ = "inspection_results"
    
    id = Column(Integer, primary_key=True, index=True)
    inspection_id = Column(Integer, ForeignKey("inspections.id"))
    grade_id = Column(Integer, ForeignKey("grades.id"))
    defect_id = Column(Integer, ForeignKey("defects.id"), nullable=True) # None significa "Grado Base / Perfecto"
    
    pieces_count = Column(Integer, default=0)
    
    inspection = relationship("Inspection", back_populates="results")
    grade = relationship("Grade")
    defect = relationship("Defect")

# Extender Inspección para enlazar resultados
Inspection.results = relationship("InspectionResult", back_populates="inspection")
class ScannerStep(Base):
    __tablename__ = "scanner_steps"
    
    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, default=datetime.now)
    supervisor = Column(String)
    market_id = Column(Integer, ForeignKey("markets.id"))
    
    items = relationship("ScannerItem", back_populates="step")

    # Campos expandidos para coincidir con DB_Clasificadores
    shift = Column(String)
    area = Column(String)
    machine = Column(String)
    responsible = Column(String) # Quien realizó el estudio
    product_name = Column(String)
    
    # Valores por defecto para fluidez
    default_thickness = Column(Float, nullable=True)
    default_width = Column(Float, nullable=True)
    default_length = Column(Float, nullable=True)



class ScannerItem(Base):
    __tablename__ = "scanner_items"
    
    id = Column(Integer, primary_key=True, index=True)
    step_id = Column(Integer, ForeignKey("scanner_steps.id"))
    item_number = Column(Integer) # 1 a 10
    
    inspector_grade_id = Column(Integer, ForeignKey("grades.id"))
    scanner_grade_id = Column(Integer, ForeignKey("grades.id"))
    
    # Dimensiones por pieza
    thickness = Column(Float, nullable=True)
    width = Column(Float, nullable=True)
    length = Column(Float, nullable=True) # Renombrado o alias a original_length? Mantegamos original_length por legado si hay, o solo usar length.
    
    original_length = Column(Float, nullable=True) # Manteniendo esto pero quizás redundante si usamos 'length'

    optimized_grade_id = Column(Integer, ForeignKey("grades.id"), nullable=True) # Si ocurre optimización
    cut_length = Column(Float, nullable=True)
    
    winner = Column(String) # "Inspector", "Escáner", "Empate"
    
    step = relationship("ScannerStep", back_populates="items")
    inspector_grade = relationship("Grade", foreign_keys=[inspector_grade_id])
    scanner_grade = relationship("Grade", foreign_keys=[scanner_grade_id])
    optimized_grade = relationship("Grade", foreign_keys=[optimized_grade_id])

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    first_name = Column(String)
    last_name = Column(String)
    position = Column(String) # Cargo
    level = Column(String) # usuario, asistente, admin
    process_type = Column(String) # Verde, Seco
    is_active = Column(Boolean, default=True)

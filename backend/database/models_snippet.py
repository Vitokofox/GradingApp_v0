
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Date, DateTime, Float, Table
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class LogQualityControl(Base):
    __tablename__ = "log_quality_controls"
    
    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, default=datetime.now)
    shift = Column(String)
    responsible = Column(String)
    
    target_diameter = Column(String)
    target_length = Column(String)
    wood_type = Column(String)
    bin_number = Column(String) # Buzón
    
    timestamp = Column(DateTime, default=datetime.now)
    
    logs = relationship("LogInspection", back_populates="control", cascade="all, delete-orphan")

class LogInspection(Base):
    __tablename__ = "log_inspections"
    
    id = Column(Integer, primary_key=True, index=True)
    control_id = Column(Integer, ForeignKey("log_quality_controls.id"))
    
    jas_diameter = Column(Float, nullable=True) # Diam JAS (cm)
    actual_length = Column(Float, nullable=True) # Largo (mm) - Note: image says mm, plan said float.
    curvature = Column(Float, nullable=True)     # Curvatura (mm)
    double_curvature = Column(Float, nullable=True) # Doble Curv. (mm)
    
    # Defects - Boolean flags
    freckles = Column(Boolean, default=False)      # Pecas
    splintering = Column(Boolean, default=False)   # Astillamiento
    fissures = Column(Boolean, default=False)      # Fisuras
    spores = Column(Boolean, default=False)        # Esporas
    blue_stain = Column(Boolean, default=False)    # M. Azul
    bark = Column(Boolean, default=False)          # Corteza
    rot = Column(Boolean, default=False)           # Pudrición
    bad_pruning = Column(Boolean, default=False)   # Mal Desrame
    
    other = Column(String, nullable=True)          # Otro
    
    control = relationship("LogQualityControl", back_populates="logs")

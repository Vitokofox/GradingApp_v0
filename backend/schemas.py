from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime

# --- Base Models ---

class GradeBase(BaseModel):
    id: int
    name: str 
    grade_rank: int
    
    class Config:
        from_attributes = True

class MarketBase(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


# --- Inspection Schemas ---

class InspectionBase(BaseModel):
    shift: str
    supervisor: str
    product_name: str
    market_id: int
    
    # New Fields - Now Mandatory
    date: str
    production_date: str
    journey: str
    responsible: str
    area: str
    machine: str
    origin: str
    lot: str
    state: str
    termination: str
    thickness: str
    width: str
    length: str
    pieces_inspected: int = 0
    type: str = 'inspection'
    process: Optional[str] = None

class InspectionCreate(InspectionBase):
    pass

class InspectionUpdate(BaseModel):
    shift: Optional[str] = None
    supervisor: Optional[str] = None
    product_name: Optional[str] = None
    market_id: Optional[int] = None
    date: Optional[str] = None # Will be parsed
    production_date: Optional[str] = None
    journey: Optional[str] = None
    responsible: Optional[str] = None
    area: Optional[str] = None
    machine: Optional[str] = None
    origin: Optional[str] = None
    lot: Optional[str] = None
    state: Optional[str] = None
    termination: Optional[str] = None
    thickness: Optional[str] = None
    width: Optional[str] = None
    length: Optional[str] = None
    pieces_inspected: Optional[int] = None
    type: Optional[str] = None
    process: Optional[str] = None

    class Config:
        from_attributes = True

class InspectionResponse(InspectionBase):
    id: int
    date: date
    production_date: Optional[date] = None
    market: MarketBase # Adjust if MarketBase is not fully compatible or circular
    
    class Config:
        from_attributes = True

class InspectionResultBase(BaseModel):
    grade_id: int
    defect_id: Optional[int] = None
    pieces_count: int

class InspectionResultCreate(InspectionResultBase):
    pass

class InspectionResultUpdate(BaseModel):
    pieces_count: int

class InspectionResultSync(BaseModel):
    grade_id: int
    defect_id: Optional[int] = None
    pieces_count: int

class DefectBase(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True

class InspectionResultResponse(InspectionResultBase):
    id: int
    inspection_id: int
    grade: Optional[GradeBase] = None
    defect: Optional[DefectBase] = None
    
    class Config:
        from_attributes = True

# --- User Schemas ---

class UserBase(BaseModel):
    username: str
    first_name: str
    last_name: str
    position: str
    level: str # user, assistant, admin
    process_type: str # Verde, Seco

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    position: Optional[str] = None
    level: Optional[str] = None
    process_type: Optional[str] = None
    password: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None


# --- Scanner Schemas ---

class ScannerItemBase(BaseModel):
    item_number: int
    inspector_grade_id: int
    scanner_grade_id: int
    thickness: Optional[float] = None
    width: Optional[float] = None
    length: Optional[float] = None

    
class ScannerItemCreate(ScannerItemBase):
    pass

class ScannerItemResponse(ScannerItemBase):
    id: int
    step_id: int
    inspector_grade: Optional[GradeBase] = None
    scanner_grade: Optional[GradeBase] = None
    winner: Optional[str] = None
    
    class Config:
        from_attributes = True

class ScannerStepBase(BaseModel):
    market_id: int
    supervisor: str
    shift: Optional[str] = None
    area: Optional[str] = None
    machine: Optional[str] = None
    responsible: Optional[str] = None
    product_name: Optional[str] = None
    date: Optional[datetime] = None
    default_thickness: Optional[float] = None
    default_width: Optional[float] = None
    default_length: Optional[float] = None


class ScannerStepCreate(ScannerStepBase):
    pass

class ScannerStepResponse(ScannerStepBase):
    id: int
    date: datetime
    items: List[ScannerItemResponse] = []
    market: Optional[MarketBase] = None
    
    class Config:
        from_attributes = True

class ScannerStats(BaseModel):
    pieces_evaluated: int
    pieces_in_grade: int
    pieces_over_grade: int
    pieces_under_grade: int
    assertiveness: float
    error: float



# --- Broken Piece Study Schemas ---

class BrokenPieceLotBase(BaseModel):
    lot_code: str
    thickness: float
    width: float
    length: float
    pieces_theoretical: int
    broken_mobile: int = 0
    broken_sawmill: int = 0
    broken_knot: int = 0
    missing_pieces: int = 0
    over_width: int = 0
    under_width: int = 0
    warped: int = 0
    in_process: int = 0
    image_path: Optional[str] = None

class BrokenPieceLotCreate(BrokenPieceLotBase):
    pass

class BrokenPieceLotResponse(BrokenPieceLotBase):
    id: int
    study_id: int
    m3_theoretical: float
    pieces_physical: int
    diff_pieces: int
    loss_m3: float
    loss_percentage: float
    
    class Config:
        from_attributes = True

class BrokenPieceStudyBase(BaseModel):
    supervisor: str
    responsible: str
    date: Optional[datetime] = None

class BrokenPieceStudyCreate(BrokenPieceStudyBase):
    lots: List[BrokenPieceLotCreate]

class BrokenPieceStudyResponse(BrokenPieceStudyBase):
    id: int
    date: datetime
    total_pieces: int
    total_m3: float
    total_loss_m3: float
    total_loss_percentage: float
    lots: List[BrokenPieceLotResponse] = []
    
    class Config:
        from_attributes = True

# --- Log Quality Control Schemas ---

class LogInspectionBase(BaseModel):
    jas_diameter: Optional[float] = None
    actual_length: Optional[float] = None
    curvature: Optional[float] = None
    double_curvature: Optional[float] = None
    
    freckles: bool = False
    splintering: bool = False
    fissures: bool = False
    spores: bool = False
    blue_stain: bool = False
    bark: bool = False
    rot: bool = False
    bad_pruning: bool = False
    other: Optional[str] = None

class LogInspectionCreate(LogInspectionBase):
    pass

class LogInspectionResponse(LogInspectionBase):
    id: int
    control_id: int
    
    class Config:
        from_attributes = True

class LogQualityControlBase(BaseModel):
    date: date
    shift: str
    responsible: str
    target_diameter: str
    target_length: str
    wood_type: str
    bin_number: str

class LogQualityControlCreate(LogQualityControlBase):
    logs: List[LogInspectionCreate] = []

class LogQualityControlResponse(LogQualityControlBase):
    id: int
    timestamp: datetime
    logs: List[LogInspectionResponse] = []
    
    class Config:
        from_attributes = True

# --- Truck Study Schemas ---

class TruckStudyDefectBase(BaseModel):
    defect_name: str
    count: int

class TruckStudyDefectCreate(TruckStudyDefectBase):
    pass

class TruckStudyDefectResponse(TruckStudyDefectBase):
    id: int
    study_id: int
    
    class Config:
        from_attributes = True

class TruckStudyBase(BaseModel):
    reception_date: date
    cutting_date: date
    guide_number: str
    estate: str
    logging_team: str
    total_logs: int
    responsible: str

class TruckStudyCreate(TruckStudyBase):
    defects: List[TruckStudyDefectCreate] = []

class TruckStudyResponse(TruckStudyBase):
    id: int
    timestamp: datetime
    defects: List[TruckStudyDefectResponse] = []
    
    class Config:
        from_attributes = True

# --- Siniestrada Study Schemas ---

class SiniestradaStudyBase(BaseModel):
    date: date
    time: str
    area: str
    shift: str
    journey: str
    screen: str
    total_weight: float
    burnt_bark_weight: float
    burnt_cambium_weight: float
    burnt_wood_weight: float
    soot_chip_weight: float
    pulpable_chip_weight: float
    responsible: str

class SiniestradaStudyCreate(SiniestradaStudyBase):
    pass

class SiniestradaStudyResponse(SiniestradaStudyBase):
    id: int
    timestamp: datetime
    
    class Config:
        from_attributes = True


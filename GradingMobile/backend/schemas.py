from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List, Literal, Optional, Union
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

class QualityAlertPhotoResponse(BaseModel):
    id: int
    image_data: str

    class Config:
        from_attributes = True


class QualityAlertCreate(BaseModel):
    alert_type: str = 'Defecto de procesos'
    operator: Optional[str] = None
    operator_name: Optional[str] = None
    operator_id: Optional[Union[str, int]] = None
    reason: str = Field(min_length=1)
    observations: Optional[str] = None
    created_at: Optional[datetime] = None
    photos: List[str] = Field(default_factory=list, max_length=6)

    @model_validator(mode='after')
    def require_operator_and_reason(self):
        if not str(self.operator or self.operator_name or self.operator_id or '').strip():
            raise ValueError('Quality alert operator is required')
        if not self.reason.strip():
            raise ValueError('Quality alert reason is required')
        return self

    @field_validator('photos', mode='before')
    @classmethod
    def normalize_photos(cls, value):
        normalized = []
        for photo in value or []:
            if isinstance(photo, str):
                normalized.append(photo)
            elif isinstance(photo, dict):
                normalized.append(photo.get('image_data') or photo.get('imageData') or photo.get('data_url') or photo.get('data') or photo.get('url'))
            else:
                normalized.append(getattr(photo, 'image_data', None))
        if any(not photo for photo in normalized):
            raise ValueError('Each photo must contain image data')
        return normalized


class QualityAlertResponse(BaseModel):
    id: int
    inspection_id: int
    code: str
    created_at: datetime
    alert_type: str
    operator: str
    reason: str
    observations: Optional[str] = None
    photos: List[str] = Field(default_factory=list)

    @field_validator('photos', mode='before')
    @classmethod
    def photo_rows_to_data(cls, value):
        return [getattr(photo, 'image_data', photo) for photo in (value or [])]

    class Config:
        from_attributes = True

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
    inspection_subtype: Optional[Literal['finished_lot', 'finished_line', 'line_grading']] = None

class InspectionCreate(InspectionBase):
    quality_alert: Optional[QualityAlertCreate] = None

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
    inspection_subtype: Optional[Literal['finished_lot', 'finished_line', 'line_grading']] = None
    quality_alert: Optional[QualityAlertCreate] = None

    class Config:
        from_attributes = True

class InspectionResponse(InspectionBase):
    id: int
    date: date
    production_date: Optional[date] = None
    market: MarketBase # Adjust if MarketBase is not fully compatible or circular
    quality_alert: Optional[QualityAlertResponse] = None
    
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

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



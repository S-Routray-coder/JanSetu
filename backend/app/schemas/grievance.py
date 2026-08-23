from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.schemas.user import UserOut


class GrievanceBase(BaseModel):
    title: Optional[str] = None
    description: str
    category: Optional[str] = "Road & Infrastructure"
    language: Optional[str] = "en"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    landmark: Optional[str] = None
    ward: Optional[str] = "Ward 12"


class GrievanceCreate(GrievanceBase):
    pass


class GrievanceStatusHistoryOut(BaseModel):
    id: int
    old_status: Optional[str]
    new_status: str
    comments: Optional[str]
    created_at: datetime
    changed_by_user_id: Optional[int]

    model_config = ConfigDict(from_attributes=True)


class EvidenceOut(BaseModel):
    id: int
    file_name: str
    file_url: str
    file_type: str
    evidence_type: str
    is_verified: bool
    verification_notes: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GrievanceReviewOut(BaseModel):
    id: int
    grievance_id: int
    user_name: str
    user_role: Optional[str] = "Verified Resident"
    rating: int
    is_verified_fixed: int
    comment: str
    proof_image_url: Optional[str] = None
    helpful_count: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GrievanceReviewCreate(BaseModel):
    user_name: Optional[str] = "Resident Citizen"
    rating: int = 5
    is_verified_fixed: int = 1
    comment: str
    proof_image_url: Optional[str] = None


class GrievanceAssign(BaseModel):
    assigned_officer_name: Optional[str] = "Er. Rajesh Mohapatra (Executive Engineer)"
    assigned_officer_contact: Optional[str] = "0674-2548900"
    contractor_name: Optional[str] = "Apex Civic Infra Ltd."
    contractor_contact: Optional[str] = "+91 94370 55432"
    work_order_id: Optional[str] = "WO-2026-881"
    target_sla_date: Optional[str] = "24 Hours (SLA Target)"
    department: Optional[str] = "Municipal Administration"
    priority: Optional[str] = "High"


class GrievanceOut(BaseModel):
    id: int
    ticket_id: str
    title: str
    description: str
    category: str
    status: str
    priority: str
    language: str
    latitude: Optional[float]
    longitude: Optional[float]
    address: Optional[str]
    landmark: Optional[str]
    ward: Optional[str]
    department: Optional[str]
    ai_confidence: Optional[float]
    ai_summary: Optional[str]
    resolution_notes: Optional[str]
    resolution_proof_url: Optional[str] = None
    contractor_name: Optional[str] = None
    contractor_contact: Optional[str] = None
    work_order_id: Optional[str] = None
    target_sla_date: Optional[str] = None
    assigned_officer_name: Optional[str] = None
    assigned_officer_contact: Optional[str] = None
    ward_councillor_name: Optional[str] = None
    community_impact_count: int
    citizen_id: int
    assigned_officer_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime]
    
    citizen: Optional[UserOut] = None
    assigned_officer: Optional[UserOut] = None

    model_config = ConfigDict(from_attributes=True)


class GrievanceDetail(GrievanceOut):
    history: List[GrievanceStatusHistoryOut] = []
    evidence: List[EvidenceOut] = []
    reviews: List[GrievanceReviewOut] = []


class GrievanceStatusUpdate(BaseModel):
    status: str  # Pending, In Progress, Resolved, Rejected
    comments: Optional[str] = None
    assigned_officer_id: Optional[int] = None
    resolution_notes: Optional[str] = None
    resolution_proof_url: Optional[str] = None
    priority: Optional[str] = None


class WardBulletinOut(BaseModel):
    id: int
    title: str
    message: str
    category: str
    urgency: str
    ward: str
    author_name: str
    author_role: str
    is_active: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WardBulletinCreate(BaseModel):
    title: str
    message: str
    category: Optional[str] = "Service Advisory"
    urgency: Optional[str] = "Normal"
    ward: Optional[str] = "Ward 12"
    author_name: Optional[str] = "Municipal Administration"
    author_role: Optional[str] = "Ward Nodal Officer"

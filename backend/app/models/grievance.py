from datetime import datetime
import enum
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class GrievanceStatus(str, enum.Enum):
    PENDING = "Pending"
    IN_PROGRESS = "In Progress"
    RESOLVED = "Resolved"
    REJECTED = "Rejected"


class GrievancePriority(str, enum.Enum):
    CRITICAL = "Critical"
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class GrievanceCategory(str, enum.Enum):
    ROAD = "Road & Infrastructure"
    WATER = "Water Supply"
    WASTE = "Waste Management"
    LIGHTING = "Street Lighting"
    DRAINAGE = "Drainage"
    HEALTH = "Health"
    OTHER = "Other"


class Grievance(Base):
    __tablename__ = "grievances"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(String, unique=True, index=True, nullable=False)  # e.g., "JS-20481"
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String, default=GrievanceCategory.ROAD.value, nullable=False)
    status = Column(String, default=GrievanceStatus.PENDING.value, nullable=False)
    priority = Column(String, default=GrievancePriority.MEDIUM.value, nullable=False)
    language = Column(String, default="en", nullable=False)
    
    # Location data
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    address = Column(String, nullable=True)
    landmark = Column(String, nullable=True)
    ward = Column(String, default="Ward 12", nullable=True)
    
    # AI Analysis & Triage fields
    department = Column(String, default="Municipal Administration", nullable=True)
    ai_confidence = Column(Float, default=0.85, nullable=True)
    ai_summary = Column(Text, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    
    # Community impact count (auto-incremented on similar reports or citizen upvotes)
    community_impact_count = Column(Integer, default=1)
    
    # Contractor & Authority Details
    contractor_name = Column(String, default="Apex Civic Infra Ltd.", nullable=True)
    contractor_contact = Column(String, default="+91 94370 55432", nullable=True)
    work_order_id = Column(String, default="WO-2026-881", nullable=True)
    target_sla_date = Column(String, default="24 Hours (SLA Target)", nullable=True)
    assigned_officer_name = Column(String, default="Er. Rajesh Mohapatra (Executive Engineer)", nullable=True)
    assigned_officer_contact = Column(String, default="0674-2548900", nullable=True)
    ward_councillor_name = Column(String, default="Smt. Jayashree Das (Ward 12)", nullable=True)
    resolution_proof_url = Column(String, nullable=True)

    # Foreign keys
    citizen_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_officer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    # Relationships
    citizen = relationship("User", back_populates="grievances", foreign_keys=[citizen_id])
    assigned_officer = relationship("User", back_populates="assigned_grievances", foreign_keys=[assigned_officer_id])
    history = relationship("GrievanceStatusHistory", back_populates="grievance", cascade="all, delete-orphan", order_by="desc(GrievanceStatusHistory.created_at)")
    evidence = relationship("Evidence", back_populates="grievance", cascade="all, delete-orphan")
    supports = relationship("GrievanceSupport", back_populates="grievance", cascade="all, delete-orphan")
    reviews = relationship("GrievanceReview", back_populates="grievance", cascade="all, delete-orphan", order_by="desc(GrievanceReview.created_at)")


class GrievanceStatusHistory(Base):
    __tablename__ = "grievance_status_history"

    id = Column(Integer, primary_key=True, index=True)
    grievance_id = Column(Integer, ForeignKey("grievances.id"), nullable=False)
    old_status = Column(String, nullable=True)
    new_status = Column(String, nullable=False)
    changed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    comments = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    grievance = relationship("Grievance", back_populates="history")
    changed_by = relationship("User")


class GrievanceSupport(Base):
    __tablename__ = "grievance_supports"

    id = Column(Integer, primary_key=True, index=True)
    grievance_id = Column(Integer, ForeignKey("grievances.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    grievance = relationship("Grievance", back_populates="supports")
    user = relationship("User", back_populates="supports")


class GrievanceReview(Base):
    __tablename__ = "grievance_reviews"

    id = Column(Integer, primary_key=True, index=True)
    grievance_id = Column(Integer, ForeignKey("grievances.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user_name = Column(String, default="Resident Citizen", nullable=False)
    user_role = Column(String, default="Verified Neighbor", nullable=True)
    rating = Column(Integer, default=5, nullable=False)  # 1 to 5 Stars
    is_verified_fixed = Column(Integer, default=1, nullable=False)  # 1 = Confirmed Fixed, 0 = Disputed / Still Broken
    comment = Column(Text, nullable=False)
    proof_image_url = Column(String, nullable=True)  # Citizen's photo proof URL
    helpful_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    grievance = relationship("Grievance", back_populates="reviews")


class WardBulletin(Base):
    __tablename__ = "ward_bulletins"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    category = Column(String, default="Service Advisory")  # Water Shutdown, Roadwork, Sanitation, Power
    urgency = Column(String, default="Normal")  # Critical, High, Normal
    ward = Column(String, default="Ward 12")
    author_name = Column(String, default="Municipal Administration")
    author_role = Column(String, default="Ward Nodal Officer")
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

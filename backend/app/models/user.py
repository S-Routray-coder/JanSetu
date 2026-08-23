from datetime import datetime
import enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base


class UserRole(str, enum.Enum):
    CITIZEN = "citizen"
    OFFICER = "officer"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.CITIZEN, nullable=False)
    phone = Column(String, nullable=True)
    ward = Column(String, default="Ward 12", nullable=True)
    department = Column(String, nullable=True)  # For officers (e.g. Road Division, Waste Management)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    grievances = relationship("Grievance", back_populates="citizen", foreign_keys="Grievance.citizen_id")
    assigned_grievances = relationship("Grievance", back_populates="assigned_officer", foreign_keys="Grievance.assigned_officer_id")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    votes = relationship("ProjectVote", back_populates="user", cascade="all, delete-orphan")
    supports = relationship("GrievanceSupport", back_populates="user", cascade="all, delete-orphan")

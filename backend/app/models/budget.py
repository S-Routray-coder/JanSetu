from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class BudgetProject(Base):
    __tablename__ = "budget_projects"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String, nullable=False)  # Road, Water, Lighting, Parks, Sanitation
    ward = Column(String, default="Ward 12", nullable=False)
    
    estimated_cost = Column(Float, nullable=False)  # In INR (e.g. 500000)
    allocated_funds = Column(Float, default=0.0)
    
    # "Proposed", "Under Review", "Approved", "In Progress", "Completed"
    status = Column(String, default="Proposed", nullable=False)
    
    vote_count = Column(Integer, default=0)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    votes = relationship("ProjectVote", back_populates="project", cascade="all, delete-orphan")
    creator = relationship("User")


class ProjectVote(Base):
    __tablename__ = "project_votes"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("budget_projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    vote_type = Column(String, default="support", nullable=False)  # "support", "oppose"
    feedback = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("BudgetProject", back_populates="votes")
    user = relationship("User", back_populates="votes")

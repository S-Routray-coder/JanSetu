from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class BudgetProjectBase(BaseModel):
    title: str
    description: str
    category: str
    ward: Optional[str] = "Ward 12"
    estimated_cost: float
    allocated_funds: Optional[float] = 0.0
    status: Optional[str] = "Proposed"


class BudgetProjectCreate(BudgetProjectBase):
    pass


class BudgetProjectOut(BudgetProjectBase):
    id: int
    vote_count: int
    created_at: datetime
    updated_at: datetime
    user_has_voted: Optional[bool] = False

    model_config = ConfigDict(from_attributes=True)


class ProjectVoteCreate(BaseModel):
    vote_type: Optional[str] = "support"
    feedback: Optional[str] = None


class BudgetSummaryOut(BaseModel):
    total_budget_allocated: float
    total_budget_estimated: float
    total_projects: int
    active_proposals: int
    approved_projects: int
    total_community_votes: int

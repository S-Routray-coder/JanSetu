from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.user import User
from app.models.budget import BudgetProject, ProjectVote
from app.schemas.budget import (
    BudgetProjectCreate, 
    BudgetProjectOut, 
    ProjectVoteCreate, 
    BudgetSummaryOut
)
from app.api.deps import get_current_user, get_current_officer, get_optional_current_user

router = APIRouter()


@router.get("/projects", response_model=List[BudgetProjectOut])
def list_projects(
    ward: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    List participatory budgeting proposals with user vote status.
    """
    query = db.query(BudgetProject)
    if ward:
        query = query.filter(BudgetProject.ward == ward)
    if status and status.lower() != "all":
        query = query.filter(BudgetProject.status == status)

    projects = query.order_by(BudgetProject.vote_count.desc()).all()
    
    results = []
    user_voted_project_ids = set()
    if current_user:
        user_votes = db.query(ProjectVote.project_id).filter(
            ProjectVote.user_id == current_user.id
        ).all()
        user_voted_project_ids = {v[0] for v in user_votes}

    for p in projects:
        project_dict = {
            "id": p.id,
            "title": p.title,
            "description": p.description,
            "category": p.category,
            "ward": p.ward,
            "estimated_cost": p.estimated_cost,
            "allocated_funds": p.allocated_funds,
            "status": p.status,
            "vote_count": p.vote_count,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
            "user_has_voted": p.id in user_voted_project_ids
        }
        results.append(project_dict)

    return results


@router.post("/projects", response_model=BudgetProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    project_in: BudgetProjectCreate,
    current_officer: User = Depends(get_current_officer),
    db: Session = Depends(get_db)
) -> Any:
    """
    Create a new participatory budgeting proposal (Officer only).
    """
    project = BudgetProject(
        title=project_in.title,
        description=project_in.description,
        category=project_in.category,
        ward=project_in.ward or "Ward 12",
        estimated_cost=project_in.estimated_cost,
        allocated_funds=project_in.allocated_funds or 0.0,
        status=project_in.status or "Proposed",
        created_by_user_id=current_officer.id
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.post("/projects/{project_id}/vote", response_model=dict)
def vote_on_project(
    project_id: int,
    vote_in: ProjectVoteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Cast a citizen vote / support for a participatory budget project.
    """
    project = db.query(BudgetProject).filter(BudgetProject.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Budget project not found."
        )

    existing_vote = db.query(ProjectVote).filter(
        ProjectVote.project_id == project.id,
        ProjectVote.user_id == current_user.id
    ).first()

    if existing_vote:
        # Toggle / unvote
        db.delete(existing_vote)
        project.vote_count = max(0, project.vote_count - 1)
        db.commit()
        return {
            "voted": False,
            "vote_count": project.vote_count,
            "message": "Vote removed."
        }
    else:
        vote = ProjectVote(
            project_id=project.id,
            user_id=current_user.id,
            vote_type=vote_in.vote_type or "support",
            feedback=vote_in.feedback
        )
        db.add(vote)
        project.vote_count += 1
        db.commit()
        return {
            "voted": True,
            "vote_count": project.vote_count,
            "message": "Vote recorded successfully."
        }


@router.get("/summary", response_model=BudgetSummaryOut)
def get_budget_summary(db: Session = Depends(get_db)) -> Any:
    """
    Summary KPIs of civic participatory budgeting funds and citizen engagement.
    """
    projects = db.query(BudgetProject).all()
    
    total_allocated = sum(p.allocated_funds for p in projects)
    total_estimated = sum(p.estimated_cost for p in projects)
    total_votes = sum(p.vote_count for p in projects)
    active_proposals = sum(1 for p in projects if p.status in ["Proposed", "Under Review"])
    approved_projects = sum(1 for p in projects if p.status in ["Approved", "In Progress", "Completed"])

    return {
        "total_budget_allocated": total_allocated,
        "total_budget_estimated": total_estimated,
        "total_projects": len(projects),
        "active_proposals": active_proposals,
        "approved_projects": approved_projects,
        "total_community_votes": total_votes
    }

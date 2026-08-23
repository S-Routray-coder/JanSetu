from typing import Any, Optional, List, Dict
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.user import User
from app.models.grievance import Grievance
from app.models.evidence import Evidence
from app.schemas.analytics import CitizenAnalyticsOut, OfficerAnalyticsOut, StatBreakdown
from app.services.impact_calculator import ImpactCalculatorService
from app.api.deps import get_current_user, get_current_officer, get_optional_current_user

router = APIRouter()


@router.get("/citizen", response_model=CitizenAnalyticsOut)
def get_citizen_analytics(
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get citizen dashboard metrics and impact KPIs.
    """
    if current_user:
        query = db.query(Grievance).filter(Grievance.citizen_id == current_user.id)
        user_id = current_user.id
    else:
        # Default global/sample stats if viewing unauthenticated
        query = db.query(Grievance)
        user_id = None

    total_submitted = query.count()
    in_progress = query.filter(Grievance.status == "In Progress").count()
    resolved = query.filter(Grievance.status == "Resolved").count()
    rejected = query.filter(Grievance.status == "Rejected").count()

    resolution_rate = round((resolved / total_submitted * 100), 1) if total_submitted > 0 else 0.0

    # Calculate community impact score
    if user_id:
        community_impact = ImpactCalculatorService.calculate_citizen_impact(db, user_id)
    else:
        community_impact = total_submitted * 4

    # Category breakdown
    cat_counts = db.query(
        Grievance.category,
        func.count(Grievance.id)
    )
    if user_id:
        cat_counts = cat_counts.filter(Grievance.citizen_id == user_id)
    cat_counts = cat_counts.group_by(Grievance.category).all()

    category_breakdown = []
    for cat, count in cat_counts:
        category_breakdown.append(StatBreakdown(
            name=cat,
            count=count,
            percentage=round((count / total_submitted * 100), 1) if total_submitted > 0 else 0.0
        ))

    return {
        "reports_submitted": total_submitted,
        "in_progress": in_progress,
        "resolved": resolved,
        "rejected": rejected,
        "community_impact": community_impact,
        "resolution_rate_percent": resolution_rate,
        "category_breakdown": category_breakdown,
        "recent_activity_count": query.filter(Grievance.created_at >= datetime.utcnow() - timedelta(days=7)).count()
    }


@router.get("/officer", response_model=OfficerAnalyticsOut)
def get_officer_analytics(
    current_officer: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get officer control center metrics, category distributions, and SLA metrics.
    """
    all_grievances = db.query(Grievance).all()
    total = len(all_grievances)
    pending = sum(1 for g in all_grievances if g.status == "Pending")
    in_prog = sum(1 for g in all_grievances if g.status == "In Progress")
    resolved = sum(1 for g in all_grievances if g.status == "Resolved")
    urgent = sum(1 for g in all_grievances if g.priority in ["Critical", "High"] and g.status != "Resolved")

    resolution_rate = round((resolved / total * 100), 1) if total > 0 else 0.0

    # Calculate average resolution time for resolved grievances
    resolved_with_time = [g for g in all_grievances if g.resolved_at and g.created_at]
    if resolved_with_time:
        total_seconds = sum((g.resolved_at - g.created_at).total_seconds() for g in resolved_with_time)
        avg_hours = round(total_seconds / (len(resolved_with_time) * 3600), 1)
    else:
        avg_hours = 24.5  # Realistic baseline

    # Category breakdown
    cat_map = {}
    prio_map = {}
    ward_map = {}

    for g in all_grievances:
        cat_map[g.category] = cat_map.get(g.category, 0) + 1
        prio_map[g.priority] = prio_map.get(g.priority, 0) + 1
        w = g.ward or "Ward 12"
        ward_map[w] = ward_map.get(w, 0) + 1

    category_breakdown = [
        StatBreakdown(name=k, count=v, percentage=round(v / total * 100, 1) if total else 0.0)
        for k, v in cat_map.items()
    ]
    priority_breakdown = [
        StatBreakdown(name=k, count=v, percentage=round(v / total * 100, 1) if total else 0.0)
        for k, v in prio_map.items()
    ]
    ward_breakdown = [
        StatBreakdown(name=k, count=v, percentage=round(v / total * 100, 1) if total else 0.0)
        for k, v in ward_map.items()
    ]

    pending_evidence = db.query(Evidence).filter(Evidence.is_verified == False).count()

    return {
        "total_grievances": total,
        "pending_review": pending,
        "in_progress": in_prog,
        "urgent_critical": urgent,
        "resolved": resolved,
        "resolution_rate_percent": resolution_rate,
        "avg_resolution_hours": avg_hours,
        "category_breakdown": category_breakdown,
        "priority_breakdown": priority_breakdown,
        "ward_breakdown": ward_breakdown,
        "pending_evidence_count": pending_evidence
    }

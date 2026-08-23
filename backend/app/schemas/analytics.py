from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class StatBreakdown(BaseModel):
    name: str
    count: int
    percentage: float = 0.0


class CitizenAnalyticsOut(BaseModel):
    reports_submitted: int
    in_progress: int
    resolved: int
    rejected: int
    community_impact: int
    resolution_rate_percent: float
    category_breakdown: List[StatBreakdown] = []
    recent_activity_count: int = 0


class OfficerAnalyticsOut(BaseModel):
    total_grievances: int
    pending_review: int
    in_progress: int
    urgent_critical: int
    resolved: int
    resolution_rate_percent: float
    avg_resolution_hours: float
    category_breakdown: List[StatBreakdown] = []
    priority_breakdown: List[StatBreakdown] = []
    ward_breakdown: List[StatBreakdown] = []
    pending_evidence_count: int = 0

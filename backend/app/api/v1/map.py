from typing import Any, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.config import settings
from app.models.grievance import Grievance

router = APIRouter()


@router.get("/config")
def get_map_config() -> Any:
    """
    Public configuration for frontend mapping integration.
    """
    return {
        "google_maps_api_key": settings.GOOGLE_MAPS_API_KEY,
        "default_center": {"lat": 20.2961, "lng": 85.8245},
        "default_zoom": 13
    }


@router.get("/points")
def get_map_points(
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    db: Session = Depends(get_db)
) -> Any:
    """
    GeoJSON-friendly collection of all grievances with coordinates for interactive mapping.
    """
    query = db.query(Grievance).filter(
        Grievance.latitude.isnot(None),
        Grievance.longitude.isnot(None)
    )

    if category and category.lower() != "all":
        query = query.filter(Grievance.category.ilike(category))
    if status and status.lower() != "all":
        query = query.filter(Grievance.status.ilike(status))
    if priority and priority.lower() != "all":
        query = query.filter(Grievance.priority.ilike(priority))

    grievances = query.all()

    features = []
    for g in grievances:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [g.longitude, g.latitude]
            },
            "properties": {
                "id": g.id,
                "ticket_id": g.ticket_id,
                "title": g.title,
                "category": g.category,
                "status": g.status,
                "priority": g.priority,
                "ward": g.ward,
                "landmark": g.landmark,
                "impact_count": g.community_impact_count,
                "created_at": g.created_at.isoformat()
            }
        })

    return {
        "type": "FeatureCollection",
        "features": features
    }


@router.get("/hotspots")
def get_hotspots(db: Session = Depends(get_db)) -> Any:
    """
    Cluster analysis of civic issue concentrations by locality and category.
    """
    # Group by ward & category
    results = db.query(
        Grievance.ward,
        Grievance.category,
        func.count(Grievance.id).label("count"),
        func.avg(Grievance.latitude).label("avg_lat"),
        func.avg(Grievance.longitude).label("avg_lng")
    ).filter(
        Grievance.status != "Resolved"
    ).group_by(
        Grievance.ward,
        Grievance.category
    ).order_by(
        func.count(Grievance.id).desc()
    ).all()

    hotspots = []
    for row in results:
        hotspots.append({
            "ward": row.ward or "General",
            "category": row.category,
            "active_issues_count": row.count,
            "centroid": {
                "lat": round(row.avg_lat, 5) if row.avg_lat else None,
                "lng": round(row.avg_lng, 5) if row.avg_lng else None
            },
            "intensity": "High" if row.count >= 3 else ("Medium" if row.count >= 2 else "Low")
        })

    return {"hotspots": hotspots}

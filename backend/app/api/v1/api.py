from fastapi import APIRouter
from app.api.v1 import auth, grievances, triage, evidence, budget, map, analytics, notifications

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication & Profile"])
api_router.include_router(grievances.router, prefix="/grievances", tags=["Grievances"])
api_router.include_router(triage.router, prefix="/triage", tags=["AI Triage & Intelligence"])
api_router.include_router(evidence.router, prefix="/evidence", tags=["Evidence Management"])
api_router.include_router(budget.router, prefix="/budget", tags=["Participatory Budgeting"])
api_router.include_router(map.router, prefix="/map", tags=["Civic Map & Geo-Intelligence"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics & KPIs"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])

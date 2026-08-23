from typing import Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.triage import (
    TriagePreviewRequest, 
    TriagePreviewResponse, 
    DuplicateCheckRequest, 
    DuplicateCheckResponse,
    TranslationRequest,
    TranslationResponse,
    GeocodeRequest,
    GeocodeResponse
)
from app.services.ai_triage import AITriageService
from app.services.duplicate_finder import DuplicateFinderService

router = APIRouter()


@router.post("/preview", response_model=TriagePreviewResponse)
def triage_preview(request: TriagePreviewRequest) -> Any:
    """
    Real-time AI classification and triage preview for text/voice input.
    Provides instant category, suggested department, urgency, and severity.
    """
    result = AITriageService.classify_grievance(
        text=request.description
    )
    return result


@router.post("/check-duplicates", response_model=DuplicateCheckResponse)
def check_duplicates(
    request: DuplicateCheckRequest,
    db: Session = Depends(get_db)
) -> Any:
    """
    Real-time geo-spatial and semantic duplicate detection.
    Finds existing active complaints in the area and calculates cluster impact.
    """
    result = DuplicateFinderService.find_duplicates(
        db=db,
        description=request.description,
        latitude=request.latitude,
        longitude=request.longitude,
        radius_meters=request.radius_meters or 1000.0
    )
    return result


@router.post("/translate", response_model=TranslationResponse)
def translate_text(request: TranslationRequest) -> Any:
    """
    AI multilingual translation for civic voice narration and regional readability.
    """
    result = AITriageService.translate_text(
        text=request.text,
        target_lang=request.target_lang
    )
    return result


@router.post("/geocode", response_model=GeocodeResponse)
def geocode_location(request: GeocodeRequest) -> Any:
    """
    Resolves Odisha civic landmarks and coordinates for accurate map placement.
    """
    result = AITriageService.geocode_location(
        query=request.query,
        user_lat=request.latitude,
        user_lng=request.longitude
    )
    return result


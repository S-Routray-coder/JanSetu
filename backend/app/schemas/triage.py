from typing import Optional, List
from pydantic import BaseModel


class TriagePreviewRequest(BaseModel):
    description: str
    language: Optional[str] = "en"
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class TriagePreviewResponse(BaseModel):
    category: str
    suggested_department: str
    priority: str
    severity: str
    confidence: float
    summary: str
    key_entities: List[str] = []
    urgency_reason: Optional[str] = None
    estimated_sla_hours: Optional[int] = 48
    ai_engine: Optional[str] = "JanSetu Multilingual NLP Engine"
    detected_location: Optional[str] = None
    detected_latitude: Optional[float] = None
    detected_longitude: Optional[float] = None
    detected_ward: Optional[str] = None


class DuplicateCheckRequest(BaseModel):
    description: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_meters: Optional[float] = 1000.0  # 1km default


class DuplicateMatch(BaseModel):
    id: int
    ticket_id: str
    title: str
    category: str
    status: str
    similarity_score: float
    distance_meters: Optional[float] = None
    created_at: str


class DuplicateCheckResponse(BaseModel):
    is_duplicate_likely: bool
    potential_matches: List[DuplicateMatch] = []
    cluster_size: int = 0
    estimated_impact_multiplier: int = 1


class TranslationRequest(BaseModel):
    text: str
    target_lang: str = "hi"


class TranslationResponse(BaseModel):
    original_text: str
    translated_text: str
    target_lang: str
    language_name: str


class GeocodeRequest(BaseModel):
    query: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class GeocodeResponse(BaseModel):
    latitude: float
    longitude: float
    address: str
    ward: str


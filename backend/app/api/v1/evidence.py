import os
import uuid
import shutil
from typing import Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.models.evidence import Evidence
from app.models.grievance import Grievance
from app.schemas.grievance import EvidenceOut
from app.api.deps import get_current_user, get_current_officer

router = APIRouter()

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".pdf", ".mp4"}


@router.get("/", response_model=List[EvidenceOut])
def list_evidence(
    grievance_id: Optional[int] = None,
    is_verified: Optional[bool] = None,
    db: Session = Depends(get_db)
) -> Any:
    """
    List uploaded evidence records.
    """
    query = db.query(Evidence)
    if grievance_id:
        query = query.filter(Evidence.grievance_id == grievance_id)
    if is_verified is not None:
        query = query.filter(Evidence.is_verified == is_verified)
    return query.order_by(Evidence.created_at.desc()).all()


@router.post("/upload", response_model=EvidenceOut, status_code=status.HTTP_201_CREATED)
def upload_evidence(
    file: UploadFile = File(...),
    grievance_id: Optional[int] = Form(None),
    evidence_type: str = Form("report_proof"),  # report_proof or resolution_proof
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Upload evidence photo/media file for a grievance.
    """
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File extension {ext} not allowed. Supported: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # If grievance_id is passed, verify existence
    if grievance_id:
        grievance = db.query(Grievance).filter(Grievance.id == grievance_id).first()
        if not grievance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Grievance not found."
            )

    unique_filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_url = f"/uploads/{unique_filename}"

    evidence = Evidence(
        grievance_id=grievance_id,
        uploaded_by_user_id=current_user.id,
        file_name=file.filename,
        file_path=file_path,
        file_url=file_url,
        file_type=file.content_type or "application/octet-stream",
        evidence_type=evidence_type,
        is_verified=False
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)

    return evidence


@router.patch("/{evidence_id}/review", response_model=EvidenceOut)
def review_evidence(
    evidence_id: int,
    is_verified: bool = Form(...),
    notes: Optional[str] = Form(None),
    current_officer: User = Depends(get_current_officer),
    db: Session = Depends(get_db)
) -> Any:
    """
    Officer approval or rejection of submitted evidence.
    """
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Evidence record not found."
        )

    evidence.is_verified = is_verified
    evidence.verification_notes = notes
    db.commit()
    db.refresh(evidence)

    return evidence

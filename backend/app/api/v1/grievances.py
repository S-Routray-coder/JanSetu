from typing import Any, List, Optional
from datetime import datetime
import random
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.grievance import Grievance, GrievanceStatusHistory, GrievanceSupport, GrievanceStatus, GrievanceReview, WardBulletin
from app.schemas.grievance import GrievanceCreate, GrievanceOut, GrievanceDetail, GrievanceStatusUpdate, GrievanceReviewCreate, GrievanceReviewOut, GrievanceAssign, WardBulletinCreate, WardBulletinOut
from app.services.ai_triage import AITriageService
from app.services.duplicate_finder import DuplicateFinderService
from app.services.notification_mgr import NotificationManager
from app.api.deps import get_current_user, get_current_officer, get_optional_current_user

router = APIRouter()


def generate_ticket_id(db: Session) -> str:
    """Generate a unique human-readable ticket ID like JS-20481."""
    while True:
        num = random.randint(20000, 99999)
        ticket = f"JS-{num}"
        if not db.query(Grievance).filter(Grievance.ticket_id == ticket).first():
            return ticket


@router.post("/", response_model=GrievanceOut, status_code=status.HTTP_201_CREATED)
def create_grievance(
    grievance_in: GrievanceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Submit a new civic grievance.
    Automatically triggers AI classification, department assignment, and severity detection.
    """
    # Run AI triage
    ai_result = AITriageService.classify_grievance(
        text=grievance_in.description,
        user_category=grievance_in.category
    )
    
    ticket_id = generate_ticket_id(db)
    title = grievance_in.title or (grievance_in.description[:60].strip() + "...")

    # Accurate Geocoding for Map Pinning
    geo_res = AITriageService.geocode_location(
        query=f"{grievance_in.landmark or ''} {grievance_in.address or ''} {grievance_in.title or ''}",
        user_lat=grievance_in.latitude,
        user_lng=grievance_in.longitude
    )
    final_lat = geo_res["latitude"]
    final_lng = geo_res["longitude"]
    final_ward = grievance_in.ward or geo_res.get("ward") or current_user.ward or "Ward 12"
    final_addr = grievance_in.address or geo_res.get("address") or "Bhubaneswar Central Zone"

    # Check for potential duplicates to calculate initial community impact count
    dup_analysis = DuplicateFinderService.find_duplicates(
        db=db,
        description=grievance_in.description,
        category=ai_result["category"],
        latitude=final_lat,
        longitude=final_lng
    )

    impact_count = dup_analysis.get("cluster_size", 0) + 1

    grievance = Grievance(
        ticket_id=ticket_id,
        title=title,
        description=grievance_in.description,
        category=ai_result["category"],
        status=GrievanceStatus.PENDING.value,
        priority=ai_result["priority"],
        language=grievance_in.language or "en",
        latitude=final_lat,
        longitude=final_lng,
        address=final_addr,
        landmark=grievance_in.landmark or final_addr,
        ward=final_ward,
        department=ai_result["suggested_department"],
        ai_confidence=ai_result["confidence"],
        ai_summary=ai_result["summary"],
        community_impact_count=impact_count,
        citizen_id=current_user.id
    )

    db.add(grievance)
    db.commit()
    db.refresh(grievance)

    # Add initial history entry
    history = GrievanceStatusHistory(
        grievance_id=grievance.id,
        old_status=None,
        new_status=GrievanceStatus.PENDING.value,
        changed_by_user_id=current_user.id,
        comments="Grievance submitted by citizen with automated AI triage."
    )
    db.add(history)
    db.commit()

    # Send citizen notification
    NotificationManager.notify_user(
        db=db,
        user_id=current_user.id,
        title="Grievance Received",
        message=f"Your grievance #{grievance.ticket_id} has been registered and routed to {grievance.department}.",
        notification_type="status_update",
        link="/citizendashboard.html#reports"
    )

    return grievance


@router.get("/", response_model=List[GrievanceOut])
def list_grievances(
    status: Optional[str] = Query(None, description="Filter by status: Pending, In Progress, Resolved, Rejected"),
    category: Optional[str] = Query(None, description="Filter by category"),
    priority: Optional[str] = Query(None, description="Filter by priority: Critical, High, Medium, Low"),
    ward: Optional[str] = Query(None, description="Filter by ward"),
    search: Optional[str] = Query(None, description="Search query across ticket ID, title, description, landmark"),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
) -> Any:
    """
    List civic grievances with comprehensive filtering and search capabilities.
    """
    query = db.query(Grievance)

    if status and status.lower() != "all":
        query = query.filter(Grievance.status.ilike(status))
    if category and category.lower() != "all":
        query = query.filter(Grievance.category.ilike(category))
    if priority and priority.lower() != "all":
        query = query.filter(Grievance.priority.ilike(priority))
    if ward and ward.lower() != "all":
        query = query.filter(Grievance.ward.ilike(ward))
    if search:
        search_fmt = f"%{search.lower()}%"
        query = query.filter(
            or_(
                Grievance.ticket_id.ilike(search_fmt),
                Grievance.title.ilike(search_fmt),
                Grievance.description.ilike(search_fmt),
                Grievance.landmark.ilike(search_fmt),
                Grievance.address.ilike(search_fmt),
                Grievance.ward.ilike(search_fmt),
            )
        )

    return query.order_by(desc(Grievance.created_at)).offset(skip).limit(limit).all()


@router.get("/my", response_model=List[GrievanceOut])
def list_my_grievances(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    List grievances submitted by the currently logged-in citizen.
    """
    return db.query(Grievance).filter(
        Grievance.citizen_id == current_user.id
    ).order_by(desc(Grievance.created_at)).all()


@router.get("/{grievance_id_or_ticket}", response_model=GrievanceDetail)
def get_grievance_detail(
    grievance_id_or_ticket: str,
    db: Session = Depends(get_db)
) -> Any:
    """
    Fetch grievance details by numeric ID or ticket string (e.g. JS-20481).
    """
    if grievance_id_or_ticket.isdigit():
        grievance = db.query(Grievance).filter(Grievance.id == int(grievance_id_or_ticket)).first()
    else:
        grievance = db.query(Grievance).filter(Grievance.ticket_id.ilike(grievance_id_or_ticket)).first()

    if not grievance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grievance record not found."
        )
    return grievance


@router.patch("/{grievance_id}/status", response_model=GrievanceDetail)
def update_grievance_status(
    grievance_id: int,
    update_data: GrievanceStatusUpdate,
    current_officer: User = Depends(get_current_officer),
    db: Session = Depends(get_db)
) -> Any:
    """
    Update grievance status, assign officer, and add resolution remarks.
    Only available to municipal officers and administrators.
    """
    grievance = db.query(Grievance).filter(Grievance.id == grievance_id).first()
    if not grievance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grievance record not found."
        )

    old_status = grievance.status
    new_status = update_data.status

    grievance.status = new_status
    if update_data.assigned_officer_id:
        grievance.assigned_officer_id = update_data.assigned_officer_id
    elif not grievance.assigned_officer_id:
        grievance.assigned_officer_id = current_officer.id

    if update_data.priority:
        grievance.priority = update_data.priority

    if update_data.resolution_notes:
        grievance.resolution_notes = update_data.resolution_notes

    if update_data.resolution_proof_url:
        grievance.resolution_proof_url = update_data.resolution_proof_url

    if new_status == GrievanceStatus.RESOLVED.value:
        grievance.resolved_at = datetime.utcnow()

    # Record history
    history = GrievanceStatusHistory(
        grievance_id=grievance.id,
        old_status=old_status,
        new_status=new_status,
        changed_by_user_id=current_officer.id,
        comments=update_data.comments or f"Status changed to {new_status} by officer {current_officer.full_name}."
    )
    db.add(history)
    db.commit()
    db.refresh(grievance)

    # Send citizen notification
    NotificationManager.notify_grievance_status_change(
        db=db,
        citizen_id=grievance.citizen_id,
        ticket_id=grievance.ticket_id,
        title=grievance.title,
        old_status=old_status,
        new_status=new_status
    )

    return grievance


@router.post("/{grievance_id}/assign", response_model=GrievanceDetail)
def assign_grievance_contractor(
    grievance_id: int,
    assign_data: GrievanceAssign,
    current_officer: User = Depends(get_current_officer),
    db: Session = Depends(get_db)
) -> Any:
    """
    Assign municipal nodal officer, contractor agency, work order ID, and SLA target date.
    """
    grievance = db.query(Grievance).filter(Grievance.id == grievance_id).first()
    if not grievance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grievance not found."
        )

    if assign_data.contractor_name:
        grievance.contractor_name = assign_data.contractor_name
    if assign_data.contractor_contact:
        grievance.contractor_contact = assign_data.contractor_contact
    if assign_data.work_order_id:
        grievance.work_order_id = assign_data.work_order_id
    if assign_data.target_sla_date:
        grievance.target_sla_date = assign_data.target_sla_date
    if assign_data.assigned_officer_name:
        grievance.assigned_officer_name = assign_data.assigned_officer_name
    if assign_data.assigned_officer_contact:
        grievance.assigned_officer_contact = assign_data.assigned_officer_contact
    if assign_data.department:
        grievance.department = assign_data.department
    if assign_data.priority:
        grievance.priority = assign_data.priority

    # Auto-move status to In Progress
    if grievance.status == GrievanceStatus.PENDING.value:
        grievance.status = GrievanceStatus.IN_PROGRESS.value

    # Record history
    history = GrievanceStatusHistory(
        grievance_id=grievance.id,
        old_status=grievance.status,
        new_status=GrievanceStatus.IN_PROGRESS.value,
        changed_by_user_id=current_officer.id,
        comments=f"Dispatched to {grievance.contractor_name} under Work Order {grievance.work_order_id}. SLA: {grievance.target_sla_date}."
    )
    db.add(history)
    db.commit()
    db.refresh(grievance)
    return grievance


@router.post("/{grievance_id}/reviews", response_model=GrievanceReviewOut, status_code=status.HTTP_201_CREATED)
def create_citizen_review(
    grievance_id: int,
    review_in: GrievanceReviewCreate,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Submit citizen community review with star rating, verification status, and photo proof.
    """
    grievance = db.query(Grievance).filter(Grievance.id == grievance_id).first()
    if not grievance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grievance not found."
        )

    user_name = review_in.user_name or (current_user.full_name if current_user else "Resident Citizen")
    user_id = current_user.id if current_user else None

    review = GrievanceReview(
        grievance_id=grievance.id,
        user_id=user_id,
        user_name=user_name,
        user_role="Verified Resident",
        rating=max(1, min(5, review_in.rating)),
        is_verified_fixed=review_in.is_verified_fixed,
        comment=review_in.comment,
        proof_image_url=review_in.proof_image_url,
        helpful_count=0
    )
    db.add(review)

    # If citizen disputes resolution (is_verified_fixed == 0) and rating is low, record a dispute notice
    if review_in.is_verified_fixed == 0:
        history = GrievanceStatusHistory(
            grievance_id=grievance.id,
            old_status=grievance.status,
            new_status=grievance.status,
            comments=f"Citizen Dispute Registered: '{review_in.comment}' by {user_name}."
        )
        db.add(history)

    db.commit()
    db.refresh(review)
    return review


@router.get("/{grievance_id}/reviews", response_model=List[GrievanceReviewOut])
def get_grievance_reviews(
    grievance_id: int,
    db: Session = Depends(get_db)
) -> Any:
    """
    List all citizen community verification reviews for a grievance.
    """
    reviews = db.query(GrievanceReview).filter(
        GrievanceReview.grievance_id == grievance_id
    ).order_by(desc(GrievanceReview.created_at)).all()

    # If no reviews yet, return sample default reviews for resolved complaints
    if not reviews:
        grievance = db.query(Grievance).filter(Grievance.id == grievance_id).first()
        if grievance and (grievance.status == "Resolved" or grievance.ticket_id in ["JS-20482", "JS-20462"]):
            sample1 = GrievanceReview(
                grievance_id=grievance.id,
                user_name="Priyanka Senapati",
                user_role="Verified Resident (Ward 12)",
                rating=5,
                is_verified_fixed=1,
                comment="The road repair was completed yesterday evening by the municipal team. Smooth asphalt finish and barricades were cleared on time.",
                proof_image_url="https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&auto=format&fit=crop&q=60",
                helpful_count=12
            )
            sample2 = GrievanceReview(
                grievance_id=grievance.id,
                user_name="Alok Mohanty",
                user_role="Daily Commuter",
                rating=4,
                is_verified_fixed=1,
                comment="Inspected the spot this morning on my way to work. Pothole is filled properly and drainage opening is left unobstructed. Good job!",
                proof_image_url=None,
                helpful_count=7
            )
            db.add(sample1)
            db.add(sample2)
            db.commit()
            return [sample1, sample2]

    return reviews


@router.post("/reviews/{review_id}/helpful", response_model=dict)
def upvote_review_helpful(
    review_id: int,
    db: Session = Depends(get_db)
) -> Any:
    """
    Upvote a community citizen review as 'Helpful'.
    """
    review = db.query(GrievanceReview).filter(GrievanceReview.id == review_id).first()
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found."
        )

    review.helpful_count = (review.helpful_count or 0) + 1
    db.commit()
    return {"helpful_count": review.helpful_count, "message": "Marked as helpful."}


@router.post("/{grievance_id}/support", response_model=dict)
def support_grievance(
    grievance_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Citizen 'Upvote / Me-Too' support for a grievance, boosting community impact score.
    """
    grievance = db.query(Grievance).filter(Grievance.id == grievance_id).first()
    if not grievance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grievance not found."
        )

    existing = db.query(GrievanceSupport).filter(
        GrievanceSupport.grievance_id == grievance.id,
        GrievanceSupport.user_id == current_user.id
    ).first()

    if existing:
        db.delete(existing)
        grievance.community_impact_count = max(1, grievance.community_impact_count - 1)
        db.commit()
        return {
            "supported": False,
            "community_impact_count": grievance.community_impact_count,
            "message": "Support removed."
        }
    else:
        support = GrievanceSupport(grievance_id=grievance.id, user_id=current_user.id)
        db.add(support)
        grievance.community_impact_count = (grievance.community_impact_count or 1) + 1
        db.commit()
        return {
            "supported": True,
            "community_impact_count": grievance.community_impact_count,
            "message": "Thank you for corroborating this civic issue."
        }


# ==========================================
# WARD COMMUNITY BULLETIN & NOTICES
# ==========================================

@router.get("/bulletin/list", response_model=List[WardBulletinOut])
def get_ward_bulletins(
    ward: Optional[str] = Query(None),
    db: Session = Depends(get_db)
) -> Any:
    """
    Fetch active ward announcements and emergency service advisories.
    """
    query = db.query(WardBulletin).filter(WardBulletin.is_active == 1)
    if ward:
        query = query.filter(or_(WardBulletin.ward == ward, WardBulletin.ward == "All Wards"))
    
    bulletins = query.order_by(desc(WardBulletin.created_at)).all()

    # Seed default sample bulletins if empty
    if not bulletins:
        b1 = WardBulletin(
            title="Scheduled Water Supply Maintenance (Sunday 8 AM - 2 PM)",
            message="Municipal PHED pipeline interconnection work will take place in Ward 12 & Saheed Nagar on Sunday. Citizens are requested to store adequate water.",
            category="Water Supply",
            urgency="High",
            ward="Ward 12",
            author_name="Er. S. Patnaik",
            author_role="Executive Engineer (PHED)"
        )
        b2 = WardBulletin(
            title="Monsoon Stormwater Drain Desilting Drive Underway",
            message="Rapid response teams are clearing primary culvert drains across Market Road and Unit 4 junctions. Please avoid dumping solid waste into open drains.",
            category="Drainage",
            urgency="Normal",
            ward="Ward 12",
            author_name="Municipal Health Officer",
            author_role="Sanitation Division"
        )
        b3 = WardBulletin(
            title="Ward 12 Participatory Budget Voting Closes in 48 Hours",
            message="Final 48 hours remaining for citizens to vote on the ₹18.4 Lakh community solar lighting and park development proposals.",
            category="Participatory Budget",
            urgency="Normal",
            ward="Ward 12",
            author_name="Smt. Jayashree Das",
            author_role="Ward 12 Councillor"
        )
        db.add_all([b1, b2, b3])
        db.commit()
        return [b1, b2, b3]

    return bulletins


@router.post("/bulletin/create", response_model=WardBulletinOut, status_code=status.HTTP_201_CREATED)
def create_ward_bulletin(
    bulletin_in: WardBulletinCreate,
    current_officer: User = Depends(get_current_officer),
    db: Session = Depends(get_db)
) -> Any:
    """
    Post an official municipal bulletin or emergency service advisory.
    """
    bulletin = WardBulletin(
        title=bulletin_in.title,
        message=bulletin_in.message,
        category=bulletin_in.category or "Service Advisory",
        urgency=bulletin_in.urgency or "Normal",
        ward=bulletin_in.ward or "Ward 12",
        author_name=current_officer.full_name,
        author_role=f"{current_officer.department} Nodal Officer"
    )
    db.add(bulletin)
    db.commit()
    db.refresh(bulletin)
    return bulletin


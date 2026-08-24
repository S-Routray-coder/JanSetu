import re
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from email_validator import validate_email, EmailNotValidError

from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserLogin, UserOut, Token, UserUpdate, EmailVerifyRequest, EmailVerifyResponse
from app.api.deps import get_current_user

router = APIRouter()


def check_email_validity(email: str) -> str:
    """
    Validates email format and structure.
    Returns normalized email if valid, or raises HTTPException.
    """
    cleaned_email = (email or "").strip().lower()
    if not cleaned_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address is required."
        )

    # Basic regex validation
    email_regex = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    if not re.match(email_regex, cleaned_email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{cleaned_email}' is not a valid email address format."
        )

    try:
        # Check syntax & domain validation via email_validator
        valid = validate_email(cleaned_email, check_deliverability=False)
        return valid.normalized.lower()
    except EmailNotValidError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid email address: {str(e)}"
        )


@router.post("/verify-email", response_model=EmailVerifyResponse)
def verify_email_existence(req: EmailVerifyRequest, db: Session = Depends(get_db)) -> Any:
    """
    Check if an email address has a valid format and whether it is already registered.
    """
    raw_email = (req.email or "").strip()
    try:
        normalized = check_email_validity(raw_email)
        is_valid = True
    except HTTPException:
        return {
            "email": raw_email,
            "is_valid_format": False,
            "exists_in_database": False,
            "message": "Invalid email address format."
        }

    user = db.query(User).filter(User.email.ilike(normalized)).first()
    if user:
        return {
            "email": normalized,
            "is_valid_format": True,
            "exists_in_database": True,
            "message": f"Account with {normalized} already exists."
        }
    else:
        return {
            "email": normalized,
            "is_valid_format": True,
            "exists_in_database": False,
            "message": f"Email {normalized} is available for registration."
        }


@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
def signup(user_in: UserCreate, db: Session = Depends(get_db)) -> Any:
    """
    Register a new user with email verification and duplicate protection.
    """
    normalized_email = check_email_validity(user_in.email)

    existing = db.query(User).filter(User.email.ilike(normalized_email)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An account with email '{normalized_email}' already exists. Please log in instead."
        )
    
    user = User(
        email=normalized_email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name.strip(),
        role=user_in.role or UserRole.CITIZEN,
        phone=user_in.phone,
        ward=user_in.ward or "Ward 12",
        department=user_in.department
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=user.id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }


@router.post("/login", response_model=Token)
def login(user_in: UserLogin, db: Session = Depends(get_db)) -> Any:
    """
    JSON-based login with explicit email existence check.
    """
    normalized_email = check_email_validity(user_in.email)

    # 1. Verify existence of the email
    user = db.query(User).filter(User.email.ilike(normalized_email)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No account found with email '{normalized_email}'. Please sign up first."
        )
    
    # 2. Verify password
    if not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password. Please verify and try again."
        )
    
    # 3. Verify account active state
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your account is currently inactive. Please contact municipal support."
        )

    token = create_access_token(subject=user.id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }


@router.post("/login-form", response_model=Token)
def login_form(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)) -> Any:
    """
    OAuth2 standard password form login for Swagger docs.
    """
    cleaned_email = form_data.username.strip().lower()
    user = db.query(User).filter(User.email.ilike(cleaned_email)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No account found with email '{cleaned_email}'."
        )
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password."
        )
    token = create_access_token(subject=user.id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }


@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)) -> Any:
    """
    Get current logged-in user profile.
    """
    return current_user


@router.put("/me", response_model=UserOut)
def update_current_user(
    update_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Update profile details for the current user.
    """
    if update_data.full_name is not None:
        current_user.full_name = update_data.full_name
    if update_data.phone is not None:
        current_user.phone = update_data.phone
    if update_data.ward is not None:
        current_user.ward = update_data.ward
    if update_data.department is not None:
        current_user.department = update_data.department

    db.commit()
    db.refresh(current_user)
    return current_user

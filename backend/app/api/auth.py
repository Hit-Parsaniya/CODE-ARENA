from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.core.config import settings
from app.core.security import hash_password, verify_password, create_access_token
from app.core.logging import audit_logger
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse, TokenResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(user_in: UserCreate, db: Session = Depends(get_db)):
    """
    Registers a new user and returns an access token along with user profile.
    """
    # Check if username or email already exists
    existing_user = db.query(User).filter(
        or_(User.username == user_in.username, User.email == user_in.email)
    ).first()

    if existing_user:
        if existing_user.username == user_in.username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this username already exists."
            )
        if existing_user.email == user_in.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email address already exists."
            )

    # Hash the password with bcrypt
    hashed_password = hash_password(user_in.password)

    new_user = User(
        username=user_in.username,
        email=user_in.email,
        password_hash=hashed_password
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Issue JWT token
    access_token = create_access_token(
        subject=str(new_user.id),
        extra_claims={"username": new_user.username, "email": new_user.email}
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(new_user)
    )


@router.post("/login", response_model=TokenResponse)
def login(login_in: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticates a user via username or email and password, returning an access token.
    Accepts an optional intended_role field for logging/analytics (does NOT alter role or granted access).
    """
    identifier = login_in.username_or_email.strip()
    user = db.query(User).filter(
        or_(User.username == identifier, User.email == identifier)
    ).first()

    if not user or not verify_password(login_in.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Issue JWT token
    access_token = create_access_token(
        subject=str(user.id),
        extra_claims={"username": user.username, "email": user.email}
    )

    # Log login analytics (purely informational)
    if login_in.intended_role:
        audit_logger.info({
            "event": "user_login",
            "user_id": user.id,
            "username": user.username,
            "actual_role": user.role,
            "intended_role": login_in.intended_role,
        })

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.get("/me", response_model=UserResponse)
def read_current_user(current_user: User = Depends(get_current_user)):
    """
    Fetches the profile of the currently authenticated user.
    """
    return UserResponse.model_validate(current_user)

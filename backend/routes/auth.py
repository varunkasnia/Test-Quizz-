from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from database import User, get_db
from schemas import AuthTokenResponse, AuthUserResponse, LoginRequest, SignupRequest
from services.auth_service import create_access_token, decode_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["Auth"])
security = HTTPBearer(auto_error=False)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    subject = decode_access_token(credentials.credentials)
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    try:
        user_id = int(subject)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject") from exc

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user


@router.post("/signup", response_model=AuthTokenResponse)
async def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    email = _normalize_email(payload.email)

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email is already registered")

    user = User(
        full_name=payload.full_name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=str(user.id))

    return AuthTokenResponse(
        access_token=token,
        user=AuthUserResponse(
            id=user.id,
            full_name=user.full_name,
            email=user.email,
            role=user.role,
            created_at=user.created_at,
        ),
    )


@router.post("/login", response_model=AuthTokenResponse)
async def login(payload: LoginRequest, db: Session = Depends(get_db)):
    email = _normalize_email(payload.email)

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if user.role != payload.role:
        raise HTTPException(status_code=403, detail="Selected role does not match this account")

    token = create_access_token(subject=str(user.id))

    return AuthTokenResponse(
        access_token=token,
        user=AuthUserResponse(
            id=user.id,
            full_name=user.full_name,
            email=user.email,
            role=user.role,
            created_at=user.created_at,
        ),
    )


@router.get("/me", response_model=AuthUserResponse)
async def me(current_user: User = Depends(_get_current_user)):
    return AuthUserResponse(
        id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        role=current_user.role,
        created_at=current_user.created_at,
    )

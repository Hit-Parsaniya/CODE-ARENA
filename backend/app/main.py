from contextlib import asynccontextmanager
from typing import List
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded

from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import engine, Base
from app.core.limiter import limiter
from app.core.logging import audit_logger, log_execution_event
# Import all models to ensure metadata registration
from app.models.user import User  # noqa: F401
from app.models.problem import Problem, TestCase, Submission  # noqa: F401
from app.models.contest import Contest, ContestProblem, ContestParticipant, ContestSubmission, ContestInvite  # noqa: F401
from app.api.auth import router as auth_router
from app.api.run import router as run_router
from app.api.problems import router as problems_router
from app.api.submissions import router as submissions_router
from app.api.contests import router as contests_router
from app.api.ws import router as ws_router
from app.api.users import router as users_router
from app.api.admin import router as admin_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables exist on startup if migrations have not run yet
    try:
        Base.metadata.create_all(bind=engine)
        # Seed first admin if no admin exists
        with Session(engine) as db:
            admin_user = db.query(User).filter((User.role == "admin") | (User.is_admin == True)).first()
            if not admin_user:
                first_user = db.query(User).order_by(User.id.asc()).first()
                if first_user:
                    first_user.role = "admin"
                    first_user.is_admin = True
                    db.commit()
                    print(f"Seeded initial admin user: {first_user.username} (ID #{first_user.id})")
    except Exception as e:
        # In case DB is not yet available at import time
        print(f"Database initialization note: {e}")
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for AI Code Review & Contest Platform",
    version="1.0.0",
    lifespan=lifespan,
)

# Attach SlowAPI limiter to app state
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def custom_rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    client_ip = request.client.host if request.client else "unknown"
    log_execution_event(
        event_type="rate_limit_exceeded",
        endpoint=str(request.url.path),
        language="unknown",
        code_length=0,
        outcome={"error": "Rate limit exceeded (10 requests/minute)"},
        status_code=429,
        client_ip=client_ip,
        error_message=f"Rate limit exceeded: {exc.detail}",
    )
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Rate limit exceeded: maximum 10 requests per minute allowed on this endpoint. Please try again later.",
            "error": "rate_limit_exceeded",
        },
        headers={"Retry-After": "60"},
    )

# Configure CORS
origins = settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else [
    origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Health"])
def health_check():
    """
    Health check endpoint returning service status.
    """
    return {"status": "ok"}


@app.get("/", tags=["Root"])
def root():
    return {
        "service": settings.PROJECT_NAME,
        "status": "healthy",
        "health_endpoint": "/health",
        "documentation": "/docs",
        "openapi_url": "/openapi.json"
    }


# Include Authentication Router (/auth/signup, /auth/login, /auth/me)
app.include_router(auth_router)
app.include_router(auth_router, prefix="/api")

# Include Code Execution Router (/run, /run/languages, /api/run)
app.include_router(run_router)
app.include_router(run_router, prefix="/api")
app.include_router(problems_router)
app.include_router(problems_router, prefix="/api")
app.include_router(submissions_router)
app.include_router(submissions_router, prefix="/api")
app.include_router(contests_router)
app.include_router(contests_router, prefix="/api")
app.include_router(users_router)
app.include_router(users_router, prefix="/api")
app.include_router(admin_router)
app.include_router(admin_router, prefix="/api")
app.include_router(ws_router)



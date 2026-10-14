import time
import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.limiter import limiter
from app.core.logging import log_execution_event
from app.models.problem import Problem, Submission
from app.models.user import User
from app.schemas.problem import SubmissionCreate, SubmissionResponse
from app.services.judge0 import normalize_language, LANGUAGE_CONFIG
from app.services.review import review_submission
from app.services.submission_judge import judge_problem

router = APIRouter(tags=["Submissions"])

MAX_CODE_LENGTH = 20_000


@router.post(
    "/submissions",
    response_model=SubmissionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a solution for automated judging and AI review",
    description="Rate limited to 10 requests per minute per user."
)
@limiter.limit("10/minute")
async def create_submission(
    request: Request,
    payload: SubmissionCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    start_time = time.perf_counter()
    client_ip = request.client.host if request.client else "unknown"

    # 1. Code length validation (max 20,000 characters)
    if len(payload.code) > MAX_CODE_LENGTH:
        duration_ms = (time.perf_counter() - start_time) * 1000
        log_execution_event(
            event_type="problem_submission",
            endpoint="/submissions",
            language=payload.language,
            code_length=len(payload.code),
            outcome={"error": f"Code length exceeds {MAX_CODE_LENGTH} limit"},
            status_code=status.HTTP_400_BAD_REQUEST,
            user_id=user.id,
            username=user.username,
            client_ip=client_ip,
            duration_ms=duration_ms,
            problem_id=payload.problem_id,
            error_message="Code length validation failed",
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Code length exceeds maximum limit of {MAX_CODE_LENGTH} characters."
        )

    # 2. Problem existence & test cases check
    problem = db.query(Problem).filter(Problem.id == payload.problem_id).first()
    if problem is None:
        duration_ms = (time.perf_counter() - start_time) * 1000
        log_execution_event(
            event_type="problem_submission",
            endpoint="/submissions",
            language=payload.language,
            code_length=len(payload.code),
            outcome={"error": "Problem not found"},
            status_code=status.HTTP_404_NOT_FOUND,
            user_id=user.id,
            username=user.username,
            client_ip=client_ip,
            duration_ms=duration_ms,
            problem_id=payload.problem_id,
            error_message="Problem not found",
        )
        raise HTTPException(status_code=404, detail="Problem not found.")

    if not problem.is_ready or problem.hidden_test_cases_count < 3:
        duration_ms = (time.perf_counter() - start_time) * 1000
        log_execution_event(
            event_type="problem_submission",
            endpoint="/submissions",
            language=payload.language,
            code_length=len(payload.code),
            outcome={"error": "Problem is not yet open for submissions"},
            status_code=status.HTTP_400_BAD_REQUEST,
            user_id=user.id,
            username=user.username,
            client_ip=client_ip,
            duration_ms=duration_ms,
            problem_id=payload.problem_id,
            error_message="This problem is not yet open for submissions",
        )
        raise HTTPException(status_code=400, detail="This problem is not yet open for submissions")

    test_cases = list(problem.test_cases)

    # 3. Language whitelist validation
    canonical_language = normalize_language(payload.language)
    if canonical_language is None:
        duration_ms = (time.perf_counter() - start_time) * 1000
        supported = ", ".join(f"{cfg['name']} ('{k}')" for k, cfg in LANGUAGE_CONFIG.items())
        log_execution_event(
            event_type="problem_submission",
            endpoint="/submissions",
            language=payload.language,
            code_length=len(payload.code),
            outcome={"error": f"Unsupported language: {payload.language}"},
            status_code=status.HTTP_400_BAD_REQUEST,
            user_id=user.id,
            username=user.username,
            client_ip=client_ip,
            duration_ms=duration_ms,
            problem_id=payload.problem_id,
            error_message="Language whitelist validation failed",
        )
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported programming language '{payload.language}'. Supported: {supported}."
        )

    # 4. Record pending submission
    submission = Submission(
        user_id=user.id,
        problem_id=problem.id,
        code=payload.code,
        language=canonical_language,
        verdict="Running",
        score=0,
        sample_results=[],
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    try:
        verdict, score, sample_results = await judge_problem(problem, payload.code, canonical_language)
    except httpx.TimeoutException as exc:
        db.delete(submission)
        db.commit()
        duration_ms = (time.perf_counter() - start_time) * 1000
        log_execution_event(
            event_type="problem_submission",
            endpoint="/submissions",
            language=canonical_language,
            code_length=len(payload.code),
            outcome={"verdict": "Gateway Timeout", "error": "Execution service timed out"},
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            user_id=user.id,
            username=user.username,
            client_ip=client_ip,
            duration_ms=duration_ms,
            problem_id=problem.id,
            error_message="Execution service timed out",
        )
        raise HTTPException(status_code=504, detail="Execution service timed out.") from exc
    except Exception as exc:
        db.delete(submission)
        db.commit()
        duration_ms = (time.perf_counter() - start_time) * 1000
        log_execution_event(
            event_type="problem_submission",
            endpoint="/submissions",
            language=canonical_language,
            code_length=len(payload.code),
            outcome={"verdict": "Bad Gateway", "error": str(exc)},
            status_code=status.HTTP_502_BAD_GATEWAY,
            user_id=user.id,
            username=user.username,
            client_ip=client_ip,
            duration_ms=duration_ms,
            problem_id=problem.id,
            error_message=str(exc),
        )
        raise HTTPException(status_code=502, detail=f"Execution service error: {exc}") from exc

    submission.verdict = verdict
    submission.score = score
    submission.sample_results = sample_results
    db.commit()
    db.refresh(submission)

    # 5. Log successful judged submission
    duration_ms = (time.perf_counter() - start_time) * 1000
    passed_samples = sum(1 for s in sample_results if s.get("passed"))
    log_execution_event(
        event_type="problem_submission",
        endpoint="/submissions",
        language=canonical_language,
        code_length=len(payload.code),
        outcome={
            "submission_id": submission.id,
            "verdict": verdict,
            "score": score,
            "passed_test_cases": passed_samples,
            "total_sample_cases": len(sample_results),
        },
        status_code=status.HTTP_201_CREATED,
        user_id=user.id,
        username=user.username,
        client_ip=client_ip,
        duration_ms=duration_ms,
        problem_id=problem.id,
    )

    background_tasks.add_task(
        review_submission,
        submission.id,
        submission.code,
        submission.language,
        submission.verdict,
    )
    return submission


@router.get("/submissions/{submission_id}", response_model=SubmissionResponse)
def get_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    submission = db.query(Submission).filter(
        Submission.id == submission_id, Submission.user_id == user.id
    ).first()
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found.")
    return submission
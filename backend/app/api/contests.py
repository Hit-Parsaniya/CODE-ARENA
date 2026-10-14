import time
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_admin_user, get_current_user, get_optional_current_user
from app.core.database import get_db
from app.core.limiter import limiter
from app.core.logging import log_execution_event
from app.models.contest import (
    Contest,
    ContestInvite,
    ContestParticipant,
    ContestProblem,
    ContestSubmission,
)
from app.models.problem import Problem, Submission
from app.models.user import User
from app.schemas.contest import (
    ContestCreate,
    ContestDetail,
    ContestJoinResponse,
    ContestProblemResponse,
    ContestSummary,
    ContestUpdate,
    LeaderboardEntry,
)
from app.schemas.problem import SubmissionCreate, SubmissionResponse
from app.services.judge0 import normalize_language, LANGUAGE_CONFIG
from app.services.review import review_submission
from app.services.submission_judge import judge_problem
from app.services.ws_manager import manager as ws_manager

router = APIRouter(prefix="/contests", tags=["Contests"])


def _utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _check_contest_access(contest: Contest, user: User | None, db: Session) -> None:
    """
    Ensures that if a contest is private, only admins or users explicitly invited can access it.
    Raises 404 (Not Found) if uninvited so existence of private contests is never revealed.
    """
    if contest.visibility != "private":
        return

    # Admins always have access
    if user and (user.role == "admin" or user.is_admin):
        return

    # Check invite table for user's email
    if user:
        email_clean = user.email.strip().lower()
        invite = db.query(ContestInvite).filter(
            ContestInvite.contest_id == contest.id,
            ContestInvite.invited_email == email_clean,
        ).first()
        if invite is not None:
            return

    # Return 404 so uninvited users do not know the contest exists
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contest not found.")


def _get_contest(db: Session, contest_id: int, user: User | None = None) -> Contest:
    contest = db.query(Contest).filter(Contest.id == contest_id).first()
    if contest is None:
        raise HTTPException(status_code=404, detail="Contest not found.")
    _check_contest_access(contest, user, db)
    return contest


def _replace_problems(db: Session, contest: Contest, problem_inputs) -> None:
    problem_ids = [item.problem_id for item in problem_inputs]
    existing_ids = {row[0] for row in db.query(Problem.id).filter(Problem.id.in_(problem_ids)).all()}
    missing_ids = set(problem_ids) - existing_ids
    if missing_ids:
        raise HTTPException(status_code=400, detail=f"Unknown problem IDs: {sorted(missing_ids)}")
    db.query(ContestProblem).filter(ContestProblem.contest_id == contest.id).delete(synchronize_session=False)
    for item in problem_inputs:
        db.add(ContestProblem(contest_id=contest.id, problem_id=item.problem_id, points=item.points))


@router.get("", response_model=list[ContestSummary])
def list_contests(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
    """
    User-facing list:
    Returns contests where visibility = 'public' OR (visibility = 'private' AND user is invited or admin).
    """
    if current_user and (current_user.role == "admin" or current_user.is_admin):
        return db.query(Contest).order_by(Contest.start_time.desc()).all()

    # Public contests
    public_contests = db.query(Contest).filter(Contest.visibility == "public").all()

    # Private contests the user is invited to
    invited_contests = []
    if current_user:
        email_clean = current_user.email.strip().lower()
        invited_ids = [
            r[0]
            for r in db.query(ContestInvite.contest_id)
            .filter(ContestInvite.invited_email == email_clean)
            .all()
        ]
        if invited_ids:
            invited_contests = (
                db.query(Contest)
                .filter(Contest.id.in_(invited_ids), Contest.visibility == "private")
                .all()
            )

    all_visible = {c.id: c for c in (public_contests + invited_contests)}
    return sorted(all_visible.values(), key=lambda c: c.start_time, reverse=True)


@router.post("", response_model=ContestSummary, status_code=status.HTTP_201_CREATED)
def create_contest(
    payload: ContestCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    contest = Contest(
        title=payload.title,
        description=payload.description,
        start_time=payload.start_time,
        end_time=payload.end_time,
        visibility=payload.visibility,
        created_by=admin.id,
    )
    db.add(contest)
    db.flush()
    if payload.problems:
        _replace_problems(db, contest, payload.problems)
    db.commit()
    db.refresh(contest)
    return contest


@router.get("/{contest_id}", response_model=ContestDetail)
def get_contest(
    contest_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
    contest = _get_contest(db, contest_id, current_user)
    rows = db.query(ContestProblem, Problem).join(
        Problem, Problem.id == ContestProblem.problem_id
    ).filter(ContestProblem.contest_id == contest_id).order_by(ContestProblem.problem_id).all()
    return ContestDetail(
        **ContestSummary.model_validate(contest).model_dump(),
        problems=[
            ContestProblemResponse(
                problem_id=contest_problem.problem_id,
                title=problem.title,
                difficulty=problem.difficulty.value if hasattr(problem.difficulty, "value") else problem.difficulty,
                points=contest_problem.points,
                is_ready=problem.is_ready,
                hidden_test_cases_count=problem.hidden_test_cases_count,
                test_cases_count=problem.test_cases_count,
            )
            for contest_problem, problem in rows
        ],
    )


@router.put("/{contest_id}", response_model=ContestSummary)
def update_contest(
    contest_id: int,
    payload: ContestUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    contest = _get_contest(db, contest_id)
    for field in ("title", "description", "start_time", "end_time", "visibility"):
        setattr(contest, field, getattr(payload, field))
    if payload.problems:
        _replace_problems(db, contest, payload.problems)
    db.commit()
    db.refresh(contest)
    return contest


@router.delete("/{contest_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contest(
    contest_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    contest = db.query(Contest).filter(Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=404, detail="Contest not found.")
    db.delete(contest)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{contest_id}/join", response_model=ContestJoinResponse)
def join_contest(
    contest_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _get_contest(db, contest_id, user)
    participant = db.query(ContestParticipant).filter(
        ContestParticipant.contest_id == contest_id,
        ContestParticipant.user_id == user.id,
    ).first()
    if participant is None:
        db.add(ContestParticipant(contest_id=contest_id, user_id=user.id))
        db.commit()
    return ContestJoinResponse(contest_id=contest_id, joined=True)


@router.post("/{contest_id}/submit", response_model=SubmissionResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def submit_contest_solution(
    request: Request,
    contest_id: int,
    payload: SubmissionCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    start_time = time.perf_counter()
    client_ip = request.client.host if request.client else "unknown"

    contest = _get_contest(db, contest_id, user)
    now = datetime.now(timezone.utc)
    if not (_utc(contest.start_time) <= now <= _utc(contest.end_time)):
        duration_ms = (time.perf_counter() - start_time) * 1000
        log_execution_event(
            event_type="contest_submission",
            endpoint=f"/contests/{contest_id}/submit",
            language=payload.language,
            code_length=len(payload.code),
            outcome={"error": "Contest submissions not open"},
            status_code=400,
            user_id=user.id,
            username=user.username,
            client_ip=client_ip,
            duration_ms=duration_ms,
            contest_id=contest_id,
            problem_id=payload.problem_id,
            error_message="Contest window closed",
        )
        raise HTTPException(status_code=400, detail="Contest submissions are only accepted during the contest.")
    joined = db.query(ContestParticipant).filter(
        ContestParticipant.contest_id == contest_id,
        ContestParticipant.user_id == user.id,
    ).first()
    if joined is None:
        duration_ms = (time.perf_counter() - start_time) * 1000
        log_execution_event(
            event_type="contest_submission",
            endpoint=f"/contests/{contest_id}/submit",
            language=payload.language,
            code_length=len(payload.code),
            outcome={"error": "User not joined to contest"},
            status_code=403,
            user_id=user.id,
            username=user.username,
            client_ip=client_ip,
            duration_ms=duration_ms,
            contest_id=contest_id,
            problem_id=payload.problem_id,
            error_message="Must join contest first",
        )
        raise HTTPException(status_code=403, detail="Join the contest before submitting.")
    contest_problem = db.query(ContestProblem).filter(
        ContestProblem.contest_id == contest_id,
        ContestProblem.problem_id == payload.problem_id,
    ).first()
    if contest_problem is None:
        raise HTTPException(status_code=400, detail="This problem is not part of the contest.")
    problem = db.query(Problem).filter(Problem.id == payload.problem_id).first()
    canonical_language = normalize_language(payload.language)
    if problem is None:
        raise HTTPException(status_code=404, detail="Problem not found.")
    if not problem.is_ready or problem.hidden_test_cases_count < 3:
        raise HTTPException(status_code=400, detail="This problem is not yet open for submissions")
    if canonical_language is None:
        raise HTTPException(status_code=400, detail="Unsupported programming language.")

    submission = Submission(
        user_id=user.id, problem_id=problem.id, code=payload.code,
        language=canonical_language, verdict="Running", score=0, sample_results=[],
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
            event_type="contest_submission",
            endpoint=f"/contests/{contest_id}/submit",
            language=canonical_language,
            code_length=len(payload.code),
            outcome={"verdict": "Gateway Timeout", "error": "Execution service timed out"},
            status_code=504,
            user_id=user.id,
            username=user.username,
            client_ip=client_ip,
            duration_ms=duration_ms,
            contest_id=contest_id,
            problem_id=problem.id,
            error_message="Execution service timed out",
        )
        raise HTTPException(status_code=504, detail="Execution service timed out.") from exc
    except Exception as exc:
        db.delete(submission)
        db.commit()
        duration_ms = (time.perf_counter() - start_time) * 1000
        log_execution_event(
            event_type="contest_submission",
            endpoint=f"/contests/{contest_id}/submit",
            language=canonical_language,
            code_length=len(payload.code),
            outcome={"verdict": "Bad Gateway", "error": str(exc)},
            status_code=502,
            user_id=user.id,
            username=user.username,
            client_ip=client_ip,
            duration_ms=duration_ms,
            contest_id=contest_id,
            problem_id=problem.id,
            error_message=str(exc),
        )
        raise HTTPException(status_code=502, detail=f"Execution service error: {exc}") from exc

    submission.verdict = verdict
    submission.score = score
    submission.sample_results = sample_results
    wrong_attempts = db.query(ContestSubmission).join(
        Submission, Submission.id == ContestSubmission.submission_id
    ).filter(
        ContestSubmission.contest_id == contest_id,
        Submission.user_id == user.id,
        Submission.problem_id == problem.id,
        Submission.verdict != "Accepted",
    ).count()
    points_awarded = 0.0
    if verdict == "Accepted":
        previous_accept = db.query(ContestSubmission).join(
            Submission, Submission.id == ContestSubmission.submission_id
        ).filter(
            ContestSubmission.contest_id == contest_id,
            Submission.user_id == user.id,
            Submission.problem_id == problem.id,
            Submission.verdict == "Accepted",
        ).first()
        if previous_accept is None:
            points_awarded = max(0.0, contest_problem.points * (1 - 0.1 * wrong_attempts))
    db.add(ContestSubmission(
        contest_id=contest_id,
        submission_id=submission.id,
        points_awarded=points_awarded,
        wrong_attempts_before_accept=wrong_attempts,
    ))
    db.commit()
    db.refresh(submission)

    duration_ms = (time.perf_counter() - start_time) * 1000
    passed_samples = sum(1 for s in sample_results if s.get("passed"))
    log_execution_event(
        event_type="contest_submission",
        endpoint=f"/contests/{contest_id}/submit",
        language=canonical_language,
        code_length=len(payload.code),
        outcome={
            "submission_id": submission.id,
            "verdict": verdict,
            "score": score,
            "points_awarded": points_awarded,
            "passed_test_cases": passed_samples,
            "total_sample_cases": len(sample_results),
        },
        status_code=201,
        user_id=user.id,
        username=user.username,
        client_ip=client_ip,
        duration_ms=duration_ms,
        contest_id=contest_id,
        problem_id=problem.id,
    )
    db.commit()
    db.refresh(submission)
    background_tasks.add_task(review_submission, submission.id, submission.code, submission.language, submission.verdict)
    # Broadcast updated leaderboard to WebSocket clients when verdict is Accepted
    if verdict == "Accepted":
        background_tasks.add_task(_broadcast_leaderboard, contest_id)
    return submission


async def _broadcast_leaderboard(contest_id: int) -> None:
    """Background task: broadcast the updated leaderboard to all WS clients."""
    await ws_manager.broadcast_leaderboard(contest_id)


@router.get("/{contest_id}/leaderboard", response_model=list[LeaderboardEntry])
def contest_leaderboard(
    contest_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
    _get_contest(db, contest_id, current_user)
    rows = db.query(ContestSubmission, Submission).join(
        Submission, Submission.id == ContestSubmission.submission_id
    ).filter(ContestSubmission.contest_id == contest_id).order_by(ContestSubmission.submitted_at, ContestSubmission.id).all()
    totals: dict[int, float] = {}
    for contest_submission, submission in rows:
        totals[submission.user_id] = totals.get(submission.user_id, 0.0) + contest_submission.points_awarded
    reached: dict[int, datetime | None] = {}
    progress: dict[int, float] = {}
    for contest_submission, submission in rows:
        user_id = submission.user_id
        progress[user_id] = progress.get(user_id, 0.0) + contest_submission.points_awarded
        if user_id not in reached and progress[user_id] >= totals[user_id] and totals[user_id] > 0:
            reached[user_id] = contest_submission.submitted_at
    users = {user.id: user for user in db.query(User).filter(User.id.in_(totals)).all()}
    ranked = sorted(totals, key=lambda user_id: (-totals[user_id], reached.get(user_id) or datetime.max))
    return [
        LeaderboardEntry(
            rank=index,
            user_id=user_id,
            username=users[user_id].username,
            total_points=totals[user_id],
            reached_score_at=reached.get(user_id),
        )
        for index, user_id in enumerate(ranked, start=1)
    ]
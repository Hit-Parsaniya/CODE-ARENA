import re
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_admin_user
from app.core.database import get_db
from app.models.contest import (
    Contest,
    ContestInvite,
    ContestParticipant,
    ContestProblem,
    ContestSubmission,
)
from app.models.problem import Difficulty, Problem, Submission, TestCase
from app.models.user import User
from app.schemas.contest import (
    BulkInvitePayload,
    BulkInviteResponse,
    ContestCreate,
    ContestDetail,
    ContestInviteResponse,
    ContestProblemAttach,
    ContestProblemResponse,
    ContestSummary,
    ContestUpdate,
    InviteEmailPayload,
    LeaderboardEntry,
)
from app.schemas.problem import (
    ProblemCreate,
    ProblemDetail,
    ProblemSummary,
    ProblemUpdate,
    TestCaseAdmin,
    TestCaseCreate,
)
from app.schemas.user import UserResponse, UserRoleUpdate

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")

router = APIRouter(prefix="/admin", tags=["Admin"])


# =========================================================================
# 1. User Role Management
# =========================================================================

@router.get("/users", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Admin-only: List all registered users."""
    users = db.query(User).order_by(User.id.asc()).all()
    return users


@router.patch("/users/{user_id}/role", response_model=UserResponse)
def update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """
    Admin-only: Promote or demote a user ('admin' or 'user').
    Prevents an admin from demoting themselves to avoid lockout.
    """
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if target_user.id == admin.id and payload.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot demote your own admin account.",
        )

    target_user.role = payload.role
    target_user.is_admin = (payload.role == "admin")
    db.commit()
    db.refresh(target_user)
    return target_user


# =========================================================================
# 2. Contest Management
# =========================================================================

@router.post("/contests", response_model=ContestSummary, status_code=status.HTTP_201_CREATED)
def create_contest(
    payload: ContestCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Admin-only: Create a contest with public or private visibility."""
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
        for item in payload.problems:
            prob = db.query(Problem).filter(Problem.id == item.problem_id).first()
            if not prob:
                db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Problem with ID {item.problem_id} does not exist.",
                )
            db.add(ContestProblem(
                contest_id=contest.id,
                problem_id=item.problem_id,
                points=item.points,
            ))

    db.commit()
    db.refresh(contest)
    return contest


@router.delete("/contests/{contest_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contest(
    contest_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """
    Admin-only: Delete a contest and cascade-delete its ContestProblems,
    ContestInvites, ContestParticipants, and ContestSubmissions.
    """
    contest = db.query(Contest).filter(Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contest not found.")

    # Explicit cleanup
    db.query(ContestProblem).filter(ContestProblem.contest_id == contest_id).delete(synchronize_session=False)
    db.query(ContestInvite).filter(ContestInvite.contest_id == contest_id).delete(synchronize_session=False)
    db.query(ContestParticipant).filter(ContestParticipant.contest_id == contest_id).delete(synchronize_session=False)
    db.query(ContestSubmission).filter(ContestSubmission.contest_id == contest_id).delete(synchronize_session=False)
    db.delete(contest)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/contests/{contest_id}/invites", response_model=List[ContestInviteResponse])
def get_contest_invites(
    contest_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Admin-only: List all invited emails for a private contest."""
    contest = db.query(Contest).filter(Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contest not found.")
    invites = db.query(ContestInvite).filter(ContestInvite.contest_id == contest_id).order_by(ContestInvite.invited_at.desc()).all()
    return invites


@router.post("/contests/{contest_id}/invite", response_model=BulkInviteResponse, status_code=status.HTTP_200_OK)
def add_contest_invites(
    contest_id: int,
    payload: BulkInvitePayload,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """
    Admin-only: Bulk invite user emails to a private contest.
    - Validates email formatting
    - Skips already invited emails
    - Batch inserts valid new emails into ContestInvite
    - Returns { added: [], skipped_duplicates: [], invalid: [] }
    """
    contest = db.query(Contest).filter(Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contest not found.")

    existing_invites = db.query(ContestInvite.invited_email).filter(
        ContestInvite.contest_id == contest_id
    ).all()
    existing_set = {row[0].lower() for row in existing_invites}

    added = []
    skipped_duplicates = []
    invalid = []
    seen_in_batch = set()
    to_insert = []

    for raw_item in payload.emails:
        cleaned = raw_item.strip()
        if not cleaned:
            continue

        if not EMAIL_REGEX.match(cleaned):
            invalid.append(cleaned)
            continue

        norm = cleaned.lower()
        if norm in existing_set or norm in seen_in_batch:
            skipped_duplicates.append(cleaned)
        else:
            seen_in_batch.add(norm)
            to_insert.append(ContestInvite(contest_id=contest_id, invited_email=norm))
            added.append(cleaned)

    if to_insert:
        db.add_all(to_insert)
        db.commit()

    return BulkInviteResponse(
        added=added,
        skipped_duplicates=skipped_duplicates,
        invalid=invalid,
    )


@router.delete("/admin/contests/{contest_id}/invite", status_code=status.HTTP_200_OK)
@router.delete("/contests/{contest_id}/invite", status_code=status.HTTP_200_OK)
def remove_contest_invite(
    contest_id: int,
    payload: InviteEmailPayload,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Admin-only: Remove an invited email from a private contest."""
    contest = db.query(Contest).filter(Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contest not found.")

    email_clean = payload.email.strip().lower()
    deleted_count = db.query(ContestInvite).filter(
        ContestInvite.contest_id == contest_id,
        ContestInvite.invited_email == email_clean,
    ).delete(synchronize_session=False)
    db.commit()

    if deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found for this email.")

    return {"detail": f"Invite for {email_clean} removed successfully.", "removed": True}


@router.get("/contests/{contest_id}/ranking", response_model=List[LeaderboardEntry])
def get_authoritative_contest_ranking(
    contest_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """
    Admin-only: Returns the full authoritative leaderboard for a contest,
    including all participants and detailed point tallies.
    """
    contest = db.query(Contest).filter(Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contest not found.")

    participants = (
        db.query(ContestParticipant, User)
        .join(User, User.id == ContestParticipant.user_id)
        .filter(ContestParticipant.contest_id == contest_id)
        .all()
    )

    subs = (
        db.query(ContestSubmission, Submission)
        .join(Submission, Submission.id == ContestSubmission.submission_id)
        .filter(ContestSubmission.contest_id == contest_id)
        .order_by(ContestSubmission.submitted_at, ContestSubmission.id)
        .all()
    )

    totals: dict[int, float] = {p.user_id: 0.0 for p, _ in participants}
    usernames: dict[int, str] = {p.user_id: u.username for p, u in participants}

    # Add users who submitted even if not explicitly recorded in participants table
    for c_sub, sub in subs:
        if sub.user_id not in totals:
            totals[sub.user_id] = 0.0
            u = db.query(User).filter(User.id == sub.user_id).first()
            usernames[sub.user_id] = u.username if u else f"User#{sub.user_id}"
        totals[sub.user_id] += c_sub.points_awarded

    reached: dict[int, Optional[datetime]] = {}
    progress: dict[int, float] = {}
    for c_sub, sub in subs:
        uid = sub.user_id
        progress[uid] = progress.get(uid, 0.0) + c_sub.points_awarded
        if uid not in reached and progress[uid] >= totals[uid] and totals[uid] > 0:
            reached[uid] = c_sub.submitted_at

    ranked = sorted(
        totals.keys(),
        key=lambda uid: (-totals[uid], reached.get(uid) or datetime.max, uid),
    )

    return [
        LeaderboardEntry(
            rank=idx + 1,
            user_id=uid,
            username=usernames[uid],
            total_points=totals[uid],
            reached_score_at=reached.get(uid),
        )
        for idx, uid in enumerate(ranked)
    ]


@router.get("/contests/{contest_id}/problems", response_model=List[ContestProblemResponse])
def list_contest_problems(
    contest_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """
    Admin-only: List all problems attached to a contest, including readiness status and testcase counts.
    """
    contest = db.query(Contest).filter(Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contest not found.")

    rows = (
        db.query(ContestProblem, Problem)
        .join(Problem, Problem.id == ContestProblem.problem_id)
        .filter(ContestProblem.contest_id == contest_id)
        .order_by(ContestProblem.problem_id.asc())
        .all()
    )

    return [
        ContestProblemResponse(
            problem_id=cp.problem_id,
            title=p.title,
            difficulty=p.difficulty.value if hasattr(p.difficulty, "value") else str(p.difficulty),
            points=cp.points,
            is_ready=p.is_ready,
            hidden_test_cases_count=p.hidden_test_cases_count,
            test_cases_count=p.test_cases_count,
        )
        for cp, p in rows
    ]


@router.post(
    "/contests/{contest_id}/problems",
    response_model=ContestProblemResponse,
    status_code=status.HTTP_201_CREATED,
)
def attach_problem_to_contest(
    contest_id: int,
    payload: ContestProblemAttach,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """
    Admin-only: Attach an existing Problem to a Contest via ContestProblem.
    Rejects with 404 if the problem or contest does not exist.
    """
    contest = db.query(Contest).filter(Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contest not found.")

    problem = db.query(Problem).filter(Problem.id == payload.problem_id).first()
    if not problem:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Problem with ID {payload.problem_id} does not exist.",
        )

    contest_problem = db.query(ContestProblem).filter(
        ContestProblem.contest_id == contest_id,
        ContestProblem.problem_id == payload.problem_id,
    ).first()

    if contest_problem:
        contest_problem.points = payload.points
    else:
        contest_problem = ContestProblem(
            contest_id=contest_id,
            problem_id=payload.problem_id,
            points=payload.points,
        )
        db.add(contest_problem)

    db.commit()
    db.refresh(contest_problem)

    return ContestProblemResponse(
        problem_id=problem.id,
        title=problem.title,
        difficulty=problem.difficulty.value if hasattr(problem.difficulty, "value") else str(problem.difficulty),
        points=contest_problem.points,
        is_ready=problem.is_ready,
        hidden_test_cases_count=problem.hidden_test_cases_count,
        test_cases_count=problem.test_cases_count,
    )


@router.delete(
    "/contests/{contest_id}/problems/{problem_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_problem_from_contest(
    contest_id: int,
    problem_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """
    Admin-only: Removes a problem from a contest (does not delete the Problem entity itself).
    """
    contest = db.query(Contest).filter(Contest.id == contest_id).first()
    if not contest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contest not found.")

    contest_problem = db.query(ContestProblem).filter(
        ContestProblem.contest_id == contest_id,
        ContestProblem.problem_id == problem_id,
    ).first()
    if not contest_problem:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Problem is not attached to this contest.",
        )

    db.delete(contest_problem)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# =========================================================================
# 3. Problem & Testcase Management
# =========================================================================

@router.post("/problems", response_model=ProblemSummary, status_code=status.HTTP_201_CREATED)
def create_problem(
    payload: ProblemCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Admin-only: Create a problem with full definition."""
    problem = Problem(
        title=payload.title,
        description=payload.description,
        difficulty=Difficulty(payload.difficulty),
        tags=payload.tags,
        time_limit_ms=payload.time_limit_ms,
        memory_limit_kb=payload.memory_limit_kb,
        created_by=admin.id,
    )
    db.add(problem)
    db.commit()
    db.refresh(problem)
    return problem


@router.put("/problems/{problem_id}", response_model=ProblemSummary)
def update_problem(
    problem_id: int,
    payload: ProblemUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Admin-only: Update a problem definition."""
    problem = db.query(Problem).filter(Problem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found.")

    problem.title = payload.title
    problem.description = payload.description
    problem.difficulty = Difficulty(payload.difficulty)
    problem.tags = payload.tags
    problem.time_limit_ms = payload.time_limit_ms
    problem.memory_limit_kb = payload.memory_limit_kb
    db.commit()
    db.refresh(problem)
    return problem


@router.delete("/problems/{problem_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_problem(
    problem_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Admin-only: Delete a problem and its testcases."""
    problem = db.query(Problem).filter(Problem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found.")
    db.delete(problem)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/problems/{problem_id}/testcases", response_model=List[TestCaseAdmin])
def list_problem_testcases(
    problem_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Admin-only: List all testcases for a problem, including hidden testcases."""
    problem = db.query(Problem).filter(Problem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found.")
    return list(problem.test_cases)


@router.post("/problems/{problem_id}/testcases", response_model=TestCaseAdmin, status_code=status.HTTP_201_CREATED)
def add_problem_testcase(
    problem_id: int,
    payload: TestCaseCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """
    Admin-only: Add a testcase (sample or hidden) to a problem.
    Hidden testcases (is_sample=False) are never revealed on public endpoints.
    """
    problem = db.query(Problem).filter(Problem.id == problem_id).first()
    if not problem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found.")

    test_case = TestCase(
        problem_id=problem_id,
        input=payload.input,
        expected_output=payload.expected_output,
        is_sample=payload.is_sample,
    )
    db.add(test_case)
    db.commit()
    db.refresh(test_case)
    return test_case


@router.delete("/problems/{problem_id}/testcases/{testcase_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_problem_testcase(
    problem_id: int,
    testcase_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Admin-only: Delete a testcase."""
    tc = db.query(TestCase).filter(
        TestCase.id == testcase_id,
        TestCase.problem_id == problem_id
    ).first()
    if not tc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Testcase not found.")
    db.delete(tc)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

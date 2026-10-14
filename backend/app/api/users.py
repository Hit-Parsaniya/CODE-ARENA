import math
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.contest import Contest, ContestParticipant, ContestSubmission
from app.models.problem import Problem, Submission
from app.models.user import User
from app.schemas.user import (
    AIReviewTrendItem,
    BestScorePerProblem,
    ContestHistoryItem,
    PaginatedSubmissions,
    SubmissionHistoryItem,
    UserProfileResponse,
    UserStats,
)

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/{user_id}/profile", response_model=UserProfileResponse)
def get_user_profile(
    user_id: int,
    page: int = Query(default=1, ge=1, description="Page number for submission history"),
    per_page: int = Query(default=10, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
):
    """
    Fetch comprehensive profile data for a user, including:
    - Profile & Stats summary (problems solved, total submissions, average AI score, contests entered)
    - Best score per problem attempted
    - AI review score trend over time
    - Contest participation history with final rankings
    - Paginated submission history with full code & review details
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    # 1. Fetch all submissions by this user with Problem info for aggregations
    all_subs = (
        db.query(Submission, Problem)
        .join(Problem, Problem.id == Submission.problem_id)
        .filter(Submission.user_id == user_id)
        .order_by(Submission.submitted_at.asc())
        .all()
    )

    total_submissions = len(all_subs)

    # 2. Compute problems solved and best scores per problem
    problem_map: dict[int, list[tuple[Submission, Problem]]] = {}
    ai_trend_items: list[AIReviewTrendItem] = []
    ai_scores: list[float] = []

    for sub, prob in all_subs:
        if prob.id not in problem_map:
            problem_map[prob.id] = []
        problem_map[prob.id].append((sub, prob))

        # AI review trend item
        if sub.ai_review and isinstance(sub.ai_review, dict):
            overall = sub.ai_review.get("overall_score")
            if overall is not None:
                try:
                    overall_val = float(overall)
                    ai_scores.append(overall_val)
                    ai_trend_items.append(
                        AIReviewTrendItem(
                            submission_id=sub.id,
                            date=sub.submitted_at,
                            overall_score=overall_val,
                            correctness=sub.ai_review.get("correctness"),
                            readability=sub.ai_review.get("readability"),
                            efficiency=sub.ai_review.get("efficiency"),
                            best_practices=sub.ai_review.get("best_practices"),
                            problem_title=prob.title,
                        )
                    )
                except (ValueError, TypeError):
                    pass

    # Best scores per problem
    best_scores: list[BestScorePerProblem] = []
    problems_solved_count = 0

    for prob_id, prob_subs in problem_map.items():
        _, sample_prob = prob_subs[0]
        is_solved = any(s.verdict == "Accepted" for s, _ in prob_subs)
        if is_solved:
            problems_solved_count += 1

        best_score = max(s.score for s, _ in prob_subs)
        # Prefer "Accepted" verdict if solved, otherwise verdict of highest score, or latest
        if is_solved:
            best_verdict = "Accepted"
        else:
            best_sub = max(prob_subs, key=lambda pair: pair[0].score)[0]
            best_verdict = best_sub.verdict

        difficulty_val = (
            sample_prob.difficulty.value
            if hasattr(sample_prob.difficulty, "value")
            else str(sample_prob.difficulty)
        )

        best_scores.append(
            BestScorePerProblem(
                problem_id=prob_id,
                problem_title=sample_prob.title,
                difficulty=difficulty_val,
                best_score=best_score,
                best_verdict=best_verdict,
                attempts_count=len(prob_subs),
                is_solved=is_solved,
                last_attempted_at=prob_subs[-1][0].submitted_at,
            )
        )

    # Sort best scores by problem_id or last_attempted_at desc
    best_scores.sort(key=lambda x: x.last_attempted_at, reverse=True)

    avg_ai_score = round(sum(ai_scores) / len(ai_scores), 2) if ai_scores else 0.0

    # 3. Contest Participation & Final Rankings
    participant_contest_ids = [
        r[0]
        for r in db.query(ContestParticipant.contest_id)
        .filter(ContestParticipant.user_id == user_id)
        .all()
    ]
    sub_contest_ids = [
        r[0]
        for r in db.query(ContestSubmission.contest_id)
        .join(Submission, Submission.id == ContestSubmission.submission_id)
        .filter(Submission.user_id == user_id)
        .all()
    ]
    all_contest_ids = sorted(list(set(participant_contest_ids + sub_contest_ids)), reverse=True)

    contest_history: list[ContestHistoryItem] = []
    for cid in all_contest_ids:
        contest = db.query(Contest).filter(Contest.id == cid).first()
        if not contest:
            continue

        participant = (
            db.query(ContestParticipant)
            .filter(ContestParticipant.contest_id == cid, ContestParticipant.user_id == user_id)
            .first()
        )

        c_subs = (
            db.query(ContestSubmission, Submission)
            .join(Submission, Submission.id == ContestSubmission.submission_id)
            .filter(ContestSubmission.contest_id == cid)
            .order_by(ContestSubmission.submitted_at, ContestSubmission.id)
            .all()
        )

        joined_users = {
            r[0]
            for r in db.query(ContestParticipant.user_id)
            .filter(ContestParticipant.contest_id == cid)
            .all()
        }
        sub_users = {sub.user_id for _, sub in c_subs}
        all_users_in_contest = joined_users.union(sub_users)
        if user_id not in all_users_in_contest:
            all_users_in_contest.add(user_id)

        totals: dict[int, float] = {uid: 0.0 for uid in all_users_in_contest}
        for c_sub, sub in c_subs:
            totals[sub.user_id] = totals.get(sub.user_id, 0.0) + c_sub.points_awarded

        reached: dict[int, Optional[datetime]] = {}
        progress: dict[int, float] = {}
        for c_sub, sub in c_subs:
            uid = sub.user_id
            progress[uid] = progress.get(uid, 0.0) + c_sub.points_awarded
            if uid not in reached and progress[uid] >= totals[uid] and totals[uid] > 0:
                reached[uid] = c_sub.submitted_at

        ranked_user_ids = sorted(
            totals.keys(),
            key=lambda uid: (-totals[uid], reached.get(uid) or datetime.max, uid),
        )

        user_rank = (ranked_user_ids.index(user_id) + 1) if user_id in ranked_user_ids else len(ranked_user_ids)
        user_points = totals.get(user_id, 0.0)

        contest_history.append(
            ContestHistoryItem(
                contest_id=contest.id,
                contest_title=contest.title,
                start_time=contest.start_time,
                end_time=contest.end_time,
                rank=user_rank,
                total_points=user_points,
                total_participants=len(all_users_in_contest),
                joined_at=participant.joined_at if participant else None,
            )
        )

    contest_history.sort(key=lambda x: x.start_time, reverse=True)

    # 4. Paginated Submissions (ordered newest first)
    total_pages = math.ceil(total_submissions / per_page) if total_submissions > 0 else 1
    offset = (page - 1) * per_page
    paginated_sub_rows = (
        db.query(Submission, Problem.title)
        .join(Problem, Problem.id == Submission.problem_id)
        .filter(Submission.user_id == user_id)
        .order_by(Submission.submitted_at.desc())
        .offset(offset)
        .limit(per_page)
        .all()
    )

    submission_items = [
        SubmissionHistoryItem(
            id=sub.id,
            problem_id=sub.problem_id,
            problem_title=prob_title,
            code=sub.code,
            language=sub.language,
            verdict=sub.verdict,
            score=sub.score,
            submitted_at=sub.submitted_at,
            ai_review=sub.ai_review if isinstance(sub.ai_review, dict) else None,
        )
        for sub, prob_title in paginated_sub_rows
    ]

    stats = UserStats(
        problems_solved=problems_solved_count,
        total_submissions=total_submissions,
        average_ai_score=avg_ai_score,
        contests_entered=len(all_contest_ids),
    )

    paginated_submissions = PaginatedSubmissions(
        items=submission_items,
        total=total_submissions,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )

    return UserProfileResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        created_at=user.created_at,
        is_admin=bool(user.is_admin),
        stats=stats,
        best_scores=best_scores,
        ai_review_trend=ai_trend_items,
        contest_history=contest_history,
        submission_history=paginated_submissions,
    )

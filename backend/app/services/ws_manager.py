"""
WebSocket connection manager for real-time contest leaderboard updates.

Maintains a mapping of contest_id -> set of active WebSocket connections.
When a leaderboard changes (e.g. Accepted verdict), `broadcast_leaderboard`
recomputes the full ranking from the DB and pushes it to every connected client.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime
from typing import Any

from fastapi import WebSocket
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.contest import ContestSubmission
from app.models.problem import Submission
from app.models.user import User

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections grouped by contest_id."""

    def __init__(self) -> None:
        # contest_id -> set of WebSocket connections
        self._rooms: dict[int, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, contest_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            if contest_id not in self._rooms:
                self._rooms[contest_id] = set()
            self._rooms[contest_id].add(websocket)
        logger.info("WS client connected to contest %d (%d total)", contest_id, len(self._rooms[contest_id]))

    async def disconnect(self, contest_id: int, websocket: WebSocket) -> None:
        async with self._lock:
            room = self._rooms.get(contest_id)
            if room:
                room.discard(websocket)
                if not room:
                    del self._rooms[contest_id]
        logger.info("WS client disconnected from contest %d", contest_id)

    async def broadcast_leaderboard(self, contest_id: int) -> None:
        """Recompute the leaderboard from the DB and send it to all connected clients."""
        async with self._lock:
            room = self._rooms.get(contest_id)
            if not room:
                return
            # snapshot the connections so we can release the lock before doing I/O
            connections = list(room)

        leaderboard = _compute_leaderboard(contest_id)
        payload = json.dumps({"type": "leaderboard_update", "data": leaderboard})

        stale: list[WebSocket] = []
        for ws in connections:
            try:
                await ws.send_text(payload)
            except Exception:
                stale.append(ws)

        # Clean up broken connections
        if stale:
            async with self._lock:
                room = self._rooms.get(contest_id)
                if room:
                    for ws in stale:
                        room.discard(ws)
                    if not room:
                        del self._rooms[contest_id]


def _compute_leaderboard(contest_id: int) -> list[dict[str, Any]]:
    """Compute the ranked leaderboard for a contest (runs synchronously in a fresh DB session)."""
    db: Session = SessionLocal()
    try:
        rows = (
            db.query(ContestSubmission, Submission)
            .join(Submission, Submission.id == ContestSubmission.submission_id)
            .filter(ContestSubmission.contest_id == contest_id)
            .order_by(ContestSubmission.submitted_at, ContestSubmission.id)
            .all()
        )

        totals: dict[int, float] = {}
        for contest_submission, submission in rows:
            totals[submission.user_id] = totals.get(submission.user_id, 0.0) + contest_submission.points_awarded

        reached: dict[int, datetime | None] = {}
        progress: dict[int, float] = {}
        for contest_submission, submission in rows:
            uid = submission.user_id
            progress[uid] = progress.get(uid, 0.0) + contest_submission.points_awarded
            if uid not in reached and progress[uid] >= totals[uid] and totals[uid] > 0:
                reached[uid] = contest_submission.submitted_at

        users = {u.id: u for u in db.query(User).filter(User.id.in_(totals)).all()}
        ranked = sorted(totals, key=lambda uid: (-totals[uid], reached.get(uid) or datetime.max))

        return [
            {
                "rank": idx,
                "user_id": uid,
                "username": users[uid].username,
                "total_points": totals[uid],
                "last_accepted_at": (
                    reached[uid].isoformat() if reached.get(uid) else None
                ),
            }
            for idx, uid in enumerate(ranked, start=1)
        ]
    finally:
        db.close()


# Singleton instance used across the app
manager = ConnectionManager()

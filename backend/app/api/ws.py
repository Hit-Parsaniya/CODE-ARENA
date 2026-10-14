"""
WebSocket endpoint for real-time contest leaderboard updates.

Clients connect to /ws/contests/{contest_id}/leaderboard and receive
JSON messages of the form:
    {"type": "leaderboard_update", "data": [...]}

On initial connection the current leaderboard is pushed immediately.
"""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.ws_manager import _compute_leaderboard, manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/contests/{contest_id}/leaderboard")
async def leaderboard_ws(websocket: WebSocket, contest_id: int) -> None:
    await manager.connect(contest_id, websocket)
    try:
        # Push the current leaderboard immediately on connect
        leaderboard = _compute_leaderboard(contest_id)
        await websocket.send_text(json.dumps({"type": "leaderboard_update", "data": leaderboard}))

        # Keep the connection alive – listen for pings / client messages
        while True:
            data = await websocket.receive_text()
            # Clients can send "ping" to keep the connection alive
            if data.strip().lower() == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.debug("WS error for contest %d: %s", contest_id, exc)
    finally:
        await manager.disconnect(contest_id, websocket)

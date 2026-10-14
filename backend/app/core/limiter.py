from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.core.security import decode_access_token


def get_user_or_ip_identifier(request: Request) -> str:
    """
    Rate limit key generator:
    1. If user is authenticated via Bearer JWT, uses 'user:<user_id>' to enforce per-user limits.
    2. Otherwise falls back to 'ip:<client_ip>' to enforce per-IP limits for unauthenticated traffic.
    """
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        payload = decode_access_token(token)
        if payload and payload.get("sub"):
            return f"user:{payload.get('sub')}"

    # Also check if request.state has user info attached
    if hasattr(request.state, "user_id") and request.state.user_id:
        return f"user:{request.state.user_id}"

    # Fallback to remote IP address
    client_ip = get_remote_address(request) or "127.0.0.1"
    return f"ip:{client_ip}"


# Initialize SlowAPI Limiter with user/IP identification
limiter = Limiter(
    key_func=get_user_or_ip_identifier,
    default_limits=[],
    headers_enabled=False,
    strategy="fixed-window"
)

import time
from fastapi import APIRouter, HTTPException, Request, status
import httpx
from app.core.limiter import limiter
from app.core.logging import log_execution_event
from app.core.security import decode_access_token
from app.schemas.run import RunRequest, RunResponse, MAX_CODE_LENGTH, MAX_STDIN_LENGTH
from app.services.judge0 import (
    LANGUAGE_CONFIG,
    normalize_language,
    execute_code_judge0
)

router = APIRouter(tags=["Code Execution"])


def _extract_user_id_from_request(request: Request) -> int | None:
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        payload = decode_access_token(token)
        if payload and payload.get("sub"):
            try:
                return int(payload.get("sub"))
            except (ValueError, TypeError):
                return None
    return None


@router.post(
    "/run",
    response_model=RunResponse,
    status_code=status.HTTP_200_OK,
    summary="Execute user code in Judge0 sandbox",
    description="Compiles and runs code for Python 3, C (GCC), C++ (GCC), and Java (OpenJDK). Rate limited to 10 requests per minute per user/IP."
)
@limiter.limit("10/minute")
async def run_code(request: Request, payload: RunRequest) -> RunResponse:
    start_time = time.perf_counter()
    user_id = _extract_user_id_from_request(request)
    client_ip = request.client.host if request.client else "unknown"
    stdin_val = payload.stdin or ""

    # 1. Code length validation (max 20,000 characters)
    if len(payload.code) > MAX_CODE_LENGTH:
        duration_ms = (time.perf_counter() - start_time) * 1000
        log_execution_event(
            event_type="code_run",
            endpoint="/run",
            language=payload.language,
            code_length=len(payload.code),
            stdin_length=len(stdin_val),
            outcome={"error": f"Code length exceeds {MAX_CODE_LENGTH} limit"},
            status_code=status.HTTP_400_BAD_REQUEST,
            user_id=user_id,
            client_ip=client_ip,
            duration_ms=duration_ms,
            error_message="Code length validation failed",
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Code length exceeds maximum limit of {MAX_CODE_LENGTH} characters (received {len(payload.code)})."
        )

    # 2. Reject unsupported languages with 400 error
    canonical_lang = normalize_language(payload.language)
    if not canonical_lang:
        duration_ms = (time.perf_counter() - start_time) * 1000
        supported = ", ".join(f"{cfg['name']} ('{k}')" for k, cfg in LANGUAGE_CONFIG.items())
        log_execution_event(
            event_type="code_run",
            endpoint="/run",
            language=payload.language,
            code_length=len(payload.code),
            stdin_length=len(stdin_val),
            outcome={"error": f"Unsupported language: {payload.language}"},
            status_code=status.HTTP_400_BAD_REQUEST,
            user_id=user_id,
            client_ip=client_ip,
            duration_ms=duration_ms,
            error_message="Language whitelist validation failed",
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported language '{payload.language}'. Supported languages are: {supported}."
        )

    # 3. Sandboxed execution via Judge0
    try:
        result = await execute_code_judge0(
            canonical_lang=canonical_lang,
            code=payload.code,
            stdin=stdin_val
        )
        duration_ms = (time.perf_counter() - start_time) * 1000
        log_execution_event(
            event_type="code_run",
            endpoint="/run",
            language=canonical_lang,
            code_length=len(payload.code),
            stdin_length=len(stdin_val),
            outcome={
                "stage": result.get("stage"),
                "status": result.get("status"),
                "status_id": result.get("status_id"),
                "execution_time": result.get("execution_time"),
                "memory": result.get("memory"),
                "error": result.get("error"),
            },
            status_code=status.HTTP_200_OK,
            user_id=user_id,
            client_ip=client_ip,
            duration_ms=duration_ms,
        )
        return RunResponse(**result)
    except httpx.TimeoutException:
        duration_ms = (time.perf_counter() - start_time) * 1000
        log_execution_event(
            event_type="code_run",
            endpoint="/run",
            language=canonical_lang,
            code_length=len(payload.code),
            stdin_length=len(stdin_val),
            outcome={"stage": "runtime", "status": "Gateway Timeout", "error": "Sandbox execution timeout"},
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            user_id=user_id,
            client_ip=client_ip,
            duration_ms=duration_ms,
            error_message="Judge0 execution timeout",
        )
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Execution timed out in Judge0 sandbox environment."
        )
    except Exception as exc:
        duration_ms = (time.perf_counter() - start_time) * 1000
        log_execution_event(
            event_type="code_run",
            endpoint="/run",
            language=canonical_lang,
            code_length=len(payload.code),
            stdin_length=len(stdin_val),
            outcome={"stage": "runtime", "status": "Bad Gateway", "error": str(exc)},
            status_code=status.HTTP_502_BAD_GATEWAY,
            user_id=user_id,
            client_ip=client_ip,
            duration_ms=duration_ms,
            error_message=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Execution service error: {str(exc)}"
        )


@router.get(
    "/run/languages",
    summary="List supported execution languages",
    description="Returns current Judge0 language ID mappings for supported programming languages."
)
async def get_supported_languages():
    return {
        "languages": [
            {
                "key": key,
                "name": cfg["name"],
                "judge0_name": cfg["judge0_name"],
                "judge0_id": cfg["id"],
                "monaco_lang": cfg["monaco"]
            }
            for key, cfg in LANGUAGE_CONFIG.items()
        ],
        "max_code_length": MAX_CODE_LENGTH
    }

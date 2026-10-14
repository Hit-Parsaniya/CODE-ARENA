import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any, Dict, Optional


class JSONFormatter(logging.Formatter):
    """
    Formats log records as single-line JSON objects for log aggregators (ELK, Datadog, CloudWatch).
    """
    def format(self, record: logging.LogRecord) -> str:
        if isinstance(record.msg, dict):
            log_data = record.msg
        else:
            log_data = {
                "message": record.getMessage(),
                "logger": record.name,
                "level": record.levelname,
            }

        if "timestamp" not in log_data:
            log_data["timestamp"] = datetime.now(timezone.utc).isoformat()
        if "level" not in log_data:
            log_data["level"] = record.levelname

        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_data, default=str)


def setup_audit_logger() -> logging.Logger:
    """Configures the structured audit logger."""
    audit_log = logging.getLogger("codearena.audit")
    audit_log.setLevel(logging.INFO)
    
    # Avoid duplicate handlers if already configured
    if not audit_log.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(JSONFormatter())
        audit_log.addHandler(handler)
        audit_log.propagate = False
        
    return audit_log


audit_logger = setup_audit_logger()


def log_execution_event(
    event_type: str,
    endpoint: str,
    language: str,
    code_length: int,
    outcome: Dict[str, Any],
    status_code: int = 200,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    client_ip: Optional[str] = None,
    stdin_length: int = 0,
    duration_ms: Optional[float] = None,
    problem_id: Optional[int] = None,
    contest_id: Optional[int] = None,
    error_message: Optional[str] = None,
) -> None:
    """
    Emits a structured JSON audit log entry for code execution and submission requests.
    Enables security analysis, abuse monitoring, and execution observability.
    """
    # Determine potential abuse flag
    is_abuse_signal = False
    if status_code in (429, 504, 502):
        is_abuse_signal = True
    elif isinstance(outcome, dict):
        status_id = outcome.get("status_id")
        # Time Limit Exceeded (5), Runtime error / segfault (7, 8, 9, 10, 11, 12, 13)
        if status_id in (5, 7, 8, 9, 10, 11, 12, 13):
            is_abuse_signal = True
        elif outcome.get("verdict") in ("Time Limit Exceeded", "Runtime Error"):
            is_abuse_signal = True

    log_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event": event_type,
        "endpoint": endpoint,
        "user_id": user_id,
        "username": username,
        "client_ip": client_ip or "unknown",
        "language": language,
        "code_length": code_length,
        "stdin_length": stdin_length,
        "problem_id": problem_id,
        "contest_id": contest_id,
        "status_code": status_code,
        "duration_ms": round(duration_ms, 2) if duration_ms is not None else None,
        "outcome": outcome,
        "abuse_flag": is_abuse_signal,
        "error": error_message,
    }

    # Clean out None values for compact representation
    filtered_entry = {k: v for k, v in log_entry.items() if v is not None}
    
    if is_abuse_signal or status_code >= 400:
        audit_logger.warning(filtered_entry)
    else:
        audit_logger.info(filtered_entry)

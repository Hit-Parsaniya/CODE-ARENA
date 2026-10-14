import base64
import httpx
from typing import Dict, Any, Optional, Tuple
from app.core.config import settings

# Current Judge0 CE language IDs from GET https://ce.judge0.com/languages
# (looked up 2026-09-26; latest compiler in each requested family)
# 113: Python (3.14.0)
# 103: C (GCC 14.1.0)
# 105: C++ (GCC 14.1.0)
# 91:  Java (JDK 17.0.6) — current OpenJDK offering

LANGUAGE_CONFIG: Dict[str, Dict[str, Any]] = {
    "python": {
        "id": 113,
        "name": "Python 3",
        "judge0_name": "Python (3.14.0)",
        "monaco": "python",
    },
    "c": {
        "id": 103,
        "name": "C (GCC)",
        "judge0_name": "C (GCC 14.1.0)",
        "monaco": "c",
    },
    "cpp": {
        "id": 105,
        "name": "C++ (GCC)",
        "judge0_name": "C++ (GCC 14.1.0)",
        "monaco": "cpp",
    },
    "java": {
        "id": 91,
        "name": "Java (OpenJDK)",
        "judge0_name": "Java (JDK 17.0.6)",
        "monaco": "java",
    },
}

# Alias mapping to canonical key
LANGUAGE_ALIASES: Dict[str, str] = {
    "python": "python",
    "python3": "python",
    "py": "python",
    "python 3": "python",
    "c": "c",
    "c (gcc)": "c",
    "gcc": "c",
    "c99": "c",
    "c11": "c",
    "cpp": "cpp",
    "c++": "cpp",
    "c++ (gcc)": "cpp",
    "g++": "cpp",
    "java": "java",
    "java (openjdk)": "java",
    "openjdk": "java",
    "jdk": "java",
}


def normalize_language(lang_input: str) -> Optional[str]:
    """
    Normalizes a user-provided language string to a supported canonical language key.
    Returns None if unsupported.
    """
    cleaned = lang_input.strip().lower()
    return LANGUAGE_ALIASES.get(cleaned)


def get_language_id(canonical_lang: str) -> int:
    return LANGUAGE_CONFIG[canonical_lang]["id"]


def decode_b64(val: Optional[str]) -> Optional[str]:
    """Decodes a base64 encoded string from Judge0, or returns original if not encoded."""
    if not val:
        return None
    try:
        decoded = base64.b64decode(val.encode("ascii")).decode("utf-8", errors="replace")
        return decoded
    except Exception:
        return val


def encode_b64(val: str) -> str:
    """Encodes a string to base64 for safe transmission to Judge0."""
    return base64.b64encode(val.encode("utf-8")).decode("ascii")


def classify_stage(status_id: int, compile_output: Optional[str], stderr: Optional[str]) -> Tuple[str, Optional[str]]:
    """
    Classifies the execution into ('compile' | 'runtime' | 'success')
    and extracts the most relevant error message.

    Judge0 Status Codes:
    1: In Queue
    2: Processing
    3: Accepted
    4: Wrong Answer
    5: Time Limit Exceeded
    6: Compilation Error
    7: Runtime Error (SIGSEGV)
    8: Runtime Error (SIGXFSZ)
    9: Runtime Error (SIGFPE)
    10: Runtime Error (SIGABRT)
    11: Runtime Error (NZEC)
    12: Runtime Error (Other)
    13: Internal Error
    14: Exec Format Error
    """
    # 1. Compilation Error
    if status_id == 6:
        err_msg = compile_output if compile_output else "Compilation error: syntax or compilation failure"
        return "compile", err_msg

    # 2. Runtime Errors or Time Limit Exceeded
    if status_id in (4, 5, 7, 8, 9, 10, 11, 12, 13, 14):
        err_msg = stderr if stderr else (compile_output if compile_output else "Runtime error occurred during execution")
        return "runtime", err_msg

    # 3. Accepted
    if status_id == 3:
        return "success", None

    # Fallback heuristics
    if compile_output and not stderr:
        return "compile", compile_output
    if stderr:
        return "runtime", stderr

    return "runtime", "Execution terminated with unknown status"


async def execute_code_judge0(
    canonical_lang: str,
    code: str,
    stdin: str = "",
    time_limit_ms: Optional[int] = None,
    memory_limit_kb: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Submits code to Judge0 for compilation and sandboxed execution.
    Uses base64 encoding to avoid UTF-8 errors with GCC compiler quotes.
    """
    lang_id = get_language_id(canonical_lang)
    judge0_url = settings.JUDGE0_URL.rstrip("/")
    endpoint = f"{judge0_url}/submissions?base64_encoded=true&wait=true"

    headers = {
        "Content-Type": "application/json",
        "User-Agent": "CodeArena-Platform/1.0",
    }
    if settings.JUDGE0_API_KEY:
        headers["X-RapidAPI-Key"] = settings.JUDGE0_API_KEY
        headers["X-RapidAPI-Host"] = settings.JUDGE0_API_HOST

    payload = {
        "source_code": encode_b64(code),
        "language_id": lang_id,
        "stdin": encode_b64(stdin) if stdin else "",
    }
    if time_limit_ms is not None:
        payload["cpu_time_limit"] = max(time_limit_ms / 1000, 0.1)
    if memory_limit_kb is not None:
        payload["memory_limit"] = memory_limit_kb

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(endpoint, json=payload, headers=headers)
        if response.status_code not in (200, 201):
            raise RuntimeError(
                f"Judge0 responded with status {response.status_code}: {response.text}"
            )
        data = response.json()

    stdout = decode_b64(data.get("stdout"))
    stderr = decode_b64(data.get("stderr"))
    compile_output = decode_b64(data.get("compile_output"))
    message = decode_b64(data.get("message"))

    status_obj = data.get("status", {})
    status_id = status_obj.get("id", 0)
    status_desc = status_obj.get("description", "Unknown Status")

    stage, error_msg = classify_stage(status_id, compile_output, stderr or message)

    exec_time = None
    if data.get("time"):
        try:
            exec_time = float(data.get("time"))
        except (ValueError, TypeError):
            exec_time = None

    memory = data.get("memory")

    return {
        "stage": stage,
        "status": status_desc,
        "status_id": status_id,
        "stdout": stdout,
        "stderr": stderr,
        "compile_output": compile_output,
        "error": error_msg,
        "execution_time": exec_time,
        "memory": memory,
        "language": canonical_lang,
        "language_id": lang_id,
    }

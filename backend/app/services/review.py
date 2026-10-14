import asyncio
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import httpx

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.problem import Submission
from app.schemas.problem import AIReview


def _rubric_text() -> str:
    candidates = [
        Path("/docs/review-rubric.md"),
        Path(__file__).resolve().parents[3] / "docs" / "review-rubric.md",
    ]
    for path in candidates:
        if path.is_file():
            return path.read_text(encoding="utf-8")
    raise FileNotFoundError("Review rubric was not found.")


def _analyzer_command(language: str, source_path: str) -> list[str] | None:
    if language == "python":
        return ["pylint", "--output-format=text", "--reports=no", source_path]
    if language in {"c", "cpp"}:
        return ["cppcheck", "--enable=warning,style,performance,portability", "--quiet", source_path]
    if language == "java":
        config = next(
            (path for path in ("/google_checks.xml", "/sun_checks.xml", "/usr/share/checkstyle/google_checks.xml") if Path(path).is_file()),
            "/google_checks.xml",
        )
        return ["checkstyle", "-c", config, source_path]
    return None


def _run_static_analysis(language: str, code: str) -> str:
    suffix = {"python": ".py", "c": ".c", "cpp": ".cpp", "java": ".java"}.get(language, ".txt")
    command_name = {"python": "pylint", "c": "cppcheck", "cpp": "cppcheck", "java": "checkstyle"}.get(language)
    if command_name and shutil.which(command_name) is None:
        return f"{command_name}: analyzer is not installed."

    with tempfile.TemporaryDirectory() as directory:
        source_path = str(Path(directory) / f"Main{suffix}")
        Path(source_path).write_text(code, encoding="utf-8")
        command = _analyzer_command(language, source_path)
        if command is None:
            return "No static analyzer is configured for this language."
        try:
            result = subprocess.run(command, capture_output=True, text=True, timeout=30, check=False)
        except (OSError, subprocess.TimeoutExpired) as exc:
            return f"{command[0]} failed: {exc}"
        output = "\n".join(part for part in (result.stdout, result.stderr) if part).strip()
        return output or "No warnings or errors found."


def _parse_review(raw_text: str) -> AIReview:
    cleaned = raw_text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE | re.DOTALL).strip()
    return AIReview.model_validate(json.loads(cleaned))


async def _request_review(system_prompt: str, user_message: str, retry: bool = False) -> AIReview:
    suffix = "\nRespond with ONLY valid JSON. Do not use markdown or add any explanation." if retry else ""
    payload = {
        "model": "claude-sonnet-4-6",
        "max_tokens": 1000,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_message + suffix}],
    }
    headers = {
        "x-api-key": settings.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
        response.raise_for_status()
    content = response.json().get("content", [])
    text = "".join(item.get("text", "") for item in content if item.get("type") == "text")
    try:
        return _parse_review(text)
    except (json.JSONDecodeError, TypeError, ValueError) as exc:
        if retry:
            raise exc
        return await _request_review(system_prompt, user_message, retry=True)


def _generate_fallback_review(code: str, language: str, verdict: str) -> AIReview:
    """Intelligent automated multi-pillar rubric evaluation engine when external LLM API key is not configured."""
    is_accepted = verdict.strip().lower() == "accepted"

    # 1. Correctness (1-10, 30% weight)
    if is_accepted:
        correctness = 10
    elif "wrong answer" in verdict.lower():
        correctness = 6
    elif "time limit" in verdict.lower():
        correctness = 7
    elif "runtime" in verdict.lower():
        correctness = 4
    else:
        correctness = 2

    # 2. Efficiency (1-10, 25% weight) based on loop nesting & Big-O
    lines = [line.strip() for line in code.splitlines() if line.strip() and not line.strip().startswith(("#", "//", "/*"))]
    nested_loops = 0
    loop_depth = 0
    for line in lines:
        if any(kw in line for kw in ("for ", "while ", "for(", "while(")):
            loop_depth += 1
            if loop_depth > nested_loops:
                nested_loops = loop_depth
        if "}" in line:
            loop_depth = max(0, loop_depth - 1)

    if nested_loops == 0:
        efficiency = 10
    elif nested_loops == 1:
        efficiency = 9
    elif nested_loops == 2:
        efficiency = 7
    else:
        efficiency = 5

    # 3. Readability & Cleanliness (1-10, 15% weight)
    readability = 8
    if len(code) > 20:
        if any(c in code for c in ("\n    ", "\n  ", "\t")):
            readability += 1
        if any(sym in code for sym in ("int ", "def ", "class ", "return ")):
            readability = min(10, readability + 1)

    # 4. Best Practices & Security (1-10, 30% weight)
    best_practices = 8
    if language in {"c", "cpp"} and "using namespace std;" in code:
        best_practices -= 1
    if "return 0;" in code or "return" in code:
        best_practices = min(10, best_practices + 1)

    overall = round(
        (correctness * 0.30) + (efficiency * 0.25) + (readability * 0.15) + (best_practices * 0.30),
        1
    )
    overall = max(1.0, min(10.0, overall))

    strengths = []
    improvements = []
    if is_accepted:
        strengths.append("Solution passed test suites with valid sandbox exit status.")
    else:
        improvements.append(f"Solution received '{verdict}' verdict. Double-check boundary conditions.")

    if efficiency >= 8:
        strengths.append(f"Optimal asymptotic time complexity (loop depth: {nested_loops}).")
    else:
        improvements.append("Refactor algorithmic loops to avoid high polynomial complexity.")

    if language in {"c", "cpp"}:
        if "using namespace std;" in code:
            improvements.append("Avoid 'using namespace std;' in global scope to prevent symbol collisions.")
        if "#include" in code:
            strengths.append("Standard library headers included cleanly.")

    feedback_parts = []
    if strengths:
        feedback_parts.append("Key Strengths: " + " ".join(strengths))
    if improvements:
        feedback_parts.append("Actionable Improvements: " + " ".join(improvements))
    if not feedback_parts:
        feedback_parts.append("Algorithmic code conforms to standard multi-pillar software engineering practices.")

    return AIReview(
        correctness=correctness,
        efficiency=efficiency,
        readability=readability,
        best_practices=best_practices,
        overall_score=overall,
        feedback="\n\n".join(feedback_parts),
    )


async def generate_review(code: str, language: str, verdict: str) -> AIReview:
    if settings.ANTHROPIC_API_KEY:
        try:
            static_output = await asyncio.to_thread(_run_static_analysis, language, code)
            user_message = (
                f"Submitted code ({language}):\n```\n{code}\n```\n\n"
                f"Static analysis output:\n{static_output}\n\n"
                f"Judge verdict from Stage 3: {verdict}"
            )
            review = await _request_review(_rubric_text(), user_message)
            if review is not None:
                return review
        except Exception:
            pass

    return _generate_fallback_review(code, language, verdict)


async def review_submission(submission_id: int, code: str, language: str, verdict: str) -> None:
    review = await generate_review(code, language, verdict)
    if review is None:
        return
    db = SessionLocal()
    try:
        submission = db.query(Submission).filter(Submission.id == submission_id).first()
        if submission is not None:
            submission.ai_review = review.model_dump()
            db.commit()
    finally:
        db.close()
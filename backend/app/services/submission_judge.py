import httpx

from app.models.problem import Problem
from app.schemas.problem import SampleTestResult
from app.services.judge0 import execute_code_judge0


async def judge_problem(problem: Problem, code: str, language: str) -> tuple[str, float, list[dict]]:
    test_cases = list(problem.test_cases)
    passed_count = 0
    observed_verdicts: set[str] = set()
    sample_results: list[dict] = []

    for test_case in test_cases:
        result = await execute_code_judge0(
            canonical_lang=language,
            code=code,
            stdin=test_case.input,
            time_limit_ms=problem.time_limit_ms,
            memory_limit_kb=problem.memory_limit_kb,
        )
        actual_output = result.get("stdout")
        passed = (
            result["stage"] == "success"
            and (actual_output or "").strip() == test_case.expected_output.strip()
        )
        if passed:
            passed_count += 1
        elif result.get("status_id") == 5:
            observed_verdicts.add("Time Limit Exceeded")
        elif result["stage"] == "compile":
            observed_verdicts.add("Compile Error")
        elif result["stage"] != "success":
            observed_verdicts.add("Runtime Error")
        else:
            observed_verdicts.add("Wrong Answer")

        if test_case.is_sample:
            sample_results.append(
                SampleTestResult(
                    test_case_id=test_case.id,
                    input=test_case.input,
                    expected_output=test_case.expected_output,
                    actual_output=actual_output,
                    passed=passed,
                ).model_dump()
            )

    verdict = "Accepted"
    for candidate in ("Time Limit Exceeded", "Compile Error", "Runtime Error", "Wrong Answer"):
        if candidate in observed_verdicts:
            verdict = candidate
            break
    return verdict, passed_count / len(test_cases), sample_results
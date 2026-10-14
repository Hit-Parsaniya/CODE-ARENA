import os
import sys
from datetime import datetime, timedelta, timezone

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import engine, Base, SessionLocal
from app.core.security import hash_password, create_access_token
from app.models.user import User
from app.models.contest import Contest, ContestProblem
from app.models.problem import Problem, TestCase

def run_tests():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # 1. Setup Admin and User
    admin = db.query(User).filter(User.username == "readiness_admin").first()
    if not admin:
        admin = User(
            username="readiness_admin",
            email="readiness_admin@codex.ai",
            password_hash=hash_password("AdminPass123!"),
            role="admin",
            is_admin=True,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)

    student = db.query(User).filter(User.username == "readiness_student").first()
    if not student:
        student = User(
            username="readiness_student",
            email="readiness_student@codex.ai",
            password_hash=hash_password("StudentPass123!"),
            role="user",
            is_admin=False,
        )
        db.add(student)
        db.commit()
        db.refresh(student)

    admin_token = create_access_token(admin.id, extra_claims={"role": admin.role, "is_admin": True})
    student_token = create_access_token(student.id, extra_claims={"role": student.role, "is_admin": False})

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    student_headers = {"Authorization": f"Bearer {student_token}"}

    client = TestClient(app)

    print("\n--- 1. Testing Problem Creation (0 test cases) ---")
    res = client.post("/admin/problems", json={
        "title": "Problem 3-Case Readiness Test",
        "description": "Calculate square of integer.",
        "difficulty": "easy",
        "tags": ["math"],
        "time_limit_ms": 2000,
        "memory_limit_kb": 262144,
    }, headers=admin_headers)
    assert res.status_code in (200, 201), f"Failed to create problem: {res.text}"
    prob = res.json()
    problem_id = prob["id"]
    assert prob["is_ready"] is False, "Problem with 0 test cases should not be ready"
    assert prob["hidden_test_cases_count"] == 0, f"Expected 0 hidden test cases, got {prob['hidden_test_cases_count']}"
    print(f"[PASS] Created problem #{problem_id}: is_ready=False, hidden_test_cases_count=0")

    # Student submission to POST /submissions should fail with 400
    sub_res = client.post("/submissions", json={
        "problem_id": problem_id,
        "code": "print(int(input())**2)",
        "language": "python",
    }, headers=student_headers)
    assert sub_res.status_code == 400, f"Expected 400 for not-ready problem, got {sub_res.status_code}: {sub_res.text}"
    assert "not yet open" in sub_res.json()["detail"].lower()
    print("[PASS] POST /submissions rejected with HTTP 400 ('This problem is not yet open for submissions')")

    print("\n--- 2. Adding 1 Sample Test Case (is_sample: True) ---")
    tc1_res = client.post(f"/admin/problems/{problem_id}/testcases", json={
        "input": "2",
        "expected_output": "4",
        "is_sample": True,
    }, headers=admin_headers)
    assert tc1_res.status_code in (200, 201)

    prob_res = client.get(f"/problems/{problem_id}")
    assert prob_res.status_code == 200
    prob_data = prob_res.json()
    assert prob_data["is_ready"] is False
    assert prob_data["hidden_test_cases_count"] == 0
    print("[PASS] After adding 1 sample case: is_ready=False, hidden_test_cases_count=0")

    # Still rejected
    sub_res = client.post("/submissions", json={
        "problem_id": problem_id,
        "code": "print(int(input())**2)",
        "language": "python",
    }, headers=student_headers)
    assert sub_res.status_code == 400
    print("[PASS] POST /submissions still rejected with HTTP 400")

    print("\n--- 3. Adding 1st Hidden Test Case (is_sample: False) ---")
    tc2_res = client.post(f"/admin/problems/{problem_id}/testcases", json={
        "input": "3",
        "expected_output": "9",
        "is_sample": False,
    }, headers=admin_headers)
    assert tc2_res.status_code in (200, 201)

    prob_res = client.get(f"/problems/{problem_id}")
    prob_data = prob_res.json()
    assert prob_data["is_ready"] is False, "Problem with 1 hidden testcase must NOT be ready"
    assert prob_data["hidden_test_cases_count"] == 1
    print("[PASS] After 1 hidden case: is_ready=False, hidden_test_cases_count=1")

    sub_res = client.post("/submissions", json={
        "problem_id": problem_id,
        "code": "print(int(input())**2)",
        "language": "python",
    }, headers=student_headers)
    assert sub_res.status_code == 400
    print("[PASS] POST /submissions rejected with 1 hidden testcase")

    print("\n--- 4. Adding 2nd Hidden Test Case (is_sample: False) ---")
    tc3_res = client.post(f"/admin/problems/{problem_id}/testcases", json={
        "input": "4",
        "expected_output": "16",
        "is_sample": False,
    }, headers=admin_headers)
    assert tc3_res.status_code in (200, 201)

    # Check via GET /problems (list view for admin/all)
    list_res = client.get("/problems")
    assert list_res.status_code == 200
    matched = [p for p in list_res.json() if p["id"] == problem_id][0]
    assert matched["is_ready"] is False, "Problem with 2 hidden testcases must NOT be ready"
    assert matched["hidden_test_cases_count"] == 2
    print(f"[PASS] After 2 hidden cases: is_ready={matched['is_ready']}, hidden_test_cases_count={matched['hidden_test_cases_count']}")

    sub_res = client.post("/submissions", json={
        "problem_id": problem_id,
        "code": "print(int(input())**2)",
        "language": "python",
    }, headers=student_headers)
    assert sub_res.status_code == 400
    print("[PASS] POST /submissions rejected with 2 hidden testcases (>=3 required)")

    print("\n--- 5. Adding 3rd Hidden Test Case (is_sample: False) ---")
    tc4_res = client.post(f"/admin/problems/{problem_id}/testcases", json={
        "input": "5",
        "expected_output": "25",
        "is_sample": False,
    }, headers=admin_headers)
    assert tc4_res.status_code in (200, 201)
    tc4_id = tc4_res.json()["id"]

    list_res = client.get("/problems")
    matched = [p for p in list_res.json() if p["id"] == problem_id][0]
    assert matched["is_ready"] is True, "Problem with 3 hidden testcases MUST be ready"
    assert matched["hidden_test_cases_count"] == 3
    print(f"[PASS] After 3 hidden cases: is_ready={matched['is_ready']}, hidden_test_cases_count={matched['hidden_test_cases_count']}")

    detail_res = client.get(f"/problems/{problem_id}")
    detail_data = detail_res.json()
    assert detail_data["is_ready"] is True
    assert detail_data["hidden_test_cases_count"] == 3
    print("[PASS] GET /problems/:id also returns is_ready=True, hidden_test_cases_count=3")

    print("\n--- 6. Testing Contest Submission Readiness (POST /contests/:id/submit) ---")
    # Admin creates contest with an unready problem (0 hidden testcases) and ready problem
    unready_prob_res = client.post("/admin/problems", json={
        "title": "Unready Contest Problem",
        "description": "Has only 2 hidden testcases",
        "difficulty": "medium",
        "tags": ["contest"],
        "time_limit_ms": 2000,
        "memory_limit_kb": 262144,
    }, headers=admin_headers)
    unready_prob_id = unready_prob_res.json()["id"]

    # Add 2 hidden testcases to unready_prob
    for inp, out in [("1", "1"), ("2", "2")]:
        client.post(f"/admin/problems/{unready_prob_id}/testcases", json={
            "input": inp, "expected_output": out, "is_sample": False
        }, headers=admin_headers)

    now = datetime.now(timezone.utc)
    c_res = client.post("/admin/contests", json={
        "title": "Readiness Check Contest",
        "description": "Testing contest readiness",
        "start_time": (now - timedelta(minutes=5)).isoformat(),
        "end_time": (now + timedelta(hours=2)).isoformat(),
        "visibility": "public",
        "problems": [
            {"problem_id": unready_prob_id, "points": 100},
            {"problem_id": problem_id, "points": 100},
        ],
    }, headers=admin_headers)
    assert c_res.status_code in (200, 201), f"Failed to create contest: {c_res.text}"
    contest_id = c_res.json()["id"]

    # Check GET /contests/:id shows is_ready appropriately
    cdetail = client.get(f"/contests/{contest_id}", headers=student_headers).json()
    cp_map = {cp["problem_id"]: cp for cp in cdetail["problems"]}
    assert cp_map[unready_prob_id]["is_ready"] is False
    assert cp_map[unready_prob_id]["hidden_test_cases_count"] == 2
    assert cp_map[problem_id]["is_ready"] is True
    assert cp_map[problem_id]["hidden_test_cases_count"] == 3
    print(f"[PASS] Contest problem details show correct is_ready and hidden_test_cases_count")

    # Student joins contest
    client.post(f"/contests/{contest_id}/join", headers=student_headers)

    # Student submits to unready problem in contest -> HTTP 400
    c_sub_fail = client.post(f"/contests/{contest_id}/submit", json={
        "problem_id": unready_prob_id,
        "code": "print(input())",
        "language": "python",
    }, headers=student_headers)
    assert c_sub_fail.status_code == 400
    assert "not yet open" in c_sub_fail.json()["detail"].lower()
    print("[PASS] POST /contests/:id/submit rejected with 400 for problem with 2 hidden testcases")

    print("\n--- 7. Deleting 3rd Hidden Case Reverts Readiness to False ---")
    del_res = client.delete(f"/admin/problems/{problem_id}/testcases/{tc4_id}", headers=admin_headers)
    assert del_res.status_code in (200, 204)

    prob_recheck = client.get(f"/problems/{problem_id}").json()
    assert prob_recheck["is_ready"] is False
    assert prob_recheck["hidden_test_cases_count"] == 2
    print("[PASS] After deleting 3rd hidden testcase, is_ready reverted to False (count=2)")

    sub_res = client.post("/submissions", json={
        "problem_id": problem_id,
        "code": "print(int(input())**2)",
        "language": "python",
    }, headers=student_headers)
    assert sub_res.status_code == 400
    print("[PASS] POST /submissions is again rejected with HTTP 400")

    # Clean up test problems and contest
    client.delete(f"/admin/contests/{contest_id}", headers=admin_headers)
    client.delete(f"/admin/problems/{problem_id}", headers=admin_headers)
    client.delete(f"/admin/problems/{unready_prob_id}", headers=admin_headers)
    db.close()

    print("\n==========================================")
    print("SUCCESS: ALL 3-CASE PROBLEM READINESS TESTS PASSED!")
    print("==========================================\n")

if __name__ == "__main__":
    run_tests()

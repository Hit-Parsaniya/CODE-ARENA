import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import engine, Base, SessionLocal
from app.core.security import hash_password, create_access_token
from app.models.user import User
from app.models.problem import Problem, TestCase
from app.models.contest import Contest, ContestProblem

def run_tests():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    admin = db.query(User).filter(User.username == "contest_flow_admin").first()
    if not admin:
        admin = User(
            username="contest_flow_admin",
            email="contest_flow_admin@codex.ai",
            password_hash=hash_password("AdminPass123!"),
            role="admin",
            is_admin=True,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)

    student = db.query(User).filter(User.username == "contest_flow_student").first()
    if not student:
        student = User(
            username="contest_flow_student",
            email="contest_flow_student@codex.ai",
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

    print("\n--- 1. Testing POST /admin/contests (Shell Only, No Test Case Fields) ---")
    now = datetime.now(timezone.utc)
    contest_payload = {
        "title": "Spring Algorithm Cup 2026",
        "description": "Annual speed programming tournament.",
        "start_time": (now + timedelta(hours=1)).isoformat(),
        "end_time": (now + timedelta(hours=4)).isoformat(),
        "visibility": "public",
    }
    res = client.post("/admin/contests", json=contest_payload, headers=admin_headers)
    assert res.status_code in (200, 201), f"Failed to create contest: {res.text}"
    contest = res.json()
    contest_id = contest["id"]
    print(f"[PASS] Created contest shell #{contest_id}: {contest['title']}")

    # GET /admin/contests/:id/problems initially returns []
    res = client.get(f"/admin/contests/{contest_id}/problems", headers=admin_headers)
    assert res.status_code == 200
    assert res.json() == []
    print("[PASS] GET /admin/contests/:id/problems initially returns empty list")

    print("\n--- 2. Create problem with 1 hidden test case ---")
    prob_res = client.post("/admin/problems", json={
        "title": "Prime Factorization",
        "description": "Find all prime factors of N.",
        "difficulty": "medium",
        "tags": ["math", "number-theory"],
        "time_limit_ms": 2000,
        "memory_limit_kb": 262144,
    }, headers=admin_headers)
    assert prob_res.status_code in (200, 201)
    problem_id = prob_res.json()["id"]

    # Add 1 sample testcase
    client.post(f"/admin/problems/{problem_id}/testcases", json={
        "input": "12", "expected_output": "2 2 3", "is_sample": True
    }, headers=admin_headers)

    # Add 1 hidden testcase
    client.post(f"/admin/problems/{problem_id}/testcases", json={
        "input": "100", "expected_output": "2 2 5 5", "is_sample": False
    }, headers=admin_headers)
    print(f"[PASS] Created Problem #{problem_id} with 1 sample and 1 hidden testcase")

    print("\n--- 3. Testing POST /admin/contests/:id/problems rejection with non-existent problem ---")
    fake_res = client.post(f"/admin/contests/{contest_id}/problems", json={
        "problem_id": 999999,
        "points": 100,
    }, headers=admin_headers)
    assert fake_res.status_code == 404, f"Expected 404, got {fake_res.status_code}"
    assert "does not exist" in fake_res.json()["detail"] or "not found" in fake_res.json()["detail"].lower()
    print(f"[PASS] Rejected non-existent problem ID 999999 with 404: {fake_res.json()['detail']}")

    print("\n--- 4. Testing POST /admin/contests/:id/problems attach ---")
    attach_res = client.post(f"/admin/contests/{contest_id}/problems", json={
        "problem_id": problem_id,
        "points": 150,
    }, headers=admin_headers)
    assert attach_res.status_code == 201, f"Expected 201, got {attach_res.status_code}: {attach_res.text}"
    attached_data = attach_res.json()
    assert attached_data["problem_id"] == problem_id
    assert attached_data["points"] == 150
    assert attached_data["is_ready"] is False, "1 hidden case should mean is_ready is False"
    assert attached_data["hidden_test_cases_count"] == 1
    assert attached_data["test_cases_count"] == 2  # 1 sample + 1 hidden
    print(f"[PASS] Attached problem #{problem_id} with 150 points; is_ready=False, hidden_count=1, test_cases_count=2")

    print("\n--- 5. Testing GET /admin/contests/:id/problems ---")
    list_res = client.get(f"/admin/contests/{contest_id}/problems", headers=admin_headers)
    assert list_res.status_code == 200
    items = list_res.json()
    assert len(items) == 1
    assert items[0]["problem_id"] == problem_id
    assert items[0]["is_ready"] is False
    assert items[0]["hidden_test_cases_count"] == 1
    assert items[0]["test_cases_count"] == 2
    print("[PASS] GET /admin/contests/:id/problems correctly lists problem with readiness and counts")

    print("\n--- 6. Adding 2 more hidden test cases -> Problem becomes ready ---")
    client.post(f"/admin/problems/{problem_id}/testcases", json={
        "input": "84", "expected_output": "2 2 3 7", "is_sample": False
    }, headers=admin_headers)
    client.post(f"/admin/problems/{problem_id}/testcases", json={
        "input": "97", "expected_output": "97", "is_sample": False
    }, headers=admin_headers)

    list_res2 = client.get(f"/admin/contests/{contest_id}/problems", headers=admin_headers)
    items2 = list_res2.json()
    assert items2[0]["is_ready"] is True
    assert items2[0]["hidden_test_cases_count"] == 3
    assert items2[0]["test_cases_count"] == 4
    print("[PASS] After adding 2 more hidden testcases, contest problem list shows is_ready=True, hidden_count=3")

    print("\n--- 7. Testing DELETE /admin/contests/:id/problems/:problem_id ---")
    del_res = client.delete(f"/admin/contests/{contest_id}/problems/{problem_id}", headers=admin_headers)
    assert del_res.status_code == 204
    print("[PASS] Removed problem from contest with 204 No Content")

    # Verify contest problems is now empty
    list_res3 = client.get(f"/admin/contests/{contest_id}/problems", headers=admin_headers)
    assert list_res3.json() == []
    print("[PASS] Contest problem list is now empty")

    # Verify the Problem itself was NOT deleted
    prob_still_exists = client.get(f"/problems/{problem_id}")
    assert prob_still_exists.status_code == 200
    assert prob_still_exists.json()["id"] == problem_id
    print("[PASS] Problem entity was preserved and still exists")

    print("\n--- 8. Testing RBAC: Non-admin is rejected with 403 ---")
    non_admin_get = client.get(f"/admin/contests/{contest_id}/problems", headers=student_headers)
    assert non_admin_get.status_code == 403
    non_admin_post = client.post(f"/admin/contests/{contest_id}/problems", json={"problem_id": problem_id, "points": 100}, headers=student_headers)
    assert non_admin_post.status_code == 403
    non_admin_del = client.delete(f"/admin/contests/{contest_id}/problems/{problem_id}", headers=student_headers)
    assert non_admin_del.status_code == 403
    print("[PASS] Non-admin calls to /admin/contests/:id/problems correctly return 403 Forbidden")

    # Cleanup
    client.delete(f"/admin/contests/{contest_id}", headers=admin_headers)
    client.delete(f"/admin/problems/{problem_id}", headers=admin_headers)
    db.close()

    print("\n==========================================")
    print("SUCCESS: ALL CONTEST PROBLEM MANAGEMENT BACKEND TESTS PASSED!")
    print("==========================================\n")

if __name__ == "__main__":
    run_tests()

import asyncio
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
from app.models.contest import Contest, ContestInvite, ContestProblem, ContestParticipant, ContestSubmission
from app.models.problem import Problem, TestCase

def setup_test_data():
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Create or update Admin User (User 1)
    admin_user = db.query(User).filter(User.username == "test_admin").first()
    if not admin_user:
        admin_user = User(
            username="test_admin",
            email="admin@codex.ai",
            password_hash=hash_password("AdminPass123!"),
            role="admin",
            is_admin=True
        )
        db.add(admin_user)
    else:
        admin_user.role = "admin"
        admin_user.is_admin = True
    
    # Create Regular User (User 2)
    regular_user = db.query(User).filter(User.username == "test_regular").first()
    if not regular_user:
        regular_user = User(
            username="test_regular",
            email="regular@codex.ai",
            password_hash=hash_password("UserPass123!"),
            role="user",
            is_admin=False
        )
        db.add(regular_user)
    else:
        regular_user.role = "user"
        regular_user.is_admin = False
        
    db.commit()
    db.refresh(admin_user)
    db.refresh(regular_user)
    
    admin_id = admin_user.id
    admin_email = admin_user.email
    regular_id = regular_user.id
    regular_email = regular_user.email
    db.close()
    return admin_id, admin_email, regular_id, regular_email

def run_tests():
    admin_id, admin_email, regular_id, regular_email = setup_test_data()
    client = TestClient(app)
    
    admin_token = create_access_token(admin_id)
    regular_token = create_access_token(regular_id)
    
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    regular_headers = {"Authorization": f"Bearer {regular_token}"}
    
    print("\n--- 1. Testing Role Verification & Role Management (PATCH /admin/users/:id/role) ---")
    # Regular user attempting admin endpoint -> 403
    res = client.patch(f"/admin/users/{regular_id}/role", json={"role": "admin"}, headers=regular_headers)
    assert res.status_code == 403, f"Expected 403, got {res.status_code}: {res.text}"
    print("[PASS] Non-admin receives 403 when attempting to change user role")
    
    # Admin can change user role
    res = client.patch(f"/admin/users/{regular_id}/role", json={"role": "admin"}, headers=admin_headers)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    assert res.json()["role"] == "admin", "Role was not updated to admin"
    print("[PASS] Admin successfully promoted regular user to admin")
    
    # Demote back to user
    res = client.patch(f"/admin/users/{regular_id}/role", json={"role": "user"}, headers=admin_headers)
    assert res.status_code == 200
    assert res.json()["role"] == "user"
    print("[PASS] Admin successfully demoted user back to user role")
    
    print("\n--- 2. Testing Problem Creation & Hidden Test Cases (POST /admin/problems & /admin/problems/:id/testcases) ---")
    # Admin creates problem
    prob_data = {
        "title": "RBAC Square Test",
        "description": "Calculate n squared.",
        "difficulty": "easy",
        "tags": ["math", "admin-test"],
        "time_limit_ms": 1500,
        "memory_limit_kb": 65536
    }
    res = client.post("/admin/problems", json=prob_data, headers=admin_headers)
    assert res.status_code in (200, 201), f"Failed to create problem: {res.text}"
    problem = res.json()
    problem_id = problem["id"]
    print(f"[PASS] Admin created problem #{problem_id}: {problem['title']}")
    
    # Admin adds sample testcase
    res = client.post(f"/admin/problems/{problem_id}/testcases", json={
        "input": "4",
        "expected_output": "16",
        "is_sample": True
    }, headers=admin_headers)
    assert res.status_code in (200, 201), f"Failed to add sample testcase: {res.text}"
    
    # Admin adds hidden testcase
    res = client.post(f"/admin/problems/{problem_id}/testcases", json={
        "input": "100",
        "expected_output": "10000",
        "is_sample": False
    }, headers=admin_headers)
    assert res.status_code in (200, 201), f"Failed to add hidden testcase: {res.text}"
    print("[PASS] Admin added 1 sample testcase and 1 hidden testcase")
    
    # Public endpoint GET /problems/:id must ONLY return sample testcases
    res = client.get(f"/problems/{problem_id}")
    assert res.status_code == 200
    pub_problem = res.json()
    assert len(pub_problem["sample_test_cases"]) == 1
    assert pub_problem["sample_test_cases"][0]["input"] == "4"
    print("[PASS] Public GET /problems/:id returns ONLY sample testcase (hidden testcase NOT exposed)")
    
    # Admin endpoint GET /admin/problems/:id/testcases returns ALL test cases
    res = client.get(f"/admin/problems/{problem_id}/testcases", headers=admin_headers)
    assert res.status_code == 200
    all_tcs = res.json()
    assert len(all_tcs) == 2
    print(f"[PASS] Admin GET /admin/problems/:id/testcases returns all {len(all_tcs)} test cases")
    
    print("\n--- 3. Testing Private Contests, Invites & 404 Behavior ---")
    now = datetime.now(timezone.utc)
    start_time = (now - timedelta(hours=1)).isoformat()
    end_time = (now + timedelta(hours=2)).isoformat()
    
    # Admin creates public contest
    res = client.post("/admin/contests", json={
        "title": "Public Arena Contest",
        "description": "Open for all coders.",
        "start_time": start_time,
        "end_time": end_time,
        "visibility": "public"
    }, headers=admin_headers)
    assert res.status_code in (200, 201)
    public_contest_id = res.json()["id"]
    print(f"[PASS] Created Public Contest #{public_contest_id}")
    
    # Admin creates private contest
    res = client.post("/admin/contests", json={
        "title": "VIP Secret Invitational",
        "description": "Strictly invite-only.",
        "start_time": start_time,
        "end_time": end_time,
        "visibility": "private"
    }, headers=admin_headers)
    assert res.status_code in (200, 201)
    private_contest_id = res.json()["id"]
    print(f"[PASS] Created Private Contest #{private_contest_id}")
    
    # Regular user calls GET /contests -> sees public contest, DOES NOT see private contest
    res = client.get("/contests", headers=regular_headers)
    assert res.status_code == 200
    contests_for_user = res.json()
    user_c_ids = [c["id"] for c in contests_for_user]
    assert public_contest_id in user_c_ids, "Public contest not in list"
    assert private_contest_id not in user_c_ids, "Private contest should NOT be visible to uninvited user"
    print("[PASS] Regular user GET /contests lists public contest but excludes uninvited private contest")
    
    # Regular user directly accesses private contest -> 404 (NOT 403)
    res = client.get(f"/contests/{private_contest_id}", headers=regular_headers)
    assert res.status_code == 404, f"Expected 404 Not Found for private contest, got {res.status_code}"
    print("[PASS] Regular user GET /contests/:id on uninvited private contest returns 404 (existence hidden)")
    
    # Regular user attempts to join private contest -> 404
    res = client.post(f"/contests/{private_contest_id}/join", headers=regular_headers)
    assert res.status_code == 404, f"Expected 404 on join, got {res.status_code}"
    print("[PASS] Regular user POST /contests/:id/join on uninvited private contest returns 404")
    
    # Admin invites Regular user by email: POST /admin/contests/:id/invite
    res = client.post(f"/admin/contests/{private_contest_id}/invite", json={"emails": [regular_email]}, headers=admin_headers)
    assert res.status_code in (200, 201), f"Invite failed: {res.text}"
    print(f"[PASS] Admin invited '{regular_email}' to Private Contest #{private_contest_id}")
    
    # Now Regular user calls GET /contests -> private contest is now visible!
    res = client.get("/contests", headers=regular_headers)
    assert res.status_code == 200
    user_c_ids = [c["id"] for c in res.json()]
    assert private_contest_id in user_c_ids, "Invited private contest should now be visible"
    print("[PASS] Invited user GET /contests now includes the private contest")
    
    # Invited user calls GET /contests/:id -> successfully gets details!
    res = client.get(f"/contests/{private_contest_id}", headers=regular_headers)
    assert res.status_code == 200
    assert res.json()["id"] == private_contest_id
    print("[PASS] Invited user can now access GET /contests/:id")
    
    # Invited user joins the private contest
    res = client.post(f"/contests/{private_contest_id}/join", headers=regular_headers)
    assert res.status_code in (200, 201)
    print("[PASS] Invited user successfully joined the private contest")
    
    # Admin fetches authoritative ranking: GET /admin/contests/:id/ranking
    res = client.get(f"/admin/contests/{private_contest_id}/ranking", headers=admin_headers)
    assert res.status_code == 200
    print("[PASS] Admin fetched authoritative leaderboard for contest")
    
    # Admin removes invite: DELETE /admin/contests/:id/invite
    res = client.request("DELETE", f"/admin/contests/{private_contest_id}/invite", json={"email": regular_email}, headers=admin_headers)
    assert res.status_code in (200, 204)
    print("[PASS] Admin removed invite for user")
    
    # Cascade delete contest: DELETE /admin/contests/:id
    res = client.delete(f"/admin/contests/{private_contest_id}", headers=admin_headers)
    assert res.status_code in (200, 204)
    print(f"[PASS] Admin deleted Private Contest #{private_contest_id} (cascade successful)")
    
    # Clean up public contest
    res = client.delete(f"/admin/contests/{public_contest_id}", headers=admin_headers)
    assert res.status_code in (200, 204)
    print(f"[PASS] Admin deleted Public Contest #{public_contest_id}")

    print("\n==========================================")
    print("SUCCESS: ALL RBAC & PRIVATE CONTEST TESTS PASSED!")
    print("==========================================\n")

if __name__ == "__main__":
    run_tests()

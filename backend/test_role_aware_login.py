import os
import sys

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from fastapi.testclient import TestClient
from datetime import datetime, timezone, timedelta
from app.main import app
from app.core.database import engine, Base, SessionLocal
from app.core.security import hash_password, create_access_token
from app.models.user import User
from app.models.contest import Contest, ContestProblem
from app.models.problem import Problem

def test_role_aware_login_and_contest_permissions():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # 1. Setup Admin and Regular users
    admin_user = db.query(User).filter(User.username == "test_admin").first()
    if not admin_user:
        admin_user = User(
            username="test_admin",
            email="admin@codex.ai",
            password_hash=hash_password("AdminPass123!"),
            role="admin",
            is_admin=True,
        )
        db.add(admin_user)
    else:
        admin_user.role = "admin"
        admin_user.is_admin = True

    regular_user = db.query(User).filter(User.username == "test_regular").first()
    if not regular_user:
        regular_user = User(
            username="test_regular",
            email="regular@codex.ai",
            password_hash=hash_password("UserPass123!"),
            role="user",
            is_admin=False,
        )
        db.add(regular_user)
    else:
        regular_user.role = "user"
        regular_user.is_admin = False

    db.commit()
    db.refresh(admin_user)
    db.refresh(regular_user)
    db.close()

    client = TestClient(app)

    print("\n--- 1. Testing POST /auth/login with intended_role ---")

    # Regular user logging in with intended_role="admin"
    res = client.post("/auth/login", json={
        "username_or_email": "regular@codex.ai",
        "password": "UserPass123!",
        "intended_role": "admin"
    })
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()
    assert data["user"]["role"] == "user", f"Expected actual role 'user', got {data['user']['role']}"
    assert data["user"]["is_admin"] is False
    print("[PASS] Regular user login with intended_role='admin' successfully authenticated and returned actual role='user'")

    # Admin user logging in with intended_role="admin"
    res = client.post("/auth/login", json={
        "username_or_email": "admin@codex.ai",
        "password": "AdminPass123!",
        "intended_role": "admin"
    })
    assert res.status_code == 200
    admin_data = res.json()
    assert admin_data["user"]["role"] == "admin"
    admin_token = admin_data["access_token"]
    print("[PASS] Admin user login with intended_role='admin' successfully returned actual role='admin'")

    # Admin user logging in with intended_role="user"
    res = client.post("/auth/login", json={
        "username_or_email": "admin@codex.ai",
        "password": "AdminPass123!",
        "intended_role": "user"
    })
    assert res.status_code == 200
    assert res.json()["user"]["role"] == "admin"
    print("[PASS] Admin user login with intended_role='user' successfully returned actual role='admin'")

    # Regular user logging in with intended_role="user"
    res = client.post("/auth/login", json={
        "username_or_email": "regular@codex.ai",
        "password": "UserPass123!",
        "intended_role": "user"
    })
    assert res.status_code == 200
    regular_data = res.json()
    assert regular_data["user"]["role"] == "user"
    regular_token = regular_data["access_token"]
    print("[PASS] Regular user login with intended_role='user' successfully returned actual role='user'")

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    regular_headers = {"Authorization": f"Bearer {regular_token}"}

    print("\n--- 2. Testing Contest Create / Delete RBAC (403 for user, 201/204 for admin) ---")

    # Regular user attempting POST /admin/contests -> 403 Forbidden
    contest_payload = {
        "title": "Unauthorized User Contest",
        "description": "Should fail",
        "start_time": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        "end_time": (datetime.now(timezone.utc) + timedelta(hours=3)).isoformat(),
        "visibility": "public",
        "problems": []
    }
    res = client.post("/admin/contests", json=contest_payload, headers=regular_headers)
    assert res.status_code == 403, f"Expected 403 for user creating contest, got {res.status_code}"
    print("[PASS] Regular user hitting POST /admin/contests is rejected with 403 Forbidden")

    # Regular user attempting POST /contests -> 403 Forbidden
    res = client.post("/contests", json=contest_payload, headers=regular_headers)
    assert res.status_code == 403, f"Expected 403 for user creating contest on /contests, got {res.status_code}"
    print("[PASS] Regular user hitting POST /contests is rejected with 403 Forbidden")

    # Admin creating contest -> 201 Created
    admin_contest_payload = {
        "title": "Admin Role Verification Arena",
        "description": "Contest created by admin via admin login",
        "start_time": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        "end_time": (datetime.now(timezone.utc) + timedelta(hours=3)).isoformat(),
        "visibility": "public",
        "problems": []
    }
    res = client.post("/admin/contests", json=admin_contest_payload, headers=admin_headers)
    assert res.status_code == 201, f"Expected 201 for admin creating contest, got {res.status_code}: {res.text}"
    contest = res.json()
    contest_id = contest["id"]
    print(f"[PASS] Admin created contest #{contest_id}: '{contest['title']}'")

    print("\n--- 3. Testing GET /contests/:id/leaderboard (Both Admin and User allowed) ---")
    # Regular user calling leaderboard
    res = client.get(f"/contests/{contest_id}/leaderboard", headers=regular_headers)
    assert res.status_code == 200, f"Expected 200 for user leaderboard, got {res.status_code}"
    print("[PASS] Regular user can access GET /contests/:id/leaderboard (200 OK)")

    # Admin calling leaderboard
    res = client.get(f"/contests/{contest_id}/leaderboard", headers=admin_headers)
    assert res.status_code == 200, f"Expected 200 for admin leaderboard, got {res.status_code}"
    print("[PASS] Admin can access GET /contests/:id/leaderboard (200 OK)")

    print("\n--- 4. Testing POST /contests/:id/join (Accessible to any authenticated user) ---")
    res = client.post(f"/contests/{contest_id}/join", headers=regular_headers)
    assert res.status_code == 200, f"Expected 200 for user join, got {res.status_code}: {res.text}"
    print("[PASS] Regular user successfully joined contest via POST /contests/:id/join (200 OK)")

    print("\n--- 5. Testing Contest Delete RBAC (403 for user, 204 for admin) ---")
    # Regular user attempting DELETE -> 403 Forbidden
    res = client.delete(f"/admin/contests/{contest_id}", headers=regular_headers)
    assert res.status_code == 403, f"Expected 403 for user deleting contest, got {res.status_code}"
    print("[PASS] Regular user hitting DELETE /admin/contests/:id is rejected with 403 Forbidden")

    res = client.delete(f"/contests/{contest_id}", headers=regular_headers)
    assert res.status_code == 403, f"Expected 403 for user deleting contest on /contests/:id, got {res.status_code}"
    print("[PASS] Regular user hitting DELETE /contests/:id is rejected with 403 Forbidden")

    # Admin deleting contest -> 204 No Content
    res = client.delete(f"/admin/contests/{contest_id}", headers=admin_headers)
    assert res.status_code == 204, f"Expected 204 for admin deleting contest, got {res.status_code}"
    print(f"[PASS] Admin successfully deleted contest #{contest_id} (204 No Content)")

    print("\n=======================================================")
    print("ALL ROLE-AWARE LOGIN & CONTEST PERMISSION TESTS PASSED!")
    print("=======================================================\n")

if __name__ == "__main__":
    test_role_aware_login_and_contest_permissions()

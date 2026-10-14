import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import engine, Base, SessionLocal
from app.core.security import hash_password, create_access_token
from app.models.user import User
from app.models.contest import Contest, ContestInvite

def run_bulk_invite_tests():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Create or fetch Admin User
    admin_user = db.query(User).filter(User.username == "test_admin_bulk").first()
    if not admin_user:
        admin_user = User(
            username="test_admin_bulk",
            email="bulk_admin@codex.ai",
            password_hash=hash_password("AdminPass123!"),
            role="admin",
            is_admin=True
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
    else:
        admin_user.role = "admin"
        admin_user.is_admin = True
        db.commit()
        
    admin_id = admin_user.id
    
    # Create a private contest for testing
    now = datetime.now(timezone.utc)
    contest = Contest(
        title="Bulk Invite Test Contest",
        description="Testing bulk email invites with duplicate & invalid parsing.",
        start_time=now,
        end_time=now + timedelta(days=2),
        visibility="private",
        created_by=admin_id
    )
    db.add(contest)
    db.commit()
    db.refresh(contest)
    contest_id = contest.id
    
    # Pre-seed one email to test duplicate detection
    pre_existing_email = "already_here@codex.ai"
    db.add(ContestInvite(contest_id=contest_id, invited_email=pre_existing_email))
    db.commit()
    db.close()
    
    client = TestClient(app)
    admin_token = create_access_token(admin_id)
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    print("\n--- Testing Bulk Email Invites (POST /admin/contests/:id/invite) ---")
    
    # Test batch: 5 valid emails, 1 duplicate (already in DB), and 1 malformed email
    # Also include internal whitespace to verify trimming
    emails_payload = [
        "  user1@domain.com  ",
        "user2@sub.domain.org",
        "user3@codex.ai",
        "user4@university.edu",
        "user5@company.io",
        "already_here@codex.ai",  # duplicate
        "not-an-email-address"    # malformed
    ]
    
    res = client.post(
        f"/admin/contests/{contest_id}/invite",
        json={"emails": emails_payload},
        headers=admin_headers
    )
    
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()
    
    added = data["added"]
    skipped_duplicates = data["skipped_duplicates"]
    invalid = data["invalid"]
    
    print(f"Added count: {len(added)} -> {added}")
    print(f"Skipped duplicates count: {len(skipped_duplicates)} -> {skipped_duplicates}")
    print(f"Invalid count: {len(invalid)} -> {invalid}")
    
    # Assertions
    assert len(added) == 5, f"Expected 5 added emails, got {len(added)}"
    assert len(skipped_duplicates) == 1, f"Expected 1 duplicate, got {len(skipped_duplicates)}"
    assert skipped_duplicates[0] == "already_here@codex.ai"
    assert len(invalid) == 1, f"Expected 1 invalid email, got {len(invalid)}"
    assert invalid[0] == "not-an-email-address"
    print("[PASS] Summary correctly separated 5 valid emails, 1 duplicate, and 1 malformed email")
    
    # Verify GET /admin/contests/:id/invites returns all 6 invited emails (1 pre-existing + 5 added)
    print("\n--- Testing GET /admin/contests/:id/invites ---")
    res = client.get(f"/admin/contests/{contest_id}/invites", headers=admin_headers)
    assert res.status_code == 200
    invites = res.json()
    assert len(invites) == 6, f"Expected 6 total invites, got {len(invites)}"
    invited_emails = [i["invited_email"] for i in invites]
    assert "user1@domain.com" in invited_emails
    assert "already_here@codex.ai" in invited_emails
    print(f"[PASS] GET /admin/contests/{contest_id}/invites successfully returned all 6 invited emails")
    
    # Test DELETE /admin/contests/:id/invite for a single email
    print("\n--- Testing DELETE /admin/contests/:id/invite ---")
    res = client.request(
        "DELETE",
        f"/admin/contests/{contest_id}/invite",
        json={"email": "user1@domain.com"},
        headers=admin_headers
    )
    assert res.status_code == 200
    print("[PASS] Removed invite for 'user1@domain.com'")
    
    # Confirm count decreased to 5
    res = client.get(f"/admin/contests/{contest_id}/invites", headers=admin_headers)
    assert res.status_code == 200
    assert len(res.json()) == 5
    print("[PASS] Confirmed invite count decreased to 5")
    
    # Clean up test contest
    res = client.delete(f"/admin/contests/{contest_id}", headers=admin_headers)
    assert res.status_code in (200, 204)
    print(f"[PASS] Cleaned up test contest #{contest_id}")
    
    print("\n==========================================")
    print("SUCCESS: ALL BULK INVITE TESTS PASSED!")
    print("==========================================\n")

if __name__ == "__main__":
    run_bulk_invite_tests()

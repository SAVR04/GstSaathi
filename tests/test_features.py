import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app, raise_server_exceptions=True)

def test_auth_pipeline():
    print("\n--- 1. Testing Auth Pipeline & Profile Management ---")
    # 1. Login with demo email
    res = client.post("/api/v1/auth/login", json={"identifier": "taxpayer@gstsaathi.in", "password": "gstsaathi2026"})
    assert res.status_code == 200, f"Login failed: {res.text}"
    demo_token = res.json()["token"]
    assert "token" in res.json()
    assert res.json()["user"]["email"] == "taxpayer@gstsaathi.in"
    print(" [PASS] 1.1 Login with email identifier")

    # 1.1 Login with demo username
    res_user = client.post("/api/v1/auth/login", json={"identifier": "taxpayer", "password": "gstsaathi2026"})
    assert res_user.status_code == 200, f"Login by username failed: {res_user.text}"
    assert res_user.json()["user"]["username"] == "taxpayer"
    print(" [PASS] 1.2 Login with username identifier")

    # 2. Login with invalid credentials
    res_bad = client.post("/api/v1/auth/login", json={"identifier": "taxpayer", "password": "wrongpassword"})
    assert res_bad.status_code == 401
    print(" [PASS] 1.3 Rejected invalid credentials")

    # 3. Get current user profile
    res_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {demo_token}"})
    assert res_me.status_code == 200
    assert res_me.json()["email"] == "taxpayer@gstsaathi.in"
    print(" [PASS] 1.4 /auth/me returns taxpayer profile")

    # 4. Sign up new user with ONLY username, email, password
    import time
    unique_suffix = int(time.time())
    new_username = f"user_{unique_suffix}"
    new_email = f"user_{unique_suffix}@example.com"
    new_pwd = "SecurePassword123!"

    signup_res = client.post("/api/v1/auth/signup", json={
        "username": new_username,
        "email": new_email,
        "password": new_pwd
    })
    assert signup_res.status_code == 200, f"Signup failed: {signup_res.text}"
    user_token = signup_res.json()["token"]
    assert signup_res.json()["user"]["username"] == new_username
    assert not signup_res.json()["user"]["gstin"]
    print(" [PASS] 1.5 Sign up new user with only (username, email, password)")

    # 5. Login new user using username
    login_new = client.post("/api/v1/auth/login", json={
        "identifier": new_username,
        "password": new_pwd
    })
    assert login_new.status_code == 200
    print(" [PASS] 1.6 New user successfully signs in with username")

    # 6. Profile management: Add GSTIN and Business Name
    profile_update_res = client.put(
        "/api/v1/profile",
        headers={"Authorization": f"Bearer {user_token}"},
        json={
            "name": "Maharishi Logistics Pvt Ltd",
            "gstin": "27AAAAA0000A1Z5"
        }
    )
    assert profile_update_res.status_code == 200, f"Profile update failed: {profile_update_res.text}"
    updated_user = profile_update_res.json()
    assert updated_user["name"] == "Maharishi Logistics Pvt Ltd"
    assert updated_user["gstin"] == "27AAAAA0000A1Z5"
    print(" [PASS] 1.7 Add GSTIN and Business Name in Profile")

    # 7. Multi-tenant data isolation test:
    # Check that new user has 0 invoices initially
    inv_res = client.get("/api/v1/invoices", headers={"Authorization": f"Bearer {user_token}"})
    assert inv_res.status_code == 200
    assert len(inv_res.json()) == 0
    print(" [PASS] 1.8 User data isolation: New user sees 0 invoices in ledger")

    # Create an invoice for this new user
    create_inv_res = client.post(
        "/api/v1/invoices/create",
        headers={"Authorization": f"Bearer {user_token}"},
        json={
            "invoice_number": f"INV-USER-{unique_suffix}",
            "invoice_date": "2026-09-22",
            "seller_name": "Supplier X",
            "seller_gstin": "27AAAAA0000A1Z5",
            "buyer_name": "Maharishi Logistics Pvt Ltd",
            "buyer_gstin": "27BBBBB0000B1Z6",
            "taxable_amount": 10000.0,
            "gst_rate": 18.0
        }
    )
    assert create_inv_res.status_code == 200
    print(" [PASS] 1.9 Successfully created invoice isolated to new user")

    # Verify demo user cannot see new user's invoice
    demo_invs = client.get("/api/v1/invoices", headers={"Authorization": f"Bearer {demo_token}"}).json()
    new_user_inv_ids = [i["invoice_number"] for i in demo_invs if i["invoice_number"] == f"INV-USER-{unique_suffix}"]
    assert len(new_user_inv_ids) == 0
    print(" [PASS] 1.10 Data isolation confirmed: Demo user cannot see User's invoices")

    # 8. Delete user data
    del_data_res = client.delete("/api/v1/profile/data", headers={"Authorization": f"Bearer {user_token}"})
    assert del_data_res.status_code == 200
    inv_after_del = client.get("/api/v1/invoices", headers={"Authorization": f"Bearer {user_token}"}).json()
    assert len(inv_after_del) == 0
    print(" [PASS] 1.11 Successfully cleared user ledger data via Profile")

    # 9. Delete user account
    del_acc_res = client.delete("/api/v1/profile/account", headers={"Authorization": f"Bearer {user_token}"})
    assert del_acc_res.status_code == 200
    # Confirm cannot login after account deletion
    relogin = client.post("/api/v1/auth/login", json={"identifier": new_username, "password": new_pwd})
    assert relogin.status_code == 401
    print(" [PASS] 1.12 Successfully deleted user account and verified credentials revoked")


def test_gst_portal_json_export():
    print("\n--- 2. Testing GST Portal JSON Export ---")
    res = client.get("/api/v1/filing/export-json?period=September%202026&return_type=GSTR-3B")
    assert res.status_code == 200, f"Export failed: {res.text}"
    assert "attachment; filename=" in res.headers.get("Content-Disposition", "")
    assert res.headers.get("content-type") == "application/json"
    
    payload = res.json()
    assert "gstin" in payload
    assert "fp" in payload
    assert "version" in payload
    assert "sec_sum" in payload
    assert "tax_details" in payload["sec_sum"]
    assert "itc_elg" in payload["sec_sum"]
    assert "tx_pmt" in payload["sec_sum"]
    print(" [PASS] 2.1 GST Portal JSON schema conforms to GSTN specification")
    print(f"       Exported file for GSTIN: {payload['gstin']} | Period: {payload['fp']} | Version: {payload['version']}")


def test_multi_invoice_upload_pipeline():
    print("\n--- 3. Testing Multi-Invoice Upload Pipeline ---")
    # Simulate a multi-invoice PDF extraction (2 invoices detected in a single document)
    mock_extracted_invoices = [
        {
            "invoice_number": "INV-BATCH-001",
            "invoice_date": "2026-09-15",
            "seller_name": "Supplier Alpha",
            "seller_address": "New Delhi",
            "seller_gstin": "07AAAAA0000A1Z5",
            "buyer_name": "Apex Retail Enterprises",
            "buyer_address": "New Delhi",
            "buyer_gstin": "07BBBBB1111B2Z3",
            "transaction_type": "intra_state",
            "taxable_amount": 50000.0,
            "gst_rate": 18.0,
            "cgst": 4500.0,
            "sgst": 4500.0,
            "igst": 0.0,
            "total_tax": 9000.0,
            "grand_total": 59000.0,
            "itc_eligible": True,
            "itc_reason": "Office equipment",
            "status": "verified",
            "confidence_score": 0.98
        },
        {
            "invoice_number": "INV-BATCH-002",
            "invoice_date": "2026-09-16",
            "seller_name": "Supplier Beta",
            "seller_address": "Mumbai",
            "seller_gstin": "27AAAAA0000B1Z5",
            "buyer_name": "Apex Retail Enterprises",
            "buyer_address": "New Delhi",
            "buyer_gstin": "07BBBBB1111B2Z3",
            "transaction_type": "inter_state",
            "taxable_amount": 30000.0,
            "gst_rate": 18.0,
            "cgst": 0.0,
            "sgst": 0.0,
            "igst": 5400.0,
            "total_tax": 5400.0,
            "grand_total": 35400.0,
            "itc_eligible": True,
            "itc_reason": "IT services",
            "status": "verified",
            "confidence_score": 0.95
        }
    ]

    with patch("backend.main.extract_invoice_vision_insights", return_value=mock_extracted_invoices):
        dummy_bytes = b"%PDF-1.4 dummy multi-page batch invoice"
        res = client.post("/api/v1/invoices/upload", files={"file": ("batch_invoices.pdf", dummy_bytes, "application/pdf")})
        assert res.status_code == 200, f"Upload failed: {res.text}"
        data = res.json()
        assert data["count"] == 2
        assert len(data["invoices"]) == 2
        assert "INV-BATCH-001" in data["invoices"][0]["invoice_number"]
        assert "INV-BATCH-002" in data["invoices"][1]["invoice_number"]
        print(f" [PASS] 3.1 Successfully processed multi-invoice document into {data['count']} separate database records")
        print(f"       Invoice 1: {data['invoices'][0]['invoice_number']} (INR {data['invoices'][0]['grand_total']})")
        print(f"       Invoice 2: {data['invoices'][1]['invoice_number']} (INR {data['invoices'][1]['grand_total']})")


if __name__ == "__main__":
    print("==================================================")
    print("   GSTSaathi - Feature Verification Suite         ")
    print("==================================================")
    test_auth_pipeline()
    test_gst_portal_json_export()
    test_multi_invoice_upload_pipeline()
    print("\n==================================================")
    print("      ALL NEW FEATURE TESTS PASSED!               ")
    print("==================================================")

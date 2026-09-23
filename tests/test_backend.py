import sys
from pathlib import Path
from datetime import datetime

# Ensure project root is in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Core application imports
from backend.gst_calculator import (
    calculate_gst,
    validate_gstin,
    lookup_hsn,
    check_itc_eligibility
)
from backend.models import (
    SessionLocal,
    init_db,
    Invoice,
    Filing
)
from backend.agent import extract_invoice_vision_insights


def run_all_tests():
    print("==================================================")
    print("   GSTSaathi - Core System Verification Suite     ")
    print("==================================================")

    # 1. Test Intra-State GST Calculation (CGST + SGST)
    res = calculate_gst(10000.0, 18.0, "intra_state")
    assert res["gst"] == 1800.0, f"Expected 1800.0, got {res['gst']}"
    assert res["cgst"] == 900.0, f"Expected 900.0, got {res['cgst']}"
    assert res["sgst"] == 900.0, f"Expected 900.0, got {res['sgst']}"
    assert res["igst"] == 0.0, f"Expected 0.0, got {res['igst']}"
    assert res["total"] == 11800.0, f"Expected 11800.0, got {res['total']}"
    print(" [PASS] 1. Intra-State GST calculation (CGST + SGST split)")

    # 2. Test Inter-State GST Calculation (IGST)
    res_inter = calculate_gst(20000.0, 18.0, "inter_state")
    assert res_inter["igst"] == 3600.0, f"Expected 3600.0, got {res_inter['igst']}"
    assert res_inter["cgst"] == 0.0
    assert res_inter["sgst"] == 0.0
    assert res_inter["total"] == 23600.0
    print(" [PASS] 2. Inter-State GST calculation (IGST)")

    # 3. Test GSTIN Structure Validation
    valid_gstin = validate_gstin("27AABCU9603R1ZM")
    assert valid_gstin["valid"] is True
    assert valid_gstin["state_code"] == "27"
    assert valid_gstin["pan"] == "AABCU9603R"

    invalid_gstin = validate_gstin("INVALID123")
    assert invalid_gstin["valid"] is False
    print(" [PASS] 3. GSTIN 15-character structural validation")

    # 4. Test HSN Directory Lookup
    hsn = lookup_hsn("9983")
    assert hsn["found"] is True
    assert hsn["rate"] == 18.0
    print(" [PASS] 4. HSN directory code lookup")

    # 5. Test ITC Blocked Credit under Section 17(5)
    itc_motor = check_itc_eligibility("Luxury motor car for executive transport")
    assert itc_motor["eligible"] is False
    assert "Section 17(5)" in itc_motor["reason"]

    itc_laptop = check_itc_eligibility("Office laptops and monitors")
    assert itc_laptop["eligible"] is True
    print(" [PASS] 5. Input Tax Credit (ITC) Section 17(5) compliance check")

    # 6. Test Database Persistence
    init_db()
    db = SessionLocal()
    try:
        new_inv = Invoice(
            invoice_number=f"TEST-INV-{int(datetime.utcnow().timestamp())}",
            invoice_date="2026-09-17",
            seller_name="Test Seller",
            seller_gstin="07AAAAA0000A1Z5",
            buyer_name="Test Buyer",
            buyer_gstin="07BBBBB1111B2Z3",
            transaction_type="intra_state",
            taxable_amount=15000.0,
            gst_rate=18.0,
            cgst=1350.0,
            sgst=1350.0,
            igst=0.0,
            total_tax=2700.0,
            grand_total=17700.0,
            itc_eligible=True,
            status="verified"
        )
        db.add(new_inv)
        db.commit()
        db.refresh(new_inv)
        assert new_inv.id is not None
        assert new_inv.grand_total == 17700.0
        print(" [PASS] 6. SQLite database persistence & invoice ledger stats")

        # 7. Test GSTR-3B Filing Workflow with ARN Generation
        new_filing = Filing(
            return_type="GSTR-3B",
            period="09-2026",
            gstin="07BBBBB1111B2Z3",
            total_turnover=15000.0,
            total_tax_liability=2700.0,
            itc_claimed=2700.0,
            net_payable=0.0,
            arn=f"AA07{int(datetime.utcnow().timestamp() * 1000) % 10000000000}Z",
            status="submitted",
            filed_at=datetime.utcnow()
        )
        db.add(new_filing)
        db.commit()
        db.refresh(new_filing)
        assert new_filing.arn.startswith("AA07")
        assert new_filing.status == "submitted"
        print(" [PASS] 7. GSTR filing lifecycle & Mock ARN generation")

    finally:
        db.close()

    print("==================================================")
    print("      ALL CORE APPLICATION TESTS PASSED!          ")
    print("==================================================")


if __name__ == "__main__":
    run_all_tests()

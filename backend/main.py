"""
GSTSaathi - Enterprise Tax Compliance API

Primary application server integrating:
- backend/models.py (Database, ORM Entities, and Pydantic Schemas)
- backend/gst_calculator.py (Statutory Indian Tax Computation Engine)
- backend/agent.py (Azure AI Foundry Multi-Tool Agent Services)
"""

import sys
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Dict, Any

# Ensure project root is in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from dotenv import load_dotenv
load_dotenv(ROOT_DIR / ".env")

import json
import os
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Response, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

# Direct imports strictly from the 3 core architecture modules
from backend.models import (
    Base,
    engine,
    init_db,
    get_db,
    DEFAULT_DEMO_GSTIN,
    DEMO_USER,
    log_audit,
    User,
    Invoice,
    Filing,
    AuditLog,
    InvoiceCreate,
    InvoiceResponse,
    InvoiceStatusUpdate,
    GSTCalculationRequest,
    GSTCalculationResponse,
    GSTINValidationRequest,
    GSTINValidationResponse,
    HSNLookupRequest,
    HSNLookupResponse,
    ITCCheckRequest,
    ITCCheckResponse,
    FilingDraftCreate,
    FilingSubmitRequest,
    MockFilingRequest,
    GSTR3BSummaryRequest,
    AgentQueryRequest,
    RAGRequest,
    LoginRequest,
    SignupRequest,
    ProfileUpdateRequest,
    ProfileResponse,
    UserResponse,
    LoginResponse
)
from backend.gst_calculator import (
    calculate_gst,
    validate_gstin,
    lookup_hsn,
    check_itc_eligibility,
    resolve_period,
    compute_gstr3b_summary,
    generate_arn,
)
from backend.agent import (
    run_agent,
    run_rag_grounding,
    extract_invoice_vision_insights
)

# Initialize database schema and demo records
init_db()

app = FastAPI(
    title="GSTSaathi - Enterprise AI Tax Platform",
    description="Intelligent GST compliance, automated reconciliation, and statutory advisory platform.",
    version="1.0.0"
)

allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173")
allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==============================================================================
# 1. ROOT & HEALTH
# ==============================================================================

@app.get("/")
def root():
    return {
        "message": "GSTSaathi Enterprise API is online",
        "status": "operational",
        "platform": "GSTSaathi - Your AI Companion for GST",
        "version": "1.0.0",
        "docs_url": "/docs"
    }


# ==============================================================================
# 2. AUTHENTICATION & ACCESS CONTROL
# ==============================================================================

def get_current_user_from_header(
    authorization: Optional[str] = Header(None),
    x_auth_token: Optional[str] = Header(None, alias="X-Auth-Token"),
    db: Session = Depends(get_db)
) -> User:
    """Extracts and verifies current user from Authorization or X-Auth-Token header."""
    token = authorization or x_auth_token
    if token and token.startswith("Bearer "):
        token = token.split(" ", 1)[1].strip()

    if token and token.startswith("gstsaathi_token_"):
        parts = token.split("_")
        if len(parts) >= 3 and parts[2].isdigit():
            user_id = int(parts[2])
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                return user

    # Backward compatibility fallback to default demo user
    user = db.query(User).filter(User.email == "taxpayer@gstsaathi.in").first()
    if not user:
        user = db.query(User).first()
    return user


@app.post("/api/v1/auth/signup", response_model=LoginResponse)
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    import hashlib
    clean_username = req.username.strip().lower()
    clean_email = req.email.strip().lower()
    clean_pwd = req.password.strip()

    if not clean_username or not clean_email or not clean_pwd:
        raise HTTPException(status_code=400, detail="Username, Email, and Password are required.")

    if len(clean_username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters.")

    # Check if email already registered
    if db.query(User).filter(User.email == clean_email).first():
        raise HTTPException(status_code=400, detail="An account with this email address already exists.")

    # Check if username already registered
    if db.query(User).filter(User.username == clean_username).first():
        raise HTTPException(status_code=400, detail="An account with this username already exists.")

    # Optional GSTIN validation if provided
    clean_gstin = req.gstin.strip().upper() if req.gstin else None
    if clean_gstin:
        gstin_val = validate_gstin(clean_gstin)
        if not gstin_val["valid"]:
            raise HTTPException(status_code=400, detail=f"Invalid GSTIN: {gstin_val['message']}")
        if db.query(User).filter(User.gstin == clean_gstin).first():
            raise HTTPException(status_code=400, detail="An account with this GSTIN already exists.")

    display_name = req.name.strip() if req.name else clean_username
    pwd_hash = hashlib.sha256(clean_pwd.encode("utf-8")).hexdigest()

    user = User(
        username=clean_username,
        name=display_name,
        gstin=clean_gstin,
        email=clean_email,
        role="taxpayer",
        password_hash=pwd_hash
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    timestamp_str = datetime.utcnow().strftime("%y%m%d%H%M%S")
    token = f"gstsaathi_token_{user.id}_{timestamp_str}"

    log_audit(
        db=db,
        action="USER_SIGNUP",
        user_id=user.email,
        details=f"New user '{user.username}' registered successfully.",
        reference_id=str(user.id),
        agent="auth_service"
    )

    return {
        "message": "Account created successfully",
        "token": token,
        "user": user
    }


@app.post("/api/v1/auth/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    import hashlib
    identifier = req.get_identifier().lower()
    clean_pwd = req.password.strip()
    pwd_hash = hashlib.sha256(clean_pwd.encode("utf-8")).hexdigest()

    user = db.query(User).filter(
        (User.email == identifier) | (User.username == identifier)
    ).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username/email or password")

    if user.password_hash and user.password_hash != pwd_hash and user.password_hash != clean_pwd:
        raise HTTPException(status_code=401, detail="Invalid username/email or password")

    timestamp_str = datetime.utcnow().strftime("%y%m%d%H%M%S")
    token = f"gstsaathi_token_{user.id}_{timestamp_str}"

    log_audit(
        db=db,
        action="USER_LOGIN",
        user_id=user.email,
        details=f"User '{user.username or user.name}' signed in successfully.",
        reference_id=str(user.id),
        agent="auth_service"
    )

    return {
        "message": "Login successful",
        "token": token,
        "user": user
    }


@app.post("/api/v1/auth/logout")
def logout(
    current_user: User = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    user_identifier = current_user.email if current_user else "taxpayer"
    log_audit(
        db=db,
        action="USER_LOGOUT",
        user_id=user_identifier,
        details=f"User '{user_identifier}' logged out.",
        reference_id="session_ended",
        agent="auth_service"
    )
    return {"message": "Logged out successfully"}


@app.get("/api/v1/auth/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user_from_header)):
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    return current_user


# ==============================================================================
# 2.1 USER PROFILE MANAGEMENT & DATA DELETION
# ==============================================================================

@app.get("/api/v1/profile", response_model=ProfileResponse)
def get_profile(current_user: User = Depends(get_current_user_from_header), db: Session = Depends(get_db)):
    invoices = db.query(Invoice).filter(Invoice.user_id == current_user.id).all()
    total_taxable = sum(i.taxable_amount for i in invoices)
    total_tax = sum(i.total_tax for i in invoices)
    return {
        "user": current_user,
        "total_invoices": len(invoices),
        "total_taxable_amount": round(total_taxable, 2),
        "total_tax_liability": round(total_tax, 2)
    }


@app.put("/api/v1/profile", response_model=UserResponse)
def update_profile(req: ProfileUpdateRequest, current_user: User = Depends(get_current_user_from_header), db: Session = Depends(get_db)):
    if req.name is not None:
        current_user.name = req.name.strip()
    if req.gstin is not None:
        clean_gstin = req.gstin.strip().upper()
        if clean_gstin:
            gstin_val = validate_gstin(clean_gstin)
            if not gstin_val["valid"]:
                raise HTTPException(status_code=400, detail=f"Invalid GSTIN: {gstin_val['message']}")
            existing = db.query(User).filter(User.gstin == clean_gstin, User.id != current_user.id).first()
            if existing:
                raise HTTPException(status_code=400, detail="This GSTIN is already registered to another account.")
            current_user.gstin = clean_gstin
        else:
            current_user.gstin = None

    db.commit()
    db.refresh(current_user)

    log_audit(
        db=db,
        action="PROFILE_UPDATED",
        user_id=current_user.email,
        details=f"User '{current_user.username}' updated profile. GSTIN: {current_user.gstin or 'None'}",
        reference_id=str(current_user.id),
        agent="profile_service"
    )

    return current_user


@app.delete("/api/v1/profile/data")
def delete_user_data(current_user: User = Depends(get_current_user_from_header), db: Session = Depends(get_db)):
    """Deletes all ledger invoices and filings belonging to the current user."""
    deleted_invoices = db.query(Invoice).filter(Invoice.user_id == current_user.id).delete()
    deleted_filings = db.query(Filing).filter(Filing.user_id == current_user.id).delete()
    db.commit()

    log_audit(
        db=db,
        action="USER_DATA_CLEARED",
        user_id=current_user.email,
        details=f"User '{current_user.username}' cleared ledger data ({deleted_invoices} invoices, {deleted_filings} filings deleted).",
        reference_id=str(current_user.id),
        agent="profile_service"
    )

    return {
        "message": f"Successfully deleted {deleted_invoices} invoice(s) and {deleted_filings} filing(s).",
        "invoices_deleted": deleted_invoices,
        "filings_deleted": deleted_filings
    }


@app.delete("/api/v1/profile/account")
def delete_user_account(current_user: User = Depends(get_current_user_from_header), db: Session = Depends(get_db)):
    """Permanently deletes the user account and all associated data."""
    # Delete invoices & filings
    db.query(Invoice).filter(Invoice.user_id == current_user.id).delete()
    db.query(Filing).filter(Filing.user_id == current_user.id).delete()
    # Delete user record
    db.delete(current_user)
    db.commit()

    return {"message": "Account and all associated data deleted successfully."}


# ==============================================================================
# 3. INVOICE INGESTION & LEDGER ENDPOINTS
# ==============================================================================

@app.get("/api/v1/invoices", response_model=List[InvoiceResponse])
def list_invoices(current_user: User = Depends(get_current_user_from_header), db: Session = Depends(get_db)):
    return db.query(Invoice).filter(Invoice.user_id == current_user.id).order_by(Invoice.id.desc()).all()


@app.get("/api/v1/invoices/stats")
def get_invoice_stats(current_user: User = Depends(get_current_user_from_header), db: Session = Depends(get_db)):
    invoices = db.query(Invoice).filter(Invoice.user_id == current_user.id).all()
    total_sales = sum(i.taxable_amount for i in invoices)
    total_tax = sum(i.total_tax for i in invoices)
    processed = sum(1 for i in invoices if i.status in ["verified", "filed"])
    pending = sum(1 for i in invoices if i.status == "pending_review")

    return {
        "total_invoices": len(invoices),
        "processed": processed,
        "pending_review": pending,
        "total_sales": round(total_sales, 2),
        "total_tax": round(total_tax, 2)
    }


@app.post("/api/v1/invoices/create", response_model=InvoiceResponse)
def create_invoice_record(invoice_data: InvoiceCreate, current_user: User = Depends(get_current_user_from_header), db: Session = Depends(get_db)):
    calc = calculate_gst(
        taxable_amount=invoice_data.taxable_amount,
        gst_rate=invoice_data.gst_rate,
        transaction_type=invoice_data.transaction_type,
        cess=invoice_data.cess
    )

    new_inv = Invoice(
        user_id=current_user.id,
        invoice_number=invoice_data.invoice_number,
        invoice_date=invoice_data.invoice_date,
        seller_name=invoice_data.seller_name,
        seller_gstin=invoice_data.seller_gstin.upper(),
        buyer_name=invoice_data.buyer_name,
        buyer_gstin=invoice_data.buyer_gstin.upper(),
        transaction_type=invoice_data.transaction_type,
        taxable_amount=calc["taxable_amount"],
        gst_rate=calc["gst_rate"],
        cgst=calc["cgst"],
        sgst=calc["sgst"],
        igst=calc["igst"],
        total_tax=calc["gst"] + calc["cess"],
        grand_total=calc["total"],
        itc_eligible=invoice_data.itc_eligible if invoice_data.itc_eligible is not None else True,
        itc_reason=invoice_data.itc_reason or "Eligible business input",
        status=invoice_data.status or "verified"
    )
    db.add(new_inv)
    db.commit()
    db.refresh(new_inv)

    # Audit log
    log_audit(
        db=db,
        action="INVOICE_CREATED",
        user_id=current_user.email,
        details=f"Created invoice {new_inv.invoice_number} for ₹{new_inv.grand_total:,.2f}",
        reference_id=new_inv.invoice_number,
        agent="gst_ledger"
    )

    return new_inv


@app.post("/api/v1/invoices/upload")
async def upload_invoice_file(
    files: Optional[List[UploadFile]] = File(None),
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Module 4: Ingests single or multiple PDF/image invoice documents, extracts metadata via vision OCR, and saves all to ledger."""
    upload_files = files or ([file] if file else [])
    if not upload_files:
        raise HTTPException(status_code=400, detail="No invoice file provided.")

    saved_invoices = []
    all_extracted_metadata = []

    try:
        for f in upload_files:
            file_bytes = await f.read()
            if not file_bytes:
                continue

            try:
                extracted_list = extract_invoice_vision_insights(f.filename, file_bytes)
            except Exception as extract_err:
                print(f"Error extracting {f.filename}: {extract_err}")
                continue

            all_extracted_metadata.extend(extracted_list)

            for doc_idx, extracted in enumerate(extracted_list):
                # Generate unique invoice number fallback if missing or duplicate
                raw_inv_num = (extracted.get("invoice_number") or "").strip()
                if not raw_inv_num:
                    raw_inv_num = f"INV-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{len(saved_invoices)+1}"

                existing = db.query(Invoice).filter(Invoice.invoice_number == raw_inv_num).first()
                if existing:
                    raw_inv_num = f"{raw_inv_num}_{int(datetime.utcnow().timestamp())}_{len(saved_invoices)+1}"

                # Safe defaults for mandatory database columns
                inv_date = extracted.get("invoice_date") or datetime.utcnow().strftime("%Y-%m-%d")
                seller_name = extracted.get("seller_name") or "Vendor / Supplier"
                seller_gstin = extracted.get("seller_gstin") or (current_user.gstin if current_user.gstin else "")
                buyer_name = extracted.get("buyer_name") or current_user.name or DEMO_USER["name"]
                buyer_gstin = extracted.get("buyer_gstin") or current_user.gstin or DEFAULT_DEMO_GSTIN

                # Reconcile tax amounts and transaction type
                total_tax = round(extracted.get("total_tax", 0.0), 2)
                taxable_amount = round(extracted.get("taxable_amount", 0.0), 2)
                grand_total = round(extracted.get("grand_total", 0.0), 2)

                is_inter = (
                    len(seller_gstin) >= 2 and len(buyer_gstin) >= 2 and
                    seller_gstin[:2] != buyer_gstin[:2]
                )
                transaction_type = "inter_state" if is_inter else "intra_state"

                if transaction_type == "inter_state":
                    cgst, sgst, igst = 0.0, 0.0, total_tax
                else:
                    cgst, sgst, igst = round(total_tax / 2.0, 2), round(total_tax / 2.0, 2), 0.0

                # Save to database
                inv = Invoice(
                    user_id=current_user.id,
                    invoice_number=raw_inv_num,
                    invoice_date=inv_date,
                    seller_name=seller_name,
                    seller_gstin=seller_gstin,
                    buyer_name=buyer_name,
                    buyer_gstin=buyer_gstin,
                    transaction_type=transaction_type,
                    taxable_amount=taxable_amount,
                    gst_rate=extracted.get("gst_rate", 18.0 if grand_total > 0 else 0.0),
                    cgst=cgst,
                    sgst=sgst,
                    igst=igst,
                    total_tax=total_tax,
                    grand_total=grand_total,
                    itc_eligible=extracted.get("itc_eligible", True),
                    itc_reason=extracted.get("itc_reason") or "Extracted via Azure Document Intelligence",
                    status=extracted.get("status", "verified" if grand_total > 0 else "pending_review")
                )
                db.add(inv)
                db.commit()
                db.refresh(inv)

                # Audit log
                log_audit(
                    db=db,
                    action="DOCUMENT_INTELLIGENCE_OCR",
                    user_id=current_user.email,
                    details=f"Processed invoice {f.filename} (Doc {doc_idx+1}/{len(extracted_list)}) -> {inv.invoice_number} (Confidence: {extracted.get('confidence_score', 1.0)})",
                    reference_id=inv.invoice_number,
                    agent="gst-document-ocr-agent"
                )

                saved_invoices.append({
                    "id": inv.id,
                    "invoice_number": inv.invoice_number,
                    "invoice_date": inv.invoice_date,
                    "seller_name": inv.seller_name,
                    "seller_gstin": inv.seller_gstin,
                    "buyer_name": inv.buyer_name,
                    "buyer_gstin": inv.buyer_gstin,
                    "taxable_amount": inv.taxable_amount,
                    "grand_total": inv.grand_total,
                    "total_amount": inv.grand_total,
                    "total_tax": inv.total_tax,
                    "status": inv.status
                })

        if not saved_invoices:
            raise HTTPException(status_code=400, detail="Unable to extract valid invoice data from uploaded file(s).")

        first_inv = saved_invoices[0]
        return {
            "message": f"Successfully ingested {len(saved_invoices)} invoice(s) via Document Intelligence OCR",
            "count": len(saved_invoices),
            "invoices": saved_invoices,
            "invoice_number": first_inv["invoice_number"],
            "seller_name": first_inv["seller_name"],
            "seller_gstin": first_inv["seller_gstin"],
            "buyer_name": first_inv["buyer_name"],
            "buyer_gstin": first_inv["buyer_gstin"],
            "taxable_amount": first_inv["taxable_amount"],
            "total_amount": first_inv["grand_total"],
            "grand_total": first_inv["grand_total"],
            "total_tax": first_inv["total_tax"],
            "status": first_inv["status"],
            "invoice": first_inv,
            "extraction_metadata": all_extracted_metadata[0] if all_extracted_metadata else {}
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@app.patch("/api/v1/invoices/{invoice_id}/status")
def update_invoice_status(
    invoice_id: int,
    update: InvoiceStatusUpdate,
    current_user: User = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Human-in-the-loop review override before return filing."""
    inv = db.query(Invoice).filter(Invoice.id == invoice_id, Invoice.user_id == current_user.id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    old_status = inv.status
    inv.status = update.status
    db.commit()

    log_audit(
        db=db,
        action="HUMAN_STATUS_OVERRIDE",
        user_id=current_user.email,
        details=f"Invoice #{inv.invoice_number} status updated from {old_status} to {update.status}",
        reference_id=inv.invoice_number,
        agent="human_review"
    )

    return {"message": "Status updated successfully", "id": inv.id, "status": inv.status}


@app.delete("/api/v1/invoices/{invoice_id}")
def delete_invoice(
    invoice_id: int,
    current_user: User = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Deletes an invoice from the ledger belonging to the current user."""
    inv = db.query(Invoice).filter(Invoice.id == invoice_id, Invoice.user_id == current_user.id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    inv_num = inv.invoice_number
    db.delete(inv)
    db.commit()

    log_audit(
        db=db,
        action="INVOICE_DELETE",
        user_id=current_user.email,
        details=f"Invoice #{inv_num} deleted from ledger",
        reference_id=inv_num,
        agent="ledger_management"
    )

    return {"message": f"Invoice {invoice_id} deleted successfully"}


# ==============================================================================
# 3. STATUTORY TAX CALCULATION & HSN DIRECTORY
# ==============================================================================

@app.post("/api/v1/gst/calculate", response_model=GSTCalculationResponse)
def api_calculate_gst(req: GSTCalculationRequest):
    return calculate_gst(
        taxable_amount=req.taxable_amount,
        gst_rate=req.gst_rate,
        transaction_type=req.transaction_type,
        cess=req.cess
    )


@app.post("/api/v1/gst/validate-gstin", response_model=GSTINValidationResponse)
def api_validate_gstin(req: GSTINValidationRequest):
    return validate_gstin(req.gstin)


@app.post("/api/v1/gst/lookup-hsn", response_model=HSNLookupResponse)
def api_lookup_hsn(req: HSNLookupRequest):
    return lookup_hsn(req.hsn_code)


@app.get("/api/v1/gst/hsn/lookup", response_model=HSNLookupResponse)
def api_lookup_hsn_get(hsn_code: str):
    """HSN lookup query parameter endpoint for frontend compatibility."""
    return lookup_hsn(hsn_code)


@app.post("/api/v1/gst/check-itc", response_model=ITCCheckResponse)
def api_check_itc(req: ITCCheckRequest):
    return check_itc_eligibility(req.description)


# ==============================================================================
# 4. AZURE AI FOUNDRY AGENT SERVICE (MODULE 2)
# ==============================================================================

@app.post("/api/v1/copilot/query")
def api_agent_query(
    req: AgentQueryRequest,
    current_user: User = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """Autonomous Azure AI Foundry Agent execution with 5 Function Tools."""
    query_text = req.get_query()
    res = run_agent(
        user_query=query_text,
        db=db,
        current_user_id=current_user.id,
        thread_id=req.thread_id,
        conversation_history=req.conversation_history
    )

    # Record AI Copilot execution in audit log
    log_audit(
        db=db,
        action="TAX_COPILOT_QUERY",
        user_id=current_user.email,
        details=f"Inquiry: '{query_text[:100]}' | Status: {res.get('status')}",
        reference_id=res.get("thread_id") or "copilot_query",
        agent="gst-tax-compliance-agent",
        status="success" if res.get("status") == "success" else "error"
    )

    return res


@app.get("/api/v1/copilot/audit-logs")
def api_audit_logs(
    current_user: User = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    logs = db.query(AuditLog).filter(
        AuditLog.user_id == current_user.email
    ).order_by(AuditLog.id.desc()).limit(100).all()
    return [
        {
            "id": l.id,
            "timestamp": l.timestamp.strftime("%Y-%m-%d %H:%M:%S") if l.timestamp else "",
            "event_type": l.action,
            "action": l.action,
            "description": l.details,
            "details": l.details,
            "reference_id": l.reference_id or "-",
            "agent": l.agent or "system",
            "status": l.status or "success",
            "user_id": l.user_id or "system"
        }
        for l in logs
    ]


# ==============================================================================
# 5. GSTR RETURN FILING & RECONCILIATION
# ==============================================================================

@app.post("/api/v1/filing/generate-summary")
def generate_gstr3b_summary(req: GSTR3BSummaryRequest, current_user: User = Depends(get_current_user_from_header), db: Session = Depends(get_db)):
    """
    Requirement:
    1. Fetch invoices belonging to the selected period from SQLite ledger.
    2. Calculate summary: included invoices, gross taxable turnover, CGST, SGST, IGST, total tax payable, eligible ITC, blocked ITC.
    3. Run validation checks: invoice reconciliation, GSTIN validation, ITC validation, tax calculation.
    4. Save generated summary in SQLite database (filings table) with status 'ready_for_filing' (no fake ARN).
    5. Return calculated summary to frontend.
    """
    all_invoices = db.query(Invoice).filter(Invoice.user_id == current_user.id).all()

    # Match invoices by period (e.g. "September 2026", "09-2026", "2026-09")
    year, month = resolve_period(req.period)
    if year and month:
        target_prefix = f"{year}-{month}"
        period_invoices = [i for i in all_invoices if i.invoice_date and target_prefix in i.invoice_date]
        if not period_invoices and "2026" in year:
            period_invoices = all_invoices
    else:
        period_invoices = all_invoices

    # Dynamically resolve taxpayer GSTIN
    taxpayer_gstin = req.gstin or current_user.gstin
    if not taxpayer_gstin:
        if period_invoices and period_invoices[0].buyer_gstin and not period_invoices[0].buyer_gstin.startswith("00UNKNOWN"):
            taxpayer_gstin = period_invoices[0].buyer_gstin
        elif period_invoices and period_invoices[0].seller_gstin and not period_invoices[0].seller_gstin.startswith("00UNKNOWN"):
            taxpayer_gstin = period_invoices[0].seller_gstin
        else:
            taxpayer_gstin = DEFAULT_DEMO_GSTIN

    # Calculate return summary and validations from actual invoice data
    calc = compute_gstr3b_summary(period_invoices, taxpayer_gstin=taxpayer_gstin)
    included_count = calc["included_invoices"]
    gross_taxable_turnover = calc["gross_taxable_turnover"]
    cgst = calc["cgst"]
    sgst = calc["sgst"]
    igst = calc["igst"]
    total_tax_payable = calc["total_tax_payable"]
    eligible_itc = calc["eligible_itc"]
    blocked_itc = calc["blocked_itc"]
    net_payable = calc["net_payable"]
    validations = calc["validations"]
    reconciled = validations["invoice_reconciliation"]
    gstin_valid = validations["gstin_validation"]
    itc_valid = validations["itc_validation"]
    tax_valid = validations["tax_calculation"]

    # 4. Invoke gst-tax-compliance-agent (Azure AI Foundry gpt-5-mini) only when explicitly requested
    ai_summary_text = None
    agent_thought = None

    if req.generate_ai:
        ai_agent_prompt = (
            f"You are the gst-tax-compliance-agent for GSTSaathi. "
            f"Generate an authoritative GSTR-3B Return Compliance and Reconciliation Summary for return period '{req.period}'.\n\n"
            f"LEDGER & STATUTORY CALCULATION DATA (Source of Truth: SQLite Ledger):\n"
            f"- Invoices Included: {included_count}\n"
            f"- Gross Taxable Turnover: ₹{gross_taxable_turnover:,.2f}\n"
            f"- Outward Tax Liability: CGST: ₹{cgst:,.2f}, SGST: ₹{sgst:,.2f}, IGST: ₹{igst:,.2f} (Total: ₹{total_tax_payable:,.2f})\n"
            f"- Input Tax Credit (ITC): Eligible: ₹{eligible_itc:,.2f}, Blocked under Section 17(5): ₹{blocked_itc:,.2f}\n"
            f"- Net Tax Payable (Cash Ledger Requirement): ₹{net_payable:,.2f}\n\n"
            f"STATUTORY COMPLIANCE & RECONCILIATION AUDIT:\n"
            f"- Invoice Reconciliation: {'Passed (100% matched)' if reconciled else 'Discrepancy detected'}\n"
            f"- GSTIN Structural Validation: {'Passed (All vendor/buyer GSTINs conform to statutory 15-char regex)' if gstin_valid else 'Failed GSTINs found'}\n"
            f"- ITC Eligibility Check (Section 17(5)): {'Passed (Blocked categories correctly segregated)' if itc_valid else 'Issues detected'}\n"
            f"- Rate & Place-of-Supply Tax Split: {'Passed (Intra-state vs Inter-state correct)' if tax_valid else 'Mismatched tax rates'}\n\n"
            f"Please provide an executive GSTR-3B summary structured with:\n"
            f"1. Executive Filing Readiness Assessment (confirm if ready for submission on GST portal, without generating any fake ARN).\n"
            f"2. Tax Liability & Turnover Analysis (explain outward liability vs ITC offset).\n"
            f"3. Input Tax Credit (ITC) Compliance & Section 17(5) Observations (highlight eligible vs blocked credit).\n"
            f"4. Statutory Reconciliation Verdict (summarize the 4 audit checks and legal posture under CGST/SGST/IGST Acts)."
        )

        agent_response = run_agent(user_query=ai_agent_prompt, db=db, current_user_id=current_user.id)
        ai_summary_text = agent_response.get("answer") or agent_response.get("response") or "Summary generated successfully."
        agent_thought = agent_response.get("agent_thought")
    else:
        # Check if an earlier filing record already has an AI summary for this period
        existing_filing = db.query(Filing).filter(
            Filing.user_id == current_user.id,
            Filing.period == req.period,
            Filing.return_type == "GSTR-3B",
            Filing.ai_summary.isnot(None)
        ).order_by(Filing.id.desc()).first()
        if existing_filing:
            ai_summary_text = existing_filing.ai_summary
            agent_thought = None

    # 5. Save generated return summary in SQLite database (no fake ARN)
    filing = Filing(
        user_id=current_user.id,
        return_type="GSTR-3B",
        period=req.period,
        gstin=taxpayer_gstin,
        total_turnover=round(gross_taxable_turnover, 2),
        total_tax_liability=round(total_tax_payable, 2),
        itc_claimed=round(eligible_itc, 2),
        net_payable=round(net_payable, 2),
        arn=None,
        status="ready_for_filing",
        filed_at=None,
        ai_summary=ai_summary_text
    )
    db.add(filing)
    db.commit()
    db.refresh(filing)

    # Record in audit log
    audit_desc = f"Calculated GSTR-3B totals for {req.period}. Invoices: {included_count}, Turnover: ₹{gross_taxable_turnover:,.2f}, Tax: ₹{total_tax_payable:,.2f}"
    if req.generate_ai:
        audit_desc += " [AI Copilot Summary Generated via Azure AI Foundry]"
    log_audit(
        db=db,
        action="GSTR3B_SUMMARY_GENERATED",
        user_id=current_user.email,
        details=audit_desc
    )

    return {
        "period": req.period,
        "gstin": taxpayer_gstin,
        "included_invoices": included_count,
        "gross_taxable_turnover": round(gross_taxable_turnover, 2),
        "cgst": round(cgst, 2),
        "sgst": round(sgst, 2),
        "igst": round(igst, 2),
        "total_tax_payable": round(total_tax_payable, 2),
        "eligible_itc": round(eligible_itc, 2),
        "blocked_itc": round(blocked_itc, 2),
        "net_payable": round(net_payable, 2),
        "validations": {
            "invoice_reconciliation": reconciled,
            "gstin_validation": gstin_valid,
            "itc_validation": itc_valid,
            "tax_calculation": tax_valid
        },
        "ai_summary": ai_summary_text,
        "agent_thought": agent_thought,
        "status": "Ready for filing",
        "filing_id": filing.id
    }


@app.get("/api/v1/filing/export-json")
def export_gst_portal_json(period: str = "September 2026", return_type: str = "GSTR-3B", current_user: User = Depends(get_current_user_from_header), db: Session = Depends(get_db)):
    """
    Generates official GSTN-compliant JSON for direct upload to the GST Common Portal (gst.gov.in).
    Adheres to the official GSTN Schema for GSTR-3B offline tool.
    """
    taxpayer_gstin = current_user.gstin if current_user and current_user.gstin else DEFAULT_DEMO_GSTIN

    # Map period string to GSTN format (e.g. 'September 2026' -> '092026')
    year, month = resolve_period(period)
    if not year:
        year = "2026"
    if not month:
        month = "09"
    fp = f"{month}{year}"

    # Query invoices for period belonging to current user
    all_invoices = db.query(Invoice).filter(Invoice.user_id == current_user.id).all()
    target_prefix = f"{year}-{month}"
    period_invoices = [i for i in all_invoices if i.invoice_date and target_prefix in i.invoice_date]
    if not period_invoices and "2026" in year:
        period_invoices = all_invoices

    # Compute Table 3.1: Outward taxable supplies
    txval = sum(i.taxable_amount for i in period_invoices)
    iamt = sum(i.igst for i in period_invoices)
    camt = sum(i.cgst for i in period_invoices)
    samt = sum(i.sgst for i in period_invoices)
    csamt = 0.0

    # Compute Table 4: Eligible ITC
    itc_eligible_invoices = [i for i in period_invoices if i.itc_eligible]
    itc_blocked_invoices = [i for i in period_invoices if not i.itc_eligible]

    itc_iamt = sum(i.igst for i in itc_eligible_invoices)
    itc_camt = sum(i.cgst for i in itc_eligible_invoices)
    itc_samt = sum(i.sgst for i in itc_eligible_invoices)

    blocked_iamt = sum(i.igst for i in itc_blocked_invoices)
    blocked_camt = sum(i.cgst for i in itc_blocked_invoices)
    blocked_samt = sum(i.sgst for i in itc_blocked_invoices)

    # B2B invoice items list for offline audit reconciliation
    b2b_list = []
    for inv in period_invoices:
        b2b_list.append({
            "inum": inv.invoice_number,
            "idt": inv.invoice_date,
            "val": inv.grand_total,
            "pos": inv.buyer_gstin[:2] if inv.buyer_gstin and len(inv.buyer_gstin) >= 2 else "07",
            "rchrg": "N",
            "inv_typ": "R",
            "itms": [{
                "num": 1,
                "itm_det": {
                    "txval": inv.taxable_amount,
                    "rt": inv.gst_rate,
                    "iamt": inv.igst,
                    "camt": inv.cgst,
                    "samt": inv.sgst,
                    "csamt": 0.0
                }
            }]
        })

    # Standardized GSTN GSTR-3B Schema
    gstn_payload = {
        "gstin": taxpayer_gstin,
        "fp": fp,
        "version": "GSTR3B_v1.0",
        "hash": f"SHA256_{int(datetime.utcnow().timestamp())}",
        "sec_sum": {
            "sec_nm": "3.1",
            "tax_details": {
                "osup_det": {
                    "desc": "Outward taxable supplies (other than zero rated, nil rated and exempted)",
                    "txval": round(txval, 2),
                    "iamt": round(iamt, 2),
                    "camt": round(camt, 2),
                    "samt": round(samt, 2),
                    "csamt": round(csamt, 2)
                },
                "osup_zero": {"desc": "Outward taxable supplies (zero rated)", "txval": 0.0, "iamt": 0.0, "csamt": 0.0},
                "osup_nil_exmp": {"desc": "Other outward supplies (Nil rated, exempted)", "txval": 0.0},
                "isup_rev": {"desc": "Inward supplies (liable to reverse charge)", "txval": 0.0, "iamt": 0.0, "camt": 0.0, "samt": 0.0, "csamt": 0.0},
                "osup_nongst": {"desc": "Non-GST outward supplies", "txval": 0.0}
            },
            "itc_elg": {
                "itc_avl": [
                    {
                        "ty": "OTH",
                        "desc": "All other ITC",
                        "iamt": round(itc_iamt, 2),
                        "camt": round(itc_camt, 2),
                        "samt": round(itc_samt, 2),
                        "csamt": 0.0
                    }
                ],
                "itc_rev": [],
                "itc_net": {
                    "iamt": round(itc_iamt, 2),
                    "camt": round(itc_camt, 2),
                    "samt": round(itc_samt, 2),
                    "csamt": 0.0
                },
                "itc_inelg": [
                    {
                        "ty": "RUL",
                        "desc": "As per Section 17(5) (Blocked Credits)",
                        "iamt": round(blocked_iamt, 2),
                        "camt": round(blocked_camt, 2),
                        "samt": round(blocked_samt, 2),
                        "csamt": 0.0
                    }
                ]
            },
            "inward_sup": {
                "isup_details": [
                    {"ty": "GST", "inter": 0.0, "intra": 0.0}
                ]
            },
            "tx_pmt": {
                "tx_py": [
                    {"trans_typ": "1", "desc": "Integrated Tax (IGST)", "iamt": round(iamt, 2), "camt": 0.0, "samt": 0.0, "csamt": 0.0},
                    {"trans_typ": "2", "desc": "Central Tax (CGST)", "iamt": 0.0, "camt": round(camt, 2), "samt": 0.0, "csamt": 0.0},
                    {"trans_typ": "3", "desc": "State/UT Tax (SGST)", "iamt": 0.0, "camt": 0.0, "samt": round(samt, 2), "csamt": 0.0}
                ]
            }
        },
        "b2b": b2b_list
    }

    # Record export in audit trail
    log_audit(
        db=db,
        action="GST_PORTAL_JSON_EXPORT",
        user_id=current_user.email,
        details=f"Exported GST Portal JSON for period {fp} ({taxpayer_gstin}) with {len(period_invoices)} invoices",
        reference_id=f"GSTR3B_{fp}_{taxpayer_gstin}",
        agent="filing_service"
    )

    filename = f"GSTR3B_{fp}_{taxpayer_gstin}.json"
    return Response(
        content=json.dumps(gstn_payload, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.post("/api/v1/filing/draft")
def draft_gstr_filing(req: FilingDraftCreate, current_user: User = Depends(get_current_user_from_header), db: Session = Depends(get_db)):
    invoices = db.query(Invoice).filter(Invoice.user_id == current_user.id).all()
    turnover = sum(i.taxable_amount for i in invoices)
    tax_liability = sum(i.total_tax for i in invoices)
    itc_claimed = sum(i.total_tax for i in invoices if i.itc_eligible)
    net_payable = max(0.0, tax_liability - itc_claimed)

    filing = Filing(
        user_id=current_user.id,
        return_type=req.return_type,
        period=req.period,
        gstin=req.gstin or current_user.gstin or DEFAULT_DEMO_GSTIN,
        total_turnover=round(turnover, 2),
        total_tax_liability=round(tax_liability, 2),
        itc_claimed=round(itc_claimed, 2),
        net_payable=round(net_payable, 2),
        status="draft"
    )
    db.add(filing)
    db.commit()
    db.refresh(filing)

    return filing


@app.post("/api/v1/filing/submit")
def submit_gstr_filing(req: FilingSubmitRequest, current_user: User = Depends(get_current_user_from_header), db: Session = Depends(get_db)):
    filing = db.query(Filing).filter(Filing.id == req.filing_id, Filing.user_id == current_user.id).first()
    if not filing:
        raise HTTPException(status_code=404, detail="Filing draft not found")

    # Generate simulated official ARN
    arn = generate_arn()
    filing.arn = arn
    filing.status = "submitted"
    filing.filed_at = datetime.utcnow()
    db.commit()

    # Record in audit trail
    log_audit(
        db=db,
        action="GSTR_RETURN_FILED",
        user_id=current_user.email,
        details=f"Filed {filing.return_type} ({filing.period}) with ARN {arn}. Net Tax Paid: ₹{filing.net_payable:,.2f}",
        reference_id=arn,
        agent="filing_service",
        status="submitted"
    )

    return {
        "message": "GSTR Return successfully filed!",
        "arn": arn,
        "filing": filing
    }


@app.post("/api/v1/filings/mock-submit")
def mock_submit_filing(req: MockFilingRequest, current_user: User = Depends(get_current_user_from_header), db: Session = Depends(get_db)):
    """Frontend simulated GSTR-3B submission with official ARN receipt."""
    arn = generate_arn()
    submission_time = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

    taxpayer_gstin = current_user.gstin if current_user and current_user.gstin else DEFAULT_DEMO_GSTIN

    filing = Filing(
        user_id=current_user.id,
        return_type="GSTR-3B",
        period=req.period,
        gstin=taxpayer_gstin,
        total_turnover=req.total_sales,
        total_tax_liability=req.total_tax,
        itc_claimed=req.total_tax,
        net_payable=0.0,
        arn=arn,
        status="submitted",
        filed_at=datetime.utcnow()
    )
    db.add(filing)
    db.commit()

    log_audit(
        db=db,
        action="GSTR_RETURN_FILED",
        user_id=current_user.email,
        details=f"Filed GSTR-3B ({req.period}) with ARN {arn}. Turnover: ₹{req.total_sales:,.2f}",
        reference_id=arn,
        agent="filing_service",
        status="submitted"
    )

    return {
        "message": "GSTR Return successfully filed!",
        "arn": arn,
        "submission_time": submission_time,
        "status": "submitted"
    }


@app.get("/api/v1/filing/history")
def get_filing_history(current_user: User = Depends(get_current_user_from_header), db: Session = Depends(get_db)):
    return db.query(Filing).filter(Filing.user_id == current_user.id).order_by(Filing.id.desc()).all()


# ==============================================================================
# 6. STATUTORY LEGAL ADVISORY (RAG GROUNDING)
# ==============================================================================

@app.post("/api/v1/modules/rag/generate")
def api_rag_generate(
    req: RAGRequest,
    current_user: User = Depends(get_current_user_from_header),
    db: Session = Depends(get_db)
):
    """gst-rag-advisory-agent: Statutory legal retrieval & knowledge grounding via Foundry IQ / Azure AI Search."""
    result = run_rag_grounding(req.query)

    # Record legal inquiry in audit log
    log_audit(
        db=db,
        action="STATUTORY_RAG_ADVISORY",
        user_id=current_user.email,
        details=f"Query: '{req.query[:120]}' | Agent: gst-rag-advisory-agent | Citations: {len(result.get('grounding_sources_used', []))}",
        reference_id="CGST_Act_2017",
        agent="gst-rag-advisory-agent"
    )

    return result

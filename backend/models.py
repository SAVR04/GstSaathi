
"""
GSTSaathi - Data Models & Persistence Layer

Defines SQLite database tables, SQLAlchemy ORM entities,
and Pydantic validation schemas in a single consolidated module.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pathlib import Path
from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    Text,
    text,
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from pydantic import BaseModel

# Database path (stored in project root or backend)
DB_PATH = Path(__file__).resolve().parent.parent / "gst_copilot.db"
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# System constants
DEFAULT_DEMO_GSTIN = "07BBBBB1111B2Z3"

DEMO_USER = {
    "username": "taxpayer",
    "name": "Apex Retail Enterprises",
    "gstin": DEFAULT_DEMO_GSTIN,
    "email": "taxpayer@gstsaathi.in",
    "role": "taxpayer",
    "password": "gstsaathi2026"
}


def log_audit(
    db: Session,
    action: str,
    user_id: str,
    details: str,
    reference_id: Optional[str] = None,
    agent: Optional[str] = None,
    status: str = "success"
) -> "AuditLog":
    """Creates, persists, and commits an audit log entry in a single clean call."""
    audit = AuditLog(
        action=action,
        user_id=user_id,
        details=details,
        reference_id=reference_id,
        agent=agent,
        status=status
    )
    db.add(audit)
    db.commit()
    return audit


# ==============================================================================
# 1. SQLALCHEMY ORM MODELS
# ==============================================================================

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=True)
    name = Column(String(100), nullable=True)
    gstin = Column(String(15), index=True, nullable=True)
    email = Column(String(120), unique=True, nullable=False)
    role = Column(String(20), default="taxpayer")
    password_hash = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=True)
    invoice_number = Column(String(50), index=True, nullable=False)
    invoice_date = Column(String(20), nullable=False)
    seller_name = Column(String(100), nullable=False)
    seller_gstin = Column(String(15), nullable=False)
    buyer_name = Column(String(100), nullable=False)
    buyer_gstin = Column(String(15), nullable=False)
    transaction_type = Column(String(20), default="intra_state")  # intra_state / inter_state
    taxable_amount = Column(Float, nullable=False)
    gst_rate = Column(Float, nullable=False)
    cgst = Column(Float, default=0.0)
    sgst = Column(Float, default=0.0)
    igst = Column(Float, default=0.0)
    total_tax = Column(Float, default=0.0)
    grand_total = Column(Float, nullable=False)
    itc_eligible = Column(Boolean, default=True)
    itc_reason = Column(Text, default="Standard eligible business expense")
    status = Column(String(20), default="pending_review")  # pending_review / verified / filed
    created_at = Column(DateTime, default=datetime.utcnow)


class Filing(Base):
    __tablename__ = "filings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=True)
    return_type = Column(String(20), nullable=False)  # GSTR-1, GSTR-3B
    period = Column(String(20), nullable=False)       # e.g. 09-2026
    gstin = Column(String(15), nullable=False)
    total_turnover = Column(Float, default=0.0)
    total_tax_liability = Column(Float, default=0.0)
    itc_claimed = Column(Float, default=0.0)
    net_payable = Column(Float, default=0.0)
    arn = Column(String(50), unique=True, nullable=True)  # Application Reference Number
    status = Column(String(20), default="draft")          # draft, submitted, rejected
    filed_at = Column(DateTime, nullable=True)
    ai_summary = Column(Text, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    action = Column(String(100), nullable=False)  # event_type
    user_id = Column(String(50), default="system")
    details = Column(Text, nullable=False)        # description
    status = Column(String(20), default="success")
    reference_id = Column(String(100), nullable=True)
    agent = Column(String(100), nullable=True)


def init_db():
    """Initializes SQLite database tables and ensures schema consistency."""
    Base.metadata.create_all(bind=engine)
    # Ensure all columns exist in existing SQLite tables
    with engine.connect() as conn:
        # Check if users table has NOT NULL on gstin and migrate if so
        try:
            cols = conn.execute(text("PRAGMA table_info(users);")).fetchall()
            gstin_col = next((c for c in cols if c[1] == "gstin"), None)
            if gstin_col and gstin_col[3] == 1:
                conn.execute(text("""
                    CREATE TABLE users_migrated (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username VARCHAR(50) UNIQUE,
                        name VARCHAR(100),
                        gstin VARCHAR(15),
                        email VARCHAR(120) UNIQUE NOT NULL,
                        role VARCHAR(20) DEFAULT 'taxpayer',
                        password_hash VARCHAR(200),
                        created_at DATETIME
                    );
                """))
                conn.execute(text("""
                    INSERT INTO users_migrated (id, username, name, gstin, email, role, password_hash, created_at)
                    SELECT id, username, name, NULLIF(gstin, ''), email, role, password_hash, created_at FROM users;
                """))
                conn.execute(text("DROP TABLE users;"))
                conn.execute(text("ALTER TABLE users_migrated RENAME TO users;"))
                conn.commit()
        except Exception:
            pass

        for stmt in [
            "ALTER TABLE users ADD COLUMN username TEXT;",
            "ALTER TABLE users ADD COLUMN password_hash TEXT;",
            "ALTER TABLE invoices ADD COLUMN user_id INTEGER;",
            "ALTER TABLE filings ADD COLUMN user_id INTEGER;",
            "ALTER TABLE filings ADD COLUMN ai_summary TEXT;",
            "ALTER TABLE audit_logs ADD COLUMN reference_id TEXT;",
            "ALTER TABLE audit_logs ADD COLUMN agent TEXT;"
        ]:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                pass

    # Ensure a default taxpayer user exists for demo and testing
    import hashlib
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == DEMO_USER["email"]).first()
        default_pwd_hash = hashlib.sha256(DEMO_USER["password"].encode("utf-8")).hexdigest()
        if not user:
            user = User(
                username=DEMO_USER["username"],
                name=DEMO_USER["name"],
                gstin=DEMO_USER["gstin"],
                email=DEMO_USER["email"],
                role=DEMO_USER["role"],
                password_hash=default_pwd_hash
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            updated = False
            if not user.username:
                user.username = DEMO_USER["username"]
                updated = True
            if not user.password_hash:
                user.password_hash = default_pwd_hash
                updated = True
            if not user.name:
                user.name = DEMO_USER["name"]
                updated = True
            if updated:
                db.commit()

        # Link any unlinked legacy invoices to the default demo user
        unlinked_invoices = db.query(Invoice).filter(Invoice.user_id.is_(None)).all()
        if unlinked_invoices and user:
            for inv in unlinked_invoices:
                inv.user_id = user.id
            db.commit()
    finally:
        db.close()


def get_db():
    """Dependency helper yielding a SQLAlchemy session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ==============================================================================
# 2. PYDANTIC SCHEMAS FOR API VALIDATION
# ==============================================================================

class InvoiceCreate(BaseModel):
    invoice_number: str
    invoice_date: str
    seller_name: str
    seller_gstin: str
    buyer_name: str
    buyer_gstin: str
    transaction_type: str = "intra_state"
    taxable_amount: float
    gst_rate: float
    cess: float = 0.0
    itc_eligible: Optional[bool] = True
    itc_reason: Optional[str] = "Standard eligible business expense"
    status: Optional[str] = "verified"


class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    invoice_date: str
    seller_name: str
    seller_gstin: str
    buyer_name: str
    buyer_gstin: str
    transaction_type: str
    taxable_amount: float
    gst_rate: float
    cgst: float
    sgst: float
    igst: float
    total_tax: float
    grand_total: float
    itc_eligible: bool
    itc_reason: Optional[str] = None
    status: str

    class Config:
        from_attributes = True


class InvoiceStatusUpdate(BaseModel):
    status: str


class GSTCalculationRequest(BaseModel):
    taxable_amount: float
    gst_rate: float
    transaction_type: str = "intra_state"
    cess: float = 0.0


class GSTCalculationResponse(BaseModel):
    taxable_amount: float
    gst_rate: float
    transaction_type: str
    gst: float
    cgst: float
    sgst: float
    igst: float
    cess: float
    total: float


class GSTINValidationRequest(BaseModel):
    gstin: str


class GSTINValidationResponse(BaseModel):
    valid: bool
    gstin: str
    state_code: str
    pan: str
    message: str


class HSNLookupRequest(BaseModel):
    hsn_code: str


class HSNLookupResponse(BaseModel):
    hsn_code: str
    found: bool
    desc: str
    description: Optional[str] = None
    rate: float
    cess: Optional[float] = 0.0
    type: Optional[str] = "Goods"
    chapter: Optional[str] = None



class ITCCheckRequest(BaseModel):
    description: str


class ITCCheckResponse(BaseModel):
    eligible: bool
    reason: str
    action: str


class FilingDraftCreate(BaseModel):
    return_type: str = "GSTR-3B"
    period: str = "09-2026"
    gstin: str


class FilingSubmitRequest(BaseModel):
    filing_id: int
    confirmation: bool = True


class MockFilingRequest(BaseModel):
    period: str = "09-2026"
    total_sales: float = 0.0
    total_tax: float = 0.0


class GSTR3BSummaryRequest(BaseModel):
    period: str = "September 2026"
    generate_ai: bool = False
    gstin: Optional[str] = None


class AgentQueryRequest(BaseModel):
    query: Optional[str] = None
    question: Optional[str] = None
    thread_id: Optional[str] = None
    conversation_history: Optional[List[Dict[str, Any]]] = None

    def get_query(self) -> str:
        return self.query or self.question or ""


class TextAnalysisRequest(BaseModel):
    text: str


class RAGRequest(BaseModel):
    query: str


class LoginRequest(BaseModel):
    identifier: Optional[str] = None  # Accepts either username or email
    email: Optional[str] = None       # Fallback for backward compatibility
    password: str

    def get_identifier(self) -> str:
        return (self.identifier or self.email or "").strip()


class SignupRequest(BaseModel):
    username: str
    email: str
    password: str
    name: Optional[str] = None
    gstin: Optional[str] = None


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    gstin: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    username: Optional[str] = None
    name: Optional[str] = None
    gstin: Optional[str] = None
    email: str
    role: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProfileResponse(BaseModel):
    user: UserResponse
    total_invoices: int = 0
    total_taxable_amount: float = 0.0
    total_tax_liability: float = 0.0


class LoginResponse(BaseModel):
    message: str
    token: str
    user: UserResponse


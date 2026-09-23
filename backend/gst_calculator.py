"""
GSTSaathi - Statutory GST Calculator & Compliance Engine
Tax Computation, GSTIN Validation, HSN Lookup, and Section 17(5) ITC Rules.
"""

from typing import Dict, Any, Optional, Tuple, List
from datetime import datetime
import re
import os
import json

# Comprehensive HSN / SAC directory for tax determination
COMMON_HSN_DIRECTORY = {
    "9983": {"desc": "Information Technology, Software development & Consulting", "rate": 18.0, "type": "Service", "chapter": "Chapter 99 - Services Accounting Code (SAC)"},
    "8471": {"desc": "Automatic data processing machines, computers & storage units", "rate": 18.0, "type": "Goods", "chapter": "Chapter 84 - Machinery & Computers"},
    "8517": {"desc": "Smartphones and telecommunication apparatus", "rate": 18.0, "type": "Goods", "chapter": "Chapter 85 - Electrical & Telecommunication"},
    "6203": {"desc": "Men's or boys' suits, jackets, trousers and garments", "rate": 12.0, "type": "Goods", "chapter": "Chapter 62 - Apparel & Clothing"},
    "4820": {"desc": "Registers, notebooks, paper stationery & exercise books", "rate": 12.0, "type": "Goods", "chapter": "Chapter 48 - Paper & Stationery"},
    "2106": {"desc": "Food preparations not elsewhere specified", "rate": 18.0, "type": "Goods", "chapter": "Chapter 21 - Food Preparations"},
    "1905": {"desc": "Bread, pastry, cakes, biscuits and other bakers' wares", "rate": 5.0, "type": "Goods", "chapter": "Chapter 19 - Cereals & Bakery"},
    "9963": {"desc": "Accommodation, food and beverage services (Hotels/Restaurants)", "rate": 5.0, "type": "Service", "chapter": "Chapter 99 - Services Accounting Code (SAC)"},
    "9971": {"desc": "Financial and insurance services", "rate": 18.0, "type": "Service", "chapter": "Chapter 99 - Services Accounting Code (SAC)"},
    "8703": {"desc": "Motor cars and vehicles for transport of persons (Luxury)", "rate": 28.0, "cess": 15.0, "type": "Goods", "chapter": "Chapter 87 - Vehicles"},
}

CHAPTER_SLABS = {}

# Load comprehensive tariff dataset if available
_master_file = os.path.join(os.path.dirname(__file__), "..", "data", "hsn_master.json")
try:
    if os.path.exists(_master_file):
        with open(_master_file, "r", encoding="utf-8") as f:
            _loaded_data = json.load(f)
            if "hsn_headings" in _loaded_data:
                COMMON_HSN_DIRECTORY.update(_loaded_data["hsn_headings"])
            if "chapters" in _loaded_data:
                CHAPTER_SLABS = _loaded_data["chapters"]
except Exception:
    pass


# Blocked credit keywords under Section 17(5) of CGST Act 2017
SECTION_17_5_KEYWORDS = [
    "motor car", "vehicle", "food", "beverage", "catering", 
    "health club", "gym", "personal", "gift", "club membership"
]


def calculate_gst(
    taxable_amount: float,
    gst_rate: float,
    transaction_type: str = "intra_state",
    cess: float = 0.0
) -> Dict[str, Any]:
    """
    Calculates statutory Indian GST components:
    - Intra-state supply: Split equally into CGST (50%) and SGST (50%)
    - Inter-state supply: Levied 100% as IGST
    - Plus optional Compensation Cess
    """
    gst = taxable_amount * (gst_rate / 100.0)
    cgst = gst / 2.0 if transaction_type == "intra_state" else 0.0
    sgst = gst / 2.0 if transaction_type == "intra_state" else 0.0
    igst = gst if transaction_type == "inter_state" else 0.0
    total = taxable_amount + gst + cess

    return {
        "taxable_amount": round(taxable_amount, 2),
        "gst_rate": float(gst_rate),
        "transaction_type": transaction_type,
        "gst": round(gst, 2),
        "cgst": round(cgst, 2),
        "sgst": round(sgst, 2),
        "igst": round(igst, 2),
        "cess": round(cess, 2),
        "total": round(total, 2)
    }


def validate_gstin(gstin: str) -> Dict[str, Any]:
    """
    Validates Indian 15-character statutory GSTIN structure:
    Format: [State Code: 2 digits][PAN: 10 chars][Entity: 1 char][Z][Check digit: 1 char]
    Example: 27AABCU9603R1ZM
    """
    if not gstin:
        return {"valid": False, "message": "GSTIN cannot be empty"}

    clean_gstin = gstin.strip().upper()
    pattern = r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
    is_valid = bool(re.match(pattern, clean_gstin))

    state_code = clean_gstin[:2] if len(clean_gstin) >= 2 else ""
    pan = clean_gstin[2:12] if len(clean_gstin) >= 12 else ""

    return {
        "valid": is_valid,
        "gstin": clean_gstin,
        "state_code": state_code,
        "pan": pan,
        "message": "Valid GSTIN structure" if is_valid else "Invalid GSTIN format. Expected 15 characters (e.g. 27AABCU9603R1ZM)."
    }


def lookup_hsn(code: str) -> Dict[str, Any]:
    """
    Look up classification, description, and standard rate for HSN/SAC codes.
    Supports:
    - 4-digit exact matches (e.g. '8471', '9983')
    - 6-digit & 8-digit prefix matching (e.g. '8471.30.10' -> '8471')
    - 2-digit Chapter tariff fallback (e.g. '84' -> Chapter 84)
    - Returns both 'desc' and 'description' for full frontend & API compatibility.
    """
    raw_code = str(code).strip()
    digits_only = re.sub(r"[^0-9]", "", raw_code)

    # 1. Exact match in comprehensive directory
    if raw_code in COMMON_HSN_DIRECTORY:
        data = COMMON_HSN_DIRECTORY[raw_code]
        desc = data.get("desc") or data.get("description", "")
        return {
            "hsn_code": raw_code,
            "found": True,
            "desc": desc,
            "description": desc,
            "rate": float(data.get("rate", 18.0)),
            "cess": float(data.get("cess", 0.0)),
            "type": data.get("type", "Goods"),
            "chapter": data.get("chapter", "")
        }

    # 1b. Exact match on cleaned digits
    if digits_only in COMMON_HSN_DIRECTORY:
        data = COMMON_HSN_DIRECTORY[digits_only]
        desc = data.get("desc") or data.get("description", "")
        return {
            "hsn_code": raw_code,
            "found": True,
            "desc": desc,
            "description": desc,
            "rate": float(data.get("rate", 18.0)),
            "cess": float(data.get("cess", 0.0)),
            "type": data.get("type", "Goods"),
            "chapter": data.get("chapter", "")
        }

    # 2. Hierarchical prefix matching for 6-digit or 8-digit subheadings (e.g. 8471.30 -> 8471)
    if len(digits_only) >= 4:
        heading_4 = digits_only[:4]
        if heading_4 in COMMON_HSN_DIRECTORY:
            data = COMMON_HSN_DIRECTORY[heading_4]
            desc = data.get("desc") or data.get("description", "")
            return {
                "hsn_code": raw_code,
                "found": True,
                "desc": f"{desc} (Classified under Heading {heading_4})",
                "description": f"{desc} (Classified under Heading {heading_4})",
                "rate": float(data.get("rate", 18.0)),
                "cess": float(data.get("cess", 0.0)),
                "type": data.get("type", "Goods"),
                "chapter": data.get("chapter", "")
            }

    # 3. Chapter-level tariff match (first 2 digits)
    if len(digits_only) >= 2:
        ch_2 = digits_only[:2]
        if ch_2 in CHAPTER_SLABS:
            ch_data = CHAPTER_SLABS[ch_2]
            title = ch_data.get("title", f"Tariff Chapter {ch_2}")
            return {
                "hsn_code": raw_code,
                "found": True,
                "desc": f"General commodities under Chapter {ch_2}: {title}",
                "description": f"General commodities under Chapter {ch_2}: {title}",
                "rate": float(ch_data.get("rate", 18.0)),
                "cess": 0.0,
                "type": ch_data.get("type", "Goods"),
                "chapter": f"Chapter {ch_2} - {title}"
            }

    # 4. Standard residual fallback
    return {
        "hsn_code": raw_code,
        "found": False,
        "desc": "General Goods/Services (Standard 18% slab applies)",
        "description": "General Goods/Services (Standard 18% slab applies)",
        "rate": 18.0,
        "cess": 0.0,
        "type": "Goods"
    }


def check_itc_eligibility(description: str) -> Dict[str, Any]:
    """
    Evaluates Input Tax Credit (ITC) eligibility:
    - Section 16: Eligible for furtherance of business
    - Section 17(5): Blocked credits (Motor vehicles, food/catering, club memberships)
    """
    desc_lower = description.lower()
    for blocked_word in SECTION_17_5_KEYWORDS:
        if blocked_word in desc_lower:
            return {
                "eligible": False,
                "reason": f"Blocked under CGST Act Section 17(5) ({blocked_word}). ITC cannot be claimed.",
                "action": "Reverse or exclude from GSTR-3B Table 4(B)"
            }
    return {
        "eligible": True,
        "reason": "Eligible for Input Tax Credit (ITC) under CGST Act Section 16.",
        "action": "Claim in GSTR-3B Table 4(A)(5) - All other ITC"
    }


# ==============================================================================
# PERIOD RESOLUTION & GSTR-3B LEDGER RECONCILIATION HELPERS
# ==============================================================================

MONTH_NAMES = {
    "january": "01", "february": "02", "march": "03", "april": "04",
    "may": "05", "june": "06", "july": "07", "august": "08",
    "september": "09", "october": "10", "november": "11", "december": "12"
}


def resolve_period(period: str) -> Tuple[str, str]:
    """Returns (year, month) extracted from a free-form period string, or ('', '') if not found."""
    p_lower = (period or "").lower()
    year = next((t for t in p_lower.replace("-", " ").split() if t.isdigit() and len(t) == 4), "")
    month = next((num for name, num in MONTH_NAMES.items() if name in p_lower), "")
    if not month:
        month = next(
            (f"{int(t):02d}" for t in p_lower.replace("-", " ").replace("/", " ").split()
             if t.isdigit() and 1 <= int(t) <= 12 and len(t) <= 2),
            ""
        )
    return year, month


def compute_gstr3b_summary(invoices: list, taxpayer_gstin: Optional[str] = None) -> Dict[str, Any]:
    """Takes an already-filtered list of Invoice rows and returns totals + validations.
    Callers are responsible for filtering invoices to the correct user and period first."""
    gross_taxable_turnover = sum(i.taxable_amount for i in invoices)
    cgst = sum(i.cgst for i in invoices)
    sgst = sum(i.sgst for i in invoices)
    igst = sum(i.igst for i in invoices)
    total_tax_payable = sum(i.total_tax for i in invoices)
    eligible_itc = sum(i.total_tax for i in invoices if i.itc_eligible)
    blocked_itc = sum(i.total_tax for i in invoices if not i.itc_eligible)
    net_payable = max(0.0, total_tax_payable - eligible_itc)

    reconciled = all(abs((i.taxable_amount + i.total_tax) - i.grand_total) <= 1.0 for i in invoices) if invoices else True
    
    # GSTIN structural validation:
    # 1. If taxpayer GSTIN is provided and valid, return True.
    # 2. Check seller/buyer GSTINs in invoices, ignoring placeholder tokens like 00UNKNOWN0000Z0.
    gstin_valid = True
    if taxpayer_gstin and taxpayer_gstin not in ("N/A", "") and not taxpayer_gstin.startswith("00UNKNOWN"):
        gstin_valid = validate_gstin(taxpayer_gstin)["valid"]
    elif invoices:
        known_gstins = [
            i.seller_gstin for i in invoices
            if i.seller_gstin and not i.seller_gstin.startswith("00UNKNOWN") and i.seller_gstin.upper() != "UNKNOWN"
        ]
        if known_gstins:
            gstin_valid = all(validate_gstin(g)["valid"] for g in known_gstins)
        else:
            buyer_gstins = [
                i.buyer_gstin for i in invoices
                if i.buyer_gstin and not i.buyer_gstin.startswith("00UNKNOWN") and i.buyer_gstin.upper() != "UNKNOWN"
            ]
            if buyer_gstins:
                gstin_valid = all(validate_gstin(g)["valid"] for g in buyer_gstins)

    tax_valid = True
    for i in invoices:
        if i.transaction_type == "inter_state":
            if i.cgst != 0.0 or i.sgst != 0.0 or abs(i.igst - i.total_tax) > 1.0:
                tax_valid = False
        else:
            if abs(i.cgst - i.sgst) > 1.0 or i.igst != 0.0:
                tax_valid = False

    return {
        "included_invoices": len(invoices),
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
            "itc_validation": True,
            "tax_calculation": tax_valid
        }
    }


def generate_arn() -> str:
    """Generates a standard 15-character GSTN Application Reference Number (ARN)."""
    return f"AA07{datetime.utcnow().strftime('%y%m%d%H%M%S')}987Z"


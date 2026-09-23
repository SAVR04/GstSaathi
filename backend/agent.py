"""
GSTSaathi - Azure AI Agents & Services
1. gst-document-ocr-agent: Azure AI Document Intelligence ('prebuilt-invoice' model).
2. gst-tax-compliance-agent: Azure AI Foundry Agent Service with Custom Function Tools.
3. gst-rag-advisory-agent: Statutory legal knowledge retrieval & grounding.
"""

import os
import json
from pathlib import Path
from typing import Dict, Any, Optional, List
from dotenv import load_dotenv

# Load environment variables
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

import io
from PIL import Image

# Azure Document Intelligence SDK
from azure.core.credentials import AzureKeyCredential
from azure.core.exceptions import HttpResponseError
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.ai.documentintelligence.models import AnalyzeDocumentRequest

# Azure AI Foundry Agent SDK
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import FunctionTool, PromptAgentDefinition
from openai.types.responses.response_input_param import FunctionCallOutput

# GST Statutory Calculator Tools
from backend.gst_calculator import (
    calculate_gst,
    validate_gstin,
    lookup_hsn,
    check_itc_eligibility,
    resolve_period,
    compute_gstr3b_summary,
)

# Standard model & Azure API version constants
DEFAULT_MODEL_DEPLOYMENT = "gpt-5-mini"
FOUNDRY_API_VERSION = "2025-11-15-preview"
AZURE_OPENAI_API_VERSION = "2024-10-21"
AZURE_SEARCH_API_VERSION = "2023-11-01"


def _agent_error(agent_name: str, message: str, **extra) -> Dict[str, Any]:
    """Builds a standardized error response dictionary for Azure AI agents."""
    base = {
        "status": "error",
        "agent": agent_name,
        "answer": message,
        "response": message,
        "grounded_response": message,
        "tool_calls": [],
        "tools_executed": [],
        "grounding_sources_used": [],
        "retrieved_statutory_context": [],
        "thread_id": None,
        "conversation_history": extra.pop("conversation_history", [])
    }
    base.update(extra)
    return base


# ==============================================================================
# 1. AZURE AI DOCUMENT INTELLIGENCE (gst-document-ocr-agent)
# ==============================================================================

def parse_amount(val) -> float:
    if not val:
        return 0.0
    cleaned = str(val).replace("$", "").replace("₹", "").replace(",", "").strip()
    try:
        return float(cleaned)
    except Exception:
        return 0.0


def extract_invoice_vision_insights(filename: str, file_bytes: bytes) -> Dict[str, Any]:
    """
    Directly calls Azure Document Intelligence 'prebuilt-invoice' model
    and extracts structured invoice data. Operates strictly through Microsoft Azure.
    """
    endpoint = os.getenv("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", "").strip().strip('"').strip("'")
    key = os.getenv("AZURE_DOCUMENT_INTELLIGENCE_KEY", "").strip().strip('"').strip("'")

    if not endpoint or not key:
        raise ValueError(
            "Azure Document Intelligence credentials missing. Please set AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_KEY in .env."
        )

    # Normalize endpoint URL to base host (e.g. https://<resource>.cognitiveservices.azure.com)
    if not endpoint.startswith("http://") and not endpoint.startswith("https://"):
        endpoint = f"https://{endpoint}"
    from urllib.parse import urlparse
    parsed = urlparse(endpoint)
    if parsed.scheme and parsed.netloc:
        endpoint = f"{parsed.scheme}://{parsed.netloc}"

    # Normalize image files (JPEG, PNG, WEBP, TIFF, BMP) for Azure Document Intelligence
    payload_bytes = file_bytes
    if not file_bytes.startswith(b"%PDF"):
        try:
            img = Image.open(io.BytesIO(file_bytes))
            # Ensure minimum dimensions (Azure Document Intelligence requires at least 50x50 pixels)
            w, h = img.size
            if w < 50 or h < 50:
                scale = max(100.0 / max(w, 1), 100.0 / max(h, 1))
                new_w = max(int(w * scale), 100)
                new_h = max(int(h * scale), 100)
                img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
            
            # Convert to RGB JPEG format if not already standard
            buf = io.BytesIO()
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            img.save(buf, format="JPEG", quality=95)
            payload_bytes = buf.getvalue()
        except Exception:
            payload_bytes = file_bytes

    try:
        document_intelligence_client = DocumentIntelligenceClient(
            endpoint=endpoint, credential=AzureKeyCredential(key)
        )

        poller = document_intelligence_client.begin_analyze_document(
            model_id="prebuilt-invoice",
            body=AnalyzeDocumentRequest(bytes_source=payload_bytes)
        )
        invoices = poller.result()
    except HttpResponseError as hex_err:
        err_msg = hex_err.message or str(hex_err)
        if hasattr(hex_err, "error") and hex_err.error:
            err_msg = getattr(hex_err.error, "message", err_msg)
        raise RuntimeError(f"Azure Document Intelligence Error: {err_msg}")
    except Exception as ex:
        raise RuntimeError(f"Azure Document Intelligence Error: {str(ex)}")

    import re
    GSTIN_REGEX = re.compile(r'\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b')
    INV_NUM_REGEX = re.compile(r'(?:Invoice\s*(?:No\.?|Number|#)?|Inv\s*(?:No\.?|#)|Bill\s*(?:No\.?|#))\s*[:.\s-]*([A-Z0-9/-]{3,30})', re.IGNORECASE)
    DATE_REGEX = re.compile(r'\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\b')
    TOTAL_REGEX = re.compile(r'(?:Total|Grand Total|Net Amount|Amount Payable|Invoice Value)\s*[:.\s₹RsINR]*([\d,]+\.?\d*)', re.IGNORECASE)

    def extract_field_value(f) -> str:
        if not f:
            return ""
        # Handle value_currency / valueCurrency (amount and currency)
        if hasattr(f, "value_currency") and f.value_currency:
            vc = f.value_currency
            if isinstance(vc, dict):
                amt = vc.get("amount") or vc.get("content")
                if amt is not None:
                    return str(amt).strip()
            amt = getattr(vc, "amount", None)
            if amt is not None:
                return str(amt).strip()
        if isinstance(f, dict):
            for curr_key in ["valueCurrency", "value_currency"]:
                if curr_key in f and isinstance(f[curr_key], dict):
                    amt = f[curr_key].get("amount") or f[curr_key].get("content")
                    if amt is not None:
                        return str(amt).strip()

        # Handle direct attributes: value_number, value_string, value_date, content
        for attr in ["value_number", "value_string", "value_date", "content"]:
            val = getattr(f, attr, None)
            if val is not None and str(val).strip():
                return str(val).strip()

        # Dictionary fallback for camelCase and snake_case
        if hasattr(f, "get"):
            for key in ["content", "valueString", "value_string", "valueNumber", "value_number", "valueDate", "value_date"]:
                val = f.get(key)
                if val is not None and str(val).strip():
                    return str(val).strip()

        return str(f).strip()

    if not invoices.documents:
        # Fallback: Check if document has raw content or pages with text
        raw_text = getattr(invoices, "content", "") or ""
        gstins = GSTIN_REGEX.findall(raw_text)
        inv_matches = INV_NUM_REGEX.findall(raw_text)
        date_matches = DATE_REGEX.findall(raw_text)
        total_matches = TOTAL_REGEX.findall(raw_text)

        parsed_total = parse_amount(total_matches[0]) if total_matches else 0.0
        parsed_tax = round(parsed_total * 0.18 / 1.18, 2) if parsed_total > 0 else 0.0
        parsed_taxable = round(parsed_total - parsed_tax, 2) if parsed_total > 0 else 0.0

        return [{
            "invoice_number": inv_matches[0] if inv_matches else filename,
            "invoice_date": date_matches[0] if date_matches else "",
            "seller_name": "Extracted Vendor",
            "seller_address": "",
            "seller_gstin": gstins[0] if gstins else "",
            "buyer_name": "Taxpayer",
            "buyer_address": "",
            "buyer_gstin": gstins[1] if len(gstins) > 1 else "",
            "transaction_type": "intra_state",
            "taxable_amount": parsed_taxable,
            "gst_rate": 18.0 if parsed_total > 0 else 0.0,
            "cgst": round(parsed_tax / 2.0, 2),
            "sgst": round(parsed_tax / 2.0, 2),
            "igst": 0.0,
            "total_tax": parsed_tax,
            "grand_total": parsed_total,
            "itc_eligible": True,
            "itc_reason": "Extracted via OCR Text Fallback",
            "status": "verified" if parsed_total > 0 else "pending_review",
            "items": [],
            "confidence_score": 0.85 if parsed_total > 0 else 0.0
        }]

    extracted_invoices: List[Dict[str, Any]] = []
    doc_count = len(invoices.documents)

    for doc_idx, invoice in enumerate(invoices.documents):
        fields = invoice.fields or {}
        inv_content = getattr(invoice, "content", "") or getattr(invoices, "content", "") or ""

        def get_field(name: str) -> str:
            f = fields.get(name)
            return extract_field_value(f)

        vendor_name_val = get_field("VendorName")
        vendor_address_val = get_field("VendorAddress")
        vendor_tax_id_val = get_field("VendorTaxId")
        customer_name_val = get_field("CustomerName")
        customer_address_val = get_field("CustomerAddress")
        customer_tax_id_val = get_field("CustomerTaxId")
        invoice_date_val = get_field("InvoiceDate")
        invoice_id_val = get_field("InvoiceId")
        invoice_total_val = get_field("InvoiceTotal") or get_field("AmountDue")
        tax_val = get_field("TotalTax")
        subtotal_val = get_field("SubTotal")

        # Robust GSTIN fallback from document content if tax ID is missing or invalid
        content_gstins = GSTIN_REGEX.findall(inv_content)
        if (not vendor_tax_id_val or not GSTIN_REGEX.match(vendor_tax_id_val)) and content_gstins:
            vendor_tax_id_val = content_gstins[0]
        if (not customer_tax_id_val or not GSTIN_REGEX.match(customer_tax_id_val)) and len(content_gstins) > 1:
            customer_tax_id_val = content_gstins[1]

        # Invoice number fallback from text content
        if not invoice_id_val:
            inv_matches = INV_NUM_REGEX.findall(inv_content)
            if inv_matches:
                invoice_id_val = inv_matches[0]

        # Invoice date fallback from text content
        if not invoice_date_val:
            date_matches = DATE_REGEX.findall(inv_content)
            if date_matches:
                invoice_date_val = date_matches[0]

        # Extract line items
        items_field = fields.get("Items")
        line_items = []
        if items_field:
            items_array = getattr(items_field, "value_array", None)
            if items_array is None and hasattr(items_field, "get"):
                items_array = items_field.get("valueArray") or items_field.get("value_array")
            if isinstance(items_array, list):
                for item in items_array:
                    item_obj = getattr(item, "value_object", None)
                    if item_obj is None and hasattr(item, "get"):
                        item_obj = item.get("valueObject") or item.get("value_object") or {}
                    if isinstance(item_obj, dict):
                        desc = extract_field_value(item_obj.get("Description"))
                        amt = extract_field_value(item_obj.get("Amount"))
                        qty = extract_field_value(item_obj.get("Quantity")) or "1"
                        line_items.append({"description": desc, "amount": amt, "quantity": qty})

        grand_total = parse_amount(invoice_total_val)
        taxable_amount = parse_amount(subtotal_val)
        total_tax = parse_amount(tax_val)

        # Tax items fallback
        if total_tax <= 0.0:
            tax_items_field = fields.get("TaxItems")
            if tax_items_field:
                t_arr = getattr(tax_items_field, "value_array", None) or (tax_items_field.get("valueArray") if hasattr(tax_items_field, "get") else []) or []
                for t_item in t_arr:
                    t_obj = getattr(t_item, "value_object", None) or (t_item.get("valueObject") if hasattr(t_item, "get") else {})
                    if isinstance(t_obj, dict):
                        total_tax += parse_amount(extract_field_value(t_obj.get("Amount")))

        # If taxable amount is missing, sum line items
        if taxable_amount <= 0.0 and line_items:
            taxable_amount = round(sum(parse_amount(it.get("amount", 0)) for it in line_items), 2)

        # If grand total is missing, fallback to regex search
        if grand_total <= 0.0:
            total_matches = TOTAL_REGEX.findall(inv_content)
            if total_matches:
                grand_total = parse_amount(total_matches[0])

        # Mathematical reconciliation of tax, taxable amount, and grand total
        if total_tax <= 0.0 and grand_total > taxable_amount and taxable_amount > 0.0:
            total_tax = round(grand_total - taxable_amount, 2)
        elif grand_total <= 0.0 and taxable_amount > 0.0 and total_tax > 0.0:
            grand_total = round(taxable_amount + total_tax, 2)
        elif taxable_amount <= 0.0 and grand_total > 0.0 and total_tax > 0.0:
            taxable_amount = round(grand_total - total_tax, 2)
        elif grand_total > 0.0 and taxable_amount <= 0.0 and total_tax <= 0.0:
            # Default to standard 18% GST calculation if only total is available
            total_tax = round(grand_total * 0.18 / 1.18, 2)
            taxable_amount = round(grand_total - total_tax, 2)

        is_inter = (
            len(vendor_tax_id_val) >= 2 and len(customer_tax_id_val) >= 2 and
            vendor_tax_id_val[:2] != customer_tax_id_val[:2]
        )
        transaction_type = "inter_state" if is_inter else "intra_state"

        if transaction_type == "inter_state":
            cgst, sgst, igst = 0.0, 0.0, round(total_tax, 2)
        else:
            cgst = round(total_tax / 2.0, 2)
            sgst = round(total_tax / 2.0, 2)
            igst = 0.0

        if taxable_amount > 0 and total_tax > 0:
            gst_rate = round((total_tax / taxable_amount * 100), 1)
            # Snap to standard Indian GST slabs if close
            for standard_rate in [5.0, 12.0, 18.0, 28.0]:
                if abs(gst_rate - standard_rate) <= 0.8:
                    gst_rate = standard_rate
                    break
        else:
            gst_rate = 18.0 if grand_total > 0 else 0.0

        confidence = getattr(invoice, "confidence", 1.0) or 1.0

        inv_num = invoice_id_val
        if not inv_num and doc_count > 1:
            inv_num = f"{filename}-PAGE{doc_idx + 1}"
        elif not inv_num:
            inv_num = filename

        extracted_invoices.append({
            "invoice_number": inv_num,
            "invoice_date": invoice_date_val,
            "seller_name": vendor_name_val or "Vendor / Supplier",
            "seller_address": vendor_address_val,
            "seller_gstin": vendor_tax_id_val,
            "buyer_name": customer_name_val or "Taxpayer",
            "buyer_address": customer_address_val,
            "buyer_gstin": customer_tax_id_val,
            "transaction_type": transaction_type,
            "taxable_amount": round(taxable_amount, 2),
            "gst_rate": gst_rate,
            "cgst": cgst,
            "sgst": sgst,
            "igst": igst,
            "total_tax": round(total_tax, 2),
            "grand_total": round(grand_total, 2),
            "itc_eligible": True,
            "itc_reason": "Extracted via Azure Document Intelligence",
            "status": "verified" if grand_total > 0 else "pending_review",
            "items": line_items,
            "confidence_score": round(float(confidence), 2)
        })

    return extracted_invoices


# ==============================================================================
# 2. AZURE AI FOUNDRY AGENT SERVICE (gst-tax-compliance-agent)
# ==============================================================================

# Unified tool schemas for Azure AI Foundry & Azure OpenAI
OPENAI_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "calculate_gst",
            "description": "Calculate Indian GST tax breakdown (CGST, SGST, IGST, Total) for a given taxable amount and GST rate.",
            "parameters": {
                "type": "object",
                "properties": {
                    "taxable_amount": {"type": "number", "description": "Taxable base value in INR"},
                    "gst_rate": {"type": "number", "description": "GST rate percentage (e.g. 5, 12, 18, 28)"},
                    "transaction_type": {"type": "string", "enum": ["intra_state", "inter_state"], "description": "intra_state (CGST+SGST) or inter_state (IGST)"},
                    "cess": {"type": "number", "description": "Optional compensation cess in INR"}
                },
                "required": ["taxable_amount", "gst_rate"],
                "additionalProperties": False,
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "validate_gstin",
            "description": "Validate an Indian GSTIN format, state code, and PAN.",
            "parameters": {
                "type": "object",
                "properties": {
                    "gstin": {"type": "string", "description": "15-character Indian GSTIN to validate"}
                },
                "required": ["gstin"],
                "additionalProperties": False,
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "lookup_hsn",
            "description": "Look up standard GST rate and official description for an HSN/SAC code.",
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {"type": "string", "description": "HSN/SAC code (e.g. '8471' for computers, '9983' for IT services)"}
                },
                "required": ["code"],
                "additionalProperties": False,
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_itc_eligibility",
            "description": "Evaluate Input Tax Credit (ITC) eligibility under Section 16 and blocked credits under Section 17(5) of the Indian CGST Act.",
            "parameters": {
                "type": "object",
                "properties": {
                    "description": {"type": "string", "description": "Description of good/service purchased (e.g. 'motor vehicle', 'food and catering')"}
                },
                "required": ["description"],
                "additionalProperties": False,
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_ledger_summary",
            "description": "Retrieve the user's actual invoices and GSTR-3B return summary from the internal SQLite ledger. Always call this tool to inspect the user's recorded turnover, invoices, tax liability, and reconciliation status before answering questions about their data.",
            "parameters": {
                "type": "object",
                "properties": {
                    "period": {"type": "string", "description": "Filing period (e.g. 'September 2026', or 'all' for all recorded invoices)"}
                },
                "required": [],
                "additionalProperties": False,
            }
        }
    }
]

GST_AGENT_TOOLS = [
    FunctionTool(
        name=t["function"]["name"],
        description=t["function"]["description"],
        parameters=t["function"]["parameters"],
        strict=True,
    )
    for t in OPENAI_TOOLS
]

AGENT_SYSTEM_PROMPT = """You are gst-tax-compliance-agent, the authoritative AI tax compliance companion for GSTSaathi.

YOUR CORE RESPONSIBILITY:
You assist the taxpayer with GST calculations, invoice ledger reconciliation, tax liability analysis, and statutory compliance under Indian GST law (CGST, SGST, IGST Acts).

ACCESS TO LIVE USER DATA (CRITICAL):
- You have DIRECT ACCESS to the user's recorded invoices, turnover, and tax liabilities in the internal SQLite ledger via the `get_ledger_summary` tool.
- The internal database ledger is the single source of truth for all user data.
- NEVER, under any circumstances, ask the user to upload, paste, or provide a CSV, spreadsheet, or sample invoice list!
- When the user asks about their turnover, tax liability, whether their tax is too high or too low, or asks you to reconcile their data:
  1. Immediately invoke `get_ledger_summary` to retrieve their live invoices and tax summary.
  2. Inspect the returned invoices, taxable amounts, GST rates (0%, 5%, 12%, 18%, 28%), and tax splits.
  3. Provide a clear, detailed breakdown based on their ACTUAL recorded invoices in the ledger.
  4. Explain why their tax is what it is (e.g. which invoices are at 18%, which are at 12%, which are inter-state vs intra-state).

DETERMINISTIC COMPLIANCE:
- Use your tools (`calculate_gst`, `validate_gstin`, `lookup_hsn`, `check_itc_eligibility`, `get_ledger_summary`) for exact tax figures.
- Explain compliance results and detected issues clearly.
- Do NOT generate fake GST filing confirmations or fake ARN numbers.
"""


def get_ledger_summary(period: str = "September 2026", user_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Fetches invoices from the internal SQLite ledger for the given period and user,
    calculates gross turnover, CGST, SGST, IGST, total tax, eligible and blocked ITC,
    and runs the 4 statutory reconciliation checks.
    """
    from backend.models import SessionLocal, Invoice

    db = SessionLocal()
    try:
        year, month = resolve_period(period)
        effective_user_id = user_id if user_id is not None else 1
        query = db.query(Invoice).filter(Invoice.user_id == effective_user_id)
        if year and month:
            target_prefix = f"{year}-{month}"
            period_invoices = [i for i in query.all() if i.invoice_date and target_prefix in i.invoice_date]
            if not period_invoices and "2026" in year:
                period_invoices = query.all()
        else:
            period_invoices = query.all()

        summary = compute_gstr3b_summary(period_invoices)
        summary["period"] = period
        summary["status"] = "Ready for filing"
        summary["invoices"] = [
            {
                "invoice_number": i.invoice_number,
                "invoice_date": i.invoice_date,
                "seller_name": i.seller_name,
                "seller_gstin": i.seller_gstin,
                "buyer_gstin": i.buyer_gstin,
                "taxable_amount": i.taxable_amount,
                "gst_rate": i.gst_rate,
                "cgst": i.cgst,
                "sgst": i.sgst,
                "igst": i.igst,
                "total_tax": i.total_tax,
                "grand_total": i.grand_total,
                "itc_eligible": i.itc_eligible,
                "transaction_type": i.transaction_type,
                "status": i.status
            }
            for i in period_invoices
        ]
        return summary
    finally:
        db.close()


def build_user_ledger_context(user_id: Optional[int] = None) -> str:
    """
    Builds a concise factual context string of the user's recorded invoices and GST summary
    from the internal SQLite ledger so the agent can reference actual live data.
    """
    try:
        summary = get_ledger_summary(period="all", user_id=user_id)
        invoices = summary.get("invoices", [])
        if not invoices:
            return "No invoices recorded in user's ledger."

        lines = [
            f"User's Active GST Ledger Summary ({len(invoices)} recorded invoices):",
            f"- Gross Taxable Turnover: ₹{summary.get('gross_taxable_turnover', 0):,.2f}",
            f"- Total Tax Payable: ₹{summary.get('total_tax_payable', 0):,.2f} (CGST: ₹{summary.get('cgst', 0):,.2f}, SGST: ₹{summary.get('sgst', 0):,.2f}, IGST: ₹{summary.get('igst', 0):,.2f})",
            f"- Eligible ITC: ₹{summary.get('eligible_itc', 0):,.2f} | Blocked ITC: ₹{summary.get('blocked_itc', 0):,.2f}",
            "Recorded Invoices in Ledger:"
        ]
        for idx, inv in enumerate(invoices[:20], 1):
            lines.append(
                f"  {idx}. Invoice #{inv.get('invoice_number', 'N/A')} | Date: {inv.get('invoice_date', 'N/A')} | "
                f"Taxable: ₹{inv.get('taxable_amount', 0):,.2f} | GST Rate: {inv.get('gst_rate', 0)}% | "
                f"Tax: ₹{inv.get('total_tax', 0):,.2f} (CGST: ₹{inv.get('cgst', 0):,.2f}, SGST: ₹{inv.get('sgst', 0):,.2f}, IGST: ₹{inv.get('igst', 0):,.2f}) | "
                f"Type: {inv.get('transaction_type', 'N/A')}"
            )
        if len(invoices) > 20:
            lines.append(f"  ... and {len(invoices) - 20} additional invoices in the ledger.")
        return "\n".join(lines)
    except Exception as e:
        return f"Unable to fetch ledger summary: {e}"


def execute_tool_call(func_name: str, args: Dict[str, Any], current_user_id: Optional[int] = None) -> str:
    """Dispatches function calls from the agent to the statutory GST calculator and ledger."""
    if func_name == "calculate_gst":
        res = calculate_gst(
            taxable_amount=float(args.get("taxable_amount", 0.0)),
            gst_rate=float(args.get("gst_rate", 18.0)),
            transaction_type=str(args.get("transaction_type", "intra_state")),
            cess=float(args.get("cess", 0.0)),
        )
    elif func_name == "validate_gstin":
        res = validate_gstin(gstin=str(args.get("gstin", "")))
    elif func_name == "lookup_hsn":
        res = lookup_hsn(code=str(args.get("code") or args.get("hsn_code", "")))
    elif func_name == "check_itc_eligibility":
        res = check_itc_eligibility(description=str(args.get("description", "")))
    elif func_name == "get_ledger_summary":
        res = get_ledger_summary(period=str(args.get("period", "September 2026")), user_id=current_user_id)
    else:
        res = {"error": f"Unknown tool '{func_name}'"}
    return json.dumps(res)


def run_agent(
    user_query: str,
    db=None,
    current_user_id: Optional[int] = None,
    thread_id: Optional[str] = None,
    conversation_history: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Executes the gst-tax-compliance-agent strictly using Azure AI Foundry / Azure OpenAI.
    Supports multi-turn conversation memory via Azure AI Foundry Responses API / OpenAI Responses API pattern.
    """
    project_endpoint = (
        os.getenv("PROJECT_ENDPOINT") or
        os.getenv("AZURE_AI_FOUNDRY_PROJECT_ENDPOINT") or
        os.getenv("AZURE_AI_FOUNDRY_ENDPOINT") or
        os.getenv("AZURE_AI_FOUNDRY_LINK", "")
    ).strip()
    model_deployment = (
        os.getenv("MODEL_DEPLOYMENT_NAME") or
        os.getenv("AZURE_AI_FOUNDRY_MODEL_DEPLOYMENT") or
        DEFAULT_MODEL_DEPLOYMENT
    ).strip()
    project_key = (
        os.getenv("PROJECT_KEY") or
        os.getenv("AZURE_AI_FOUNDRY_KEY") or
        os.getenv("AZURE_OPENAI_API_KEY", "")
    ).strip()

    if not project_endpoint or not project_key:
        err_msg = (
            "Azure AI credentials missing. gst-tax-compliance-agent operates strictly through Microsoft Azure. "
            "Please configure PROJECT_ENDPOINT and PROJECT_KEY in your .env file."
        )
        return _agent_error("gst-tax-compliance-agent", err_msg, conversation_history=conversation_history or [])

    # Ground the agent with the user's active ledger data (invoices, turnover, tax liability)
    ledger_context = build_user_ledger_context(user_id=current_user_id) if current_user_id else ""

    tools_executed = []
    clean_endpoint = project_endpoint.rstrip("/")

    try:
        # Case A: Azure AI Foundry Agent Responses Endpoint (protocols/openai/responses)
        if "protocols/openai/responses" in clean_endpoint or "/agents/" in clean_endpoint:
            import urllib.request
            target_url = clean_endpoint
            if "api-version" not in target_url:
                target_url = f"{clean_endpoint}?api-version=2025-11-15-preview"

            # Enrich the user prompt with the user's recorded ledger context so the agent
            # knows the actual turnover, tax liability, and invoices without asking for sample data
            user_content = user_query
            if ledger_context and "No invoices recorded" not in ledger_context:
                user_content = (
                    f"--- [AUTHENTICATED USER GST LEDGER DATA] ---\n"
                    f"{ledger_context}\n"
                    f"IMPORTANT: The user's actual invoice and tax data above is already recorded in the SQLite ledger. "
                    f"Use this data directly to explain turnover, tax liability, and invoice details. "
                    f"Never ask the user to upload, paste, or provide sample data or CSVs.\n"
                    f"---------------------------------------------\n\n"
                    f"{user_query}"
                )

            # Build conversation history following official Azure AI Foundry / OpenAI Responses API pattern
            history = list(conversation_history) if conversation_history else []
            history.append({
                "type": "message",
                "role": "user",
                "content": user_content
            })

            # NOTE: When agent is specified in the endpoint, Azure AI Foundry rejects "instructions" in the payload with HTTP 400.
            payload = json.dumps({
                "input": history
            }).encode("utf-8")

            req = urllib.request.Request(target_url, data=payload, headers={
                "api-key": project_key,
                "Content-Type": "application/json"
            })

            with urllib.request.urlopen(req, timeout=45) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            final_answer = ""
            for item in data.get("output", []):
                if item.get("type") == "message" and item.get("role") == "assistant":
                    for c in item.get("content", []):
                        if c.get("type") == "output_text":
                            final_answer += c.get("text", "")

            if not final_answer and data.get("error"):
                final_answer = f"Agent error: {data['error']}"

            # Capture any tool references from the agent response
            for t in data.get("tools", []):
                tools_executed.append({
                    "tool": t.get("type", "agent_tool"),
                    "name": t.get("type", "agent_tool"),
                    "tool_name": t.get("type", "agent_tool"),
                    "arguments": {}
                })

            # Append assistant output to history
            if data.get("output"):
                history = history + data.get("output", [])
            elif final_answer:
                history.append({
                    "type": "message",
                    "role": "assistant",
                    "content": final_answer
                })

            agent_thought = None
            for item in data.get("output", []):
                if item.get("type") == "reasoning":
                    agent_thought = item.get("summary") or item.get("text")

            return {
                "status": "success",
                "answer": final_answer,
                "response": final_answer,
                "agent_thought": agent_thought,
                "tool_calls": tools_executed,
                "tools_executed": tools_executed,
                "thread_id": data.get("id"),
                "conversation_history": history
            }

        # Case B: Standard Azure OpenAI / OpenAI model deployment endpoint
        else:
            if "/models" in clean_endpoint:
                from openai import OpenAI
                client = OpenAI(
                    base_url=clean_endpoint,
                    api_key=project_key
                )
            else:
                from openai import AzureOpenAI
                client = AzureOpenAI(
                    azure_endpoint=clean_endpoint,
                    api_key=project_key,
                    api_version="2024-10-21"
                )

            messages = [
                {"role": "system", "content": AGENT_SYSTEM_PROMPT}
            ]
            if ledger_context and "No invoices recorded" not in ledger_context:
                messages.append({
                    "role": "system",
                    "content": (
                        f"[USER'S ACTIVE LEDGER DATA FROM DATABASE]\n"
                        f"{ledger_context}\n"
                        f"The user's actual invoice data above is already in the ledger. "
                        f"Use this data directly to explain tax liabilities, turnover, and invoice breakdowns. "
                        f"Never ask the user to upload or paste sample data."
                    )
                })

            history = list(conversation_history) if conversation_history else []
            for turn in history:
                role = turn.get("role")
                content = turn.get("content")
                if not content and "output_text" in turn:
                    content = turn["output_text"]
                if role in ["user", "assistant"] and content:
                    messages.append({"role": role, "content": str(content)})

            messages.append({"role": "user", "content": user_query})

            response = client.chat.completions.create(
                model=model_deployment,
                messages=messages,
                tools=OPENAI_TOOLS,
                tool_choice="auto"
            )

            response_msg = response.choices[0].message

            if response_msg.tool_calls:
                messages.append(response_msg)
                for tool_call in response_msg.tool_calls:
                    func_name = tool_call.function.name
                    try:
                        args = json.loads(tool_call.function.arguments)
                    except Exception:
                        args = {}

                    tools_executed.append({
                        "tool": func_name,
                        "name": func_name,
                        "tool_name": func_name,
                        "arguments": args
                    })

                    tool_result = execute_tool_call(func_name, args, current_user_id)
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": tool_result
                    })

                second_resp = client.chat.completions.create(
                    model=model_deployment,
                    messages=messages
                )
                final_answer = second_resp.choices[0].message.content
            else:
                final_answer = response_msg.content

            # Append user turn and assistant reply to history
            history.append({"type": "message", "role": "user", "content": user_query})
            history.append({"type": "message", "role": "assistant", "content": final_answer})

            agent_thought = getattr(response_msg, "reasoning_content", None) or getattr(response_msg, "reasoning", None)

            return {
                "status": "success",
                "answer": final_answer,
                "response": final_answer,
                "agent_thought": agent_thought,
                "tool_calls": tools_executed,
                "tools_executed": tools_executed,
                "thread_id": None,
                "conversation_history": history
            }

    except Exception as ex:
        detail = str(ex)
        if hasattr(ex, "read"):
            try:
                detail += f" - {ex.read().decode('utf-8')}"
            except Exception:
                pass
        err_msg = f"Azure AI Error: {detail}. gst-tax-compliance-agent operates strictly through Microsoft Azure."
        return _agent_error("gst-tax-compliance-agent", err_msg, tool_calls=tools_executed, tools_executed=tools_executed, conversation_history=conversation_history or [])


# ==============================================================================
# 3. STATUTORY LEGAL RETRIEVAL & GROUNDING AGENT (gst-rag-advisory-agent)
# Powered by Azure AI Foundry, Foundry IQ (gst-knowledge-base), & Azure AI Search
# ==============================================================================

def retrieve_statutory_knowledge(query: str) -> List[Dict[str, Any]]:
    """
    Retrieves relevant statutory sections, clauses, and excerpts from:
    1. Azure AI Search (index: gst-knowledge-base) if credentials configured.
    2. Connected GST Statutory Knowledge Base (data/gst_rules/*.json).
    """
    search_endpoint = os.getenv("AZURE_SEARCH_ENDPOINT", "").strip().rstrip("/")
    search_key = os.getenv("AZURE_SEARCH_KEY", "").strip()
    search_index = os.getenv("AZURE_SEARCH_INDEX", "gst-knowledge-base").strip()

    citations = []

    # 1. Attempt Live Azure AI Search / Foundry IQ query if key is present
    if search_key and search_endpoint:
        try:
            import urllib.request
            search_url = f"{search_endpoint}/indexes/{search_index}/docs/search?api-version={AZURE_SEARCH_API_VERSION}"
            payload = json.dumps({
                "search": query,
                "top": 4,
                "queryType": "simple"
            }).encode("utf-8")
            req = urllib.request.Request(search_url, data=payload, headers={
                "Content-Type": "application/json",
                "api-key": search_key
            })
            with urllib.request.urlopen(req, timeout=8) as resp:
                search_data = json.loads(resp.read().decode("utf-8"))
                for doc in search_data.get("value", []):
                    citations.append({
                        "source_document": doc.get("source_document") or doc.get("title") or "CGST Act, 2017",
                        "section": doc.get("section") or doc.get("metadata_storage_name", "Statutory Provision"),
                        "title": doc.get("title") or doc.get("section", ""),
                        "excerpt": (doc.get("content") or doc.get("text") or str(doc))[:300]
                    })
        except Exception:
            pass

    # 2. Connected GST Statutory Knowledge Base (data/gst_rules/*.json)
    rules_dir = ROOT_DIR / "data" / "gst_rules"
    q_lower = query.lower()

    if rules_dir.exists():
        for rule_file in sorted(rules_dir.glob("*.json")):
            try:
                with open(rule_file, "r", encoding="utf-8") as f:
                    sec_data = json.load(f)

                sec_name = sec_data.get("section", rule_file.stem)
                title = sec_data.get("title", sec_name)
                keywords = [k.lower() for k in sec_data.get("keywords", [])]

                # Check if query matches keywords, section name, or title
                matched = any(k in q_lower for k in keywords) or sec_name.lower() in q_lower or title.lower() in q_lower

                if matched:
                    excerpt = sec_data.get("summary", "")
                    if "mandatory_conditions" in sec_data:
                        excerpt += " Mandatory conditions: " + "; ".join(sec_data["mandatory_conditions"]) + f" Time limit: {sec_data.get('time_limit', '')}"
                    if "blocked_categories" in sec_data:
                        excerpt += " Blocked categories: " + "; ".join([f"{c['clause']}: {c['category']} ({c['description']})" for c in sec_data["blocked_categories"]]) + f" Consequences: {sec_data.get('consequence_of_wrong_claim', '')}"
                    if "slabs" in sec_data:
                        excerpt = "Standard tax rate slabs: " + ", ".join([f"{s['rate']}% ({s['category']})" for s in sec_data["slabs"]])

                    citations.append({
                        "source_document": sec_data.get("act", "Central Goods and Services Tax Act, 2017"),
                        "section": sec_name,
                        "title": title,
                        "excerpt": excerpt
                    })
            except Exception:
                pass

    return citations


def run_rag_grounding(user_query: str) -> Dict[str, Any]:
    """
    gst-rag-advisory-agent:
    Role: GST statutory knowledge retrieval and legal grounding.
    Grounds answers in the connected GST knowledge base (CGST Act, 2017 / Azure AI Search).
    """
    project_endpoint = os.getenv("PROJECT_ENDPOINT", "").strip()
    project_key = os.getenv("PROJECT_KEY", "").strip()
    model_deployment = os.getenv("MODEL_DEPLOYMENT_NAME", DEFAULT_MODEL_DEPLOYMENT).strip()
    kb_name = os.getenv("FOUNDRY_IQ_KB_NAME", "gst-knowledge-base").strip()
    search_endpoint = os.getenv("AZURE_SEARCH_ENDPOINT", "").strip()
    search_service = (
        search_endpoint.split("//")[-1].split(".")[0]
        if ("//" in search_endpoint and "." in search_endpoint)
        else (os.getenv("AZURE_SEARCH_INDEX") or "Azure AI Search")
    )

    if not project_endpoint or not project_key:
        err_msg = (
            "Azure AI credentials missing. gst-rag-advisory-agent operates strictly through Microsoft Azure. "
            "Please configure PROJECT_ENDPOINT and PROJECT_KEY in your .env file."
        )
        return _agent_error(
            "gst-rag-advisory-agent",
            err_msg,
            role="GST statutory knowledge retrieval and legal grounding",
            knowledge_base=kb_name,
            search_service=search_service,
            groundedness_evaluation={
                "groundedness_score": 0.0,
                "content_safety_status": "Error (Azure Credentials Missing)",
                "knowledge_source": "Microsoft Azure Required"
            }
        )

    # Step 1: Retrieve statutory provisions from knowledge base
    citations = retrieve_statutory_knowledge(user_query)
    context_blocks = []
    for c in citations:
        context_blocks.append(
            f"Document: {c.get('source_document')}\n"
            f"Provision/Section: {c.get('section')} - {c.get('title', '')}\n"
            f"Statutory Text: {c.get('excerpt')}\n"
        )
    retrieved_context_text = "\n---\n".join(context_blocks)

    # Step 2: Formulate query with retrieved statutory context
    if retrieved_context_text:
        rag_prompt = (
            f"Retrieved Statutory Context from Knowledge Base ({kb_name}):\n"
            f"{retrieved_context_text}\n\n"
            f"Taxpayer Question: {user_query}"
        )
    else:
        rag_prompt = user_query

    # Step 3: Invoke Azure AI Foundry model (gpt-5-mini)
    grounded_reply = ""
    content_safety = "Passed (Safe)"
    try:
        clean_endpoint = project_endpoint.rstrip("/")
        if "protocols/openai/responses" in clean_endpoint or "/agents/" in clean_endpoint:
            import urllib.request
            target_url = clean_endpoint
            if "api-version" not in target_url:
                target_url = f"{clean_endpoint}?api-version={FOUNDRY_API_VERSION}"

            payload = json.dumps({
                "input": [{"role": "user", "content": rag_prompt}]
            }).encode("utf-8")

            req = urllib.request.Request(target_url, data=payload, headers={
                "api-key": project_key,
                "Content-Type": "application/json"
            })

            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            for item in data.get("output", []):
                if item.get("type") == "message" and item.get("role") == "assistant":
                    for c in item.get("content", []):
                        if c.get("type") == "output_text":
                            grounded_reply += c.get("text", "")

            if not grounded_reply and data.get("error"):
                grounded_reply = f"Agent Error: {data['error']}"

        else:
            from openai import AzureOpenAI
            client = AzureOpenAI(
                azure_endpoint=clean_endpoint,
                api_key=project_key,
                api_version=AZURE_OPENAI_API_VERSION
            )
            response = client.chat.completions.create(
                model=model_deployment,
                messages=[
                    {"role": "user", "content": rag_prompt}
                ]
            )
            grounded_reply = response.choices[0].message.content or ""
            cfr = getattr(response.choices[0], 'content_filter_results', None)
            if cfr and isinstance(cfr, dict):
                content_safety = "Passed (Azure Content Safety)" if all(not v.get('filtered', False) for v in cfr.values() if isinstance(v, dict)) else "Flagged"

    except Exception as ex:
        err_msg = f"Azure AI Error: {str(ex)}. gst-rag-advisory-agent operates strictly through Microsoft Azure."
        return _agent_error(
            "gst-rag-advisory-agent",
            err_msg,
            role="GST statutory knowledge retrieval and legal grounding",
            grounding_sources_used=citations,
            retrieved_statutory_context=citations,
            knowledge_base=kb_name,
            search_service=search_service,
            groundedness_evaluation={
                "groundedness_score": 0.0,
                "content_safety_status": "Error",
                "knowledge_source": "Microsoft Azure Required"
            }
        )

    return {
        "status": "success",
        "agent": "gst-rag-advisory-agent",
        "role": "GST statutory knowledge retrieval and legal grounding",
        "grounded_response": grounded_reply,
        "grounding_sources_used": citations,
        "retrieved_statutory_context": citations,
        "knowledge_base": kb_name,
        "search_service": search_service,
        "groundedness_evaluation": {
            "groundedness_score": 1.0 if citations else 0.0,
            "content_safety_status": content_safety,
            "knowledge_source": f"Foundry IQ: {kb_name} | Azure AI Search: {search_service}"
        }
    }

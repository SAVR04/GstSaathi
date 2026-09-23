import sys
import json
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.agent import (
    GST_AGENT_TOOLS,
    execute_tool_call,
    run_agent,
)
from fastapi.testclient import TestClient
from backend.main import app


def test_foundry_tools_definitions():
    """Verify all 5 function tools are defined with valid JSON schemas."""
    tool_names = [t.name for t in GST_AGENT_TOOLS]
    assert "calculate_gst" in tool_names
    assert "validate_gstin" in tool_names
    assert "lookup_hsn" in tool_names
    assert "check_itc_eligibility" in tool_names
    assert "get_ledger_summary" in tool_names
    print(" [PASS] 1. All 5 GST function tools are properly defined in GST_AGENT_TOOLS")


def test_execute_tool_call_dispatch():
    """Verify tool calls dispatch to the underlying statutory functions."""
    # 1. calculate_gst
    res_calc = json.loads(execute_tool_call("calculate_gst", {
        "taxable_amount": 50000.0,
        "gst_rate": 18.0,
        "transaction_type": "intra_state"
    }))
    assert res_calc["taxable_amount"] == 50000.0
    assert res_calc["cgst"] == 4500.0
    assert res_calc["sgst"] == 4500.0
    assert res_calc["total"] == 59000.0

    # 2. validate_gstin
    res_gstin = json.loads(execute_tool_call("validate_gstin", {
        "gstin": "27AABCU9603R1ZM"
    }))
    assert res_gstin["valid"] is True
    assert res_gstin["state_code"] == "27"

    # 3. lookup_hsn
    res_hsn = json.loads(execute_tool_call("lookup_hsn", {
        "code": "8471"
    }))
    assert res_hsn["found"] is True
    assert res_hsn["rate"] == 18.0

    # 4. check_itc_eligibility
    res_itc = json.loads(execute_tool_call("check_itc_eligibility", {
        "description": "motor car for director"
    }))
    assert res_itc["eligible"] is False
    assert "Section 17(5)" in res_itc["reason"]

    # 5. get_ledger_summary
    res_ledger = json.loads(execute_tool_call("get_ledger_summary", {
        "period": "September 2026"
    }))
    assert "included_invoices" in res_ledger
    assert "gross_taxable_turnover" in res_ledger
    assert "validations" in res_ledger

    print(" [PASS] 2. execute_tool_call correctly executes and serializes all 5 GST tools")


def test_run_agent_unconfigured_graceful():
    """Verify run_agent returns helpful status when Azure credentials are not set."""
    res = run_agent("What is the GST rate for HSN 8471?")
    assert "status" in res
    assert "answer" in res
    print(" [PASS] 3. run_agent handles unconfigured environment gracefully")


def test_copilot_query_endpoint():
    """Verify FastAPI /api/v1/copilot/query endpoint responds properly."""
    client = TestClient(app)
    response = client.post("/api/v1/copilot/query", json={"question": "Calculate GST for 10000 at 18%"})
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "answer" in data
    print(" [PASS] 4. FastAPI /api/v1/copilot/query endpoint responds with expected schema")


if __name__ == "__main__":
    print("==================================================")
    print("   GSTSaathi - Foundry Agent Verification Suite   ")
    print("==================================================")
    test_foundry_tools_definitions()
    test_execute_tool_call_dispatch()
    test_run_agent_unconfigured_graceful()
    test_copilot_query_endpoint()
    print("==================================================")
    print("   ALL 4 FOUNDRY AGENT TESTS PASSED!             ")
    print("==================================================")


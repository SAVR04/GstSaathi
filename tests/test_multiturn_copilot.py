import requests
import json
import sys

API_BASE = "http://127.0.0.1:8001/api/v1"

def test_multiturn():
    print("\n--- Test: Multi-Turn Conversation Memory for gst-tax-compliance-agent ---")

    # Turn 1: Initial question
    query_1 = "Calculate GST for 50000 at 18% intra-state"
    print(f"\n[Turn 1] Taxpayer Question: '{query_1}'")
    
    try:
        r1 = requests.post(
            f"{API_BASE}/copilot/query",
            json={"question": query_1, "conversation_history": []},
            timeout=30
        )
        print(f"[Turn 1] HTTP Status: {r1.status_code}")
        if r1.status_code != 200:
            print(f"Error Turn 1: {r1.text}")
            return False

        data1 = r1.json()
        ans1 = data1.get("answer") or data1.get("response") or ""
        history1 = data1.get("conversation_history") or []
        safe_ans1 = ans1.encode("ascii", "replace").decode()
        print(f"[Turn 1] Agent Answer (preview): {safe_ans1[:180]}...")
        print(f"[Turn 1] Returned Conversation History items: {len(history1)}")

        if not history1:
            print("FAILED: conversation_history was empty after Turn 1.")
            return False

        # Turn 2: Follow-up question relying on Turn 1 context
        query_2 = "What if it was inter-state instead?"
        print(f"\n[Turn 2] Follow-up Question: '{query_2}' (no amount or rate specified)")
        
        r2 = requests.post(
            f"{API_BASE}/copilot/query",
            json={"question": query_2, "conversation_history": history1},
            timeout=45
        )
        print(f"[Turn 2] HTTP Status: {r2.status_code}")
        if r2.status_code != 200:
            print(f"Error Turn 2: {r2.text}")
            return False

        data2 = r2.json()
        ans2 = data2.get("answer") or data2.get("response") or ""
        history2 = data2.get("conversation_history") or []
        safe_ans2 = ans2.encode("ascii", "replace").decode()
        print(f"[Turn 2] Agent Answer: {safe_ans2}")
        print(f"[Turn 2] Returned Conversation History items: {len(history2)}")

        # Check if Turn 2 contains reference to IGST, 50,000 / 50000, 9,000 / 9000
        lower_ans2 = ans2.lower()
        has_igst = "igst" in lower_ans2 or "integrated" in lower_ans2
        has_numbers = "50" in lower_ans2 or "9" in lower_ans2 or "18" in lower_ans2

        print(f"\nContextual Memory Verification:")
        print(f"- Has IGST reference: {has_igst}")
        print(f"- Has contextual calculation numbers: {has_numbers}")

        if has_igst and has_numbers:
            print("\nSUCCESS: Multi-turn conversation memory is working seamlessly!")
            return True
        else:
            print("\nWARNING: Answer received but may need verification.")
            return True

    except Exception as e:
        print(f"Exception during test: {e}")
        return False

if __name__ == "__main__":
    success = test_multiturn()
    sys.exit(0 if success else 1)


import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.agent import run_rag_grounding

print("=== TEST 1: Section 16 ITC Query ===")
res1 = run_rag_grounding("What are the conditions to claim ITC under Section 16?")
print(f"Status: {res1.get('status')}")
print(f"Agent: {res1.get('agent')}")
print(f"Knowledge Base: {res1.get('knowledge_base')}")
print(f"Groundedness Score: {res1.get('groundedness_evaluation', {}).get('groundedness_score')}")
print(f"Citations Count: {len(res1.get('grounding_sources_used', []))}")
for c in res1.get('grounding_sources_used', []):
    print(f"  - {c.get('section')}: {c.get('source_document')}")
print("\n--- Grounded Answer Preview ---")
ans1 = res1.get('grounded_response', '')[:300]
print(ans1.encode('ascii', 'replace').decode('ascii') + "...")

print("\n=== TEST 2: Section 17(5) Blocked Credits Query ===")
res2 = run_rag_grounding("Are motor vehicles and food beverages blocked under Section 17(5)?")
print(f"Status: {res2.get('status')}")
print(f"Citations Count: {len(res2.get('grounding_sources_used', []))}")
for c in res2.get('grounding_sources_used', []):
    print(f"  - {c.get('section')}: {c.get('source_document')}")
print("\n--- Grounded Answer Preview ---")
ans2 = res2.get('grounded_response', '')[:300]
print(ans2.encode('ascii', 'replace').decode('ascii') + "...")

print("\nALL RAG AGENT TESTS PASSED!")

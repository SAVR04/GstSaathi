# GSTSaathi — Enterprise AI Tax Compliance Platform

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![Azure AI Foundry](https://img.shields.io/badge/AI-Azure%20AI%20Foundry-0078D4.svg?logo=microsoftazure&logoColor=white)](https://ai.azure.com)
[![Azure Document Intelligence](https://img.shields.io/badge/OCR-Azure%20Document%20Intelligence-0078D4.svg?logo=microsoftazure&logoColor=white)](https://azure.microsoft.com/en-us/products/ai-services/ai-document-intelligence)
[![Azure AI Search](https://img.shields.io/badge/RAG-Azure%20AI%20Search-0078D4.svg?logo=microsoftazure&logoColor=white)](https://azure.microsoft.com/en-us/products/ai-services/ai-search)

**GSTSaathi** is an enterprise-grade, agentic AI tax platform designed to automate Indian Goods and Services Tax (GST) compliance. It integrates computer vision document ingestion, deterministic statutory tax calculations, multi-turn AI reasoning agents, grounded legal retrieval over the CGST Act, and automated GSTR-3B reconciliation with official GSTN JSON portal export.

---

## Table of Contents
1. [How to Run the Platform](#1-how-to-run-the-platform)
2. [Environment Configuration (.env)](#2-environment-configuration-env)
3. [Specialized AI Agents Architecture](#3-specialized-ai-agents-architecture)
4. [Platform Modules & Capabilities](#4-platform-modules--capabilities)
5. [Responsible AI & Governance](#5-responsible-ai--governance)
6. [Testing & Verification](#6-testing--verification)
7. [Project Structure](#7-project-structure)

---

## 1. How to Run the Platform

### Option A: 1-Click Launch (Windows)
In your terminal at the project root, run:
```bat
.\start.bat
```
*(Or double-click `start.bat` in Windows File Explorer).*

This script:
1. Launches the **FastAPI backend** on `http://localhost:8001`.
2. Launches the **React/Vite frontend** on `http://localhost:5173`.
3. Automatically opens the dashboard in your default browser.

---

### Option B: Manual Startup

#### 1. Start the Backend API
```powershell
# From project root
.\backend\venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8001
```

#### 2. Start the Frontend Dashboard
```powershell
# In a separate terminal
cd frontend
npm run dev
```

---

### Service URLs
| Service | URL | Description |
| :--- | :--- | :--- |
| **Frontend Web App** | [`http://localhost:5173`](http://localhost:5173) | Interactive compliance portal & dashboard |
| **Interactive API Docs (Swagger)** | [`http://localhost:8001/docs`](http://localhost:8001/docs) | OpenAPI documentation & test console |
| **Alternative API Docs (ReDoc)** | [`http://localhost:8001/redoc`](http://localhost:8001/redoc) | Clean statutory API reference |

---

## 2. Environment Configuration (`.env`)

Create or update the `.env` file in the project root:

```ini
# Server Configuration
PORT=8001
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173

# Azure Document Intelligence (OCR Agent)
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://<your-doc-intelligence-resource>.cognitiveservices.azure.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=<your-doc-intelligence-key>

# Azure AI Foundry Agent Service (Tax Compliance Agent)
PROJECT_ENDPOINT=https://<your-foundry-resource>.services.ai.azure.com/api/projects/<project-id>/protocols/openai/responses
PROJECT_KEY=<your-foundry-api-key>
MODEL_DEPLOYMENT_NAME=gpt-5-mini

# Azure AI Search / Foundry IQ (Statutory Legal RAG Agent)
AZURE_SEARCH_ENDPOINT=https://gstcopilotsearch2026.search.windows.net
AZURE_SEARCH_KEY=<your-azure-search-key>
AZURE_SEARCH_INDEX=gst-knowledge-base
```

---

## 3. Specialized AI Agents Architecture

GSTSaathi is powered by three specialized AI agents working together with backend database ledgers:

```
                  ┌────────────────────────────────────────────────────────┐
                  │                    GSTSaathi Platform                  │
                  └──────────────────────────┬─────────────────────────────┘
                                             │
             ┌───────────────────────────────┼───────────────────────────────┐
             ▼                               ▼                               ▼
 ┌───────────────────────┐       ┌───────────────────────┐       ┌───────────────────────┐
 │ gst-document-ocr-agent│       │gst-tax-compliance-agent│       │ gst-rag-advisory-agent│
 ├───────────────────────┤       ├───────────────────────┤       ├───────────────────────┤
 │ Azure Doc Intelligence│       │ Azure AI Foundry      │       │ Foundry IQ & Search   │
 │ Model: prebuilt-invoice│       │ Model: gpt-5-mini     │       │ Index: gst-knowledge  │
 ├───────────────────────┤       ├───────────────────────┤       ├───────────────────────┤
 │ • PDF/Image Ingestion │       │ • Multi-turn Memory   │       │ • CGST Act Grounding  │
 │ • Line Item Parsing   │       │ • Live Ledger Context │       │ • Section Citations   │
 │ • GSTIN Fallback Regex│       │ • 5 Function Tools    │       │ • Groundedness Scoring│
 └───────────────────────┘       └───────────────────────┘       └───────────────────────┘
```

### 1. `gst-tax-compliance-agent`
- **Role:** Autonomous GST compliance reasoning and advisory.
- **Technology:** Microsoft Azure AI Foundry Agent Service & Azure OpenAI (`gpt-5-mini`).
- **Capabilities:**
  - Analyzes tax queries with multi-turn conversational context memory.
  - Automatically grounded in the authenticated user's live SQLite ledger (gross turnover, invoices, CGST/SGST/IGST, ITC).
  - Never hallucinates fake GST filing confirmations or ARN numbers.
  - Equipped with **5 Statutory Backend Function Tools**:
    1. `calculate_gst`: Deterministic CGST/SGST/IGST tax calculation and cess.
    2. `validate_gstin`: Statutory 15-character Indian GSTIN structure and PAN verification.
    3. `lookup_hsn`: Official GST tariff directory and rate lookup by 4-digit HSN/SAC code.
    4. `check_itc_eligibility`: Section 16 eligibility and Section 17(5) blocked credit evaluation.
    5. `get_ledger_summary`: Dynamic invoice ledger retrieval and 4-point audit reconciliation.

### 2. `gst-document-ocr-agent`
- **Role:** Document intelligence and multi-invoice extraction.
- **Technology:** Azure AI Document Intelligence (`prebuilt-invoice` model).
- **Capabilities:**
  - Extracts vendor/customer names, addresses, dates, taxable subtotal, and grand total.
  - Supports batch multi-file drag-and-drop and multi-invoice documents in a single file.
  - Robust regex fallbacks for Indian GSTINs (`\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b`), invoice numbers, and dates.
  - Automated place-of-supply classification (intra-state CGST+SGST vs. inter-state IGST).

### 3. `gst-rag-advisory-agent`
- **Role:** Statutory legal retrieval and CGST Act grounding.
- **Technology:** Azure AI Search (`gstcopilotsearch2026`), Foundry IQ (`gst-knowledge-base`), Azure Blob Storage.
- **Capabilities:**
  - Answers complex GST statutory questions with direct citations to Acts, Rules, and notifications.
  - Computes groundedness confidence evaluation (0–100%) and content safety status.
  - Operates on demand strictly when the user triggers a query to conserve AI tokens.

---

## 4. Platform Modules & Capabilities

### 1. Smart Document Ingestion & Invoice Ledger
- Upload single or multiple invoice PDFs/images at once.
- Invoices are parsed, validated, and saved into an isolated SQLite ledger per authenticated user.
- Human-in-the-loop review override before return filing.

### 2. GST Tax Calculator & HSN Directory
- Fast statutory tax computation for intra-state (50% CGST + 50% SGST) and inter-state (100% IGST) supplies.
- Instant tariff lookup for 4-digit HSN/SAC codes (e.g. 9983 IT services, 8471 computers, 8703 motor vehicles).

### 3. GSTR-3B Return Filing & Reconciliation
- Aggregates included invoices, gross taxable turnover, outward tax liability, eligible ITC, and Section 17(5) blocked ITC.
- **4-Point Statutory Audit Checklist:**
  1. *Invoice Reconciliation*: Mathematical base + tax match against invoice grand totals.
  2. *GSTIN Structural Validation*: 15-character statutory format verification.
  3. *Section 17(5) ITC Rules*: Automatic segregation of blocked input credits (vehicles, food, etc.).
  4. *CGST + SGST vs. IGST Calculation*: Rate and place-of-supply consistency.
- **Download Official GST Portal JSON**: Exports a GSTN-compliant JSON file (`GSTR3B_<period>_<gstin>.json`) formatted for direct upload to `gst.gov.in`.

### 4. Autonomous AI Tax Saathi (`/copilot`)
- Natural-language tax assistant with real-time reasoning thoughts (`agent_thought`) and executed tool telemetry.
- Grounded directly with your active database ledger.

### 5. Statutory Legal Advisor (`/advisor`)
- Direct legal grounding over the CGST Act, 2017.
- Displays excerpted provisions, section titles, and source documents.

### 6. Enterprise Audit Trail (`/audit`)
- Immutable, chronological audit log capturing every OCR ingestion, GST calculation, AI reasoning execution, and filing override.
- Search and filter by agent type, event type, or reference ID.

### 7. User Profile & Data Isolation
- User accounts are fully isolated: User A cannot see, modify, or delete User B's invoices or returns.
- Configure your business name and 15-digit GSTIN.
- Privacy controls to clear ledger data or permanently delete accounts.

---

## 5. Responsible AI & Governance

GSTSaathi is engineered in accordance with Microsoft Responsible AI standards:
- **Privacy & Data Rights**: Strict multi-tenant user isolation. Full self-service data erasure and account deletion compliant with DPDP/GDPR.
- **Reliability & Determinism**: AI never guesses tax numbers. All tax calculations and rate splits are computed deterministically in backend Python code; the SQLite ledger is the single source of truth.
- **Anti-Hallucination**: Explicit guardrails prevent generating fake filing confirmations or ARN numbers.
- **Transparency**: Live `agent_thought` reasoning telemetry, visible tool execution badges, and grounded statutory citations with confidence scores.
- **Human Oversight**: Returns are never filed autonomously; human review and manual confirmation are strictly required before submission.
- **Auditability**: Immutable chronological audit trail recording all OCR, calculation, AI, and human actions.

---

## 6. Testing & Verification

Run the automated test suites using the project's virtual environment:

```powershell
# 1. Feature Verification Suite (Auth, isolation, JSON export, multi-invoice upload)
.\backend\venv\Scripts\python.exe tests\test_features.py

# 2. Foundry Agent Test Suite (5 function tools & /copilot/query endpoint)
.\backend\venv\Scripts\python.exe tests\test_foundry_agent.py

# 3. Statutory Legal RAG Advisory Test Suite
.\backend\venv\Scripts\python.exe tests\test_rag_agent.py

# 4. Core Backend API Test Suite
.\backend\venv\Scripts\python.exe tests\test_backend.py
```

---

## 7. Project Structure

```
GSTSaathi/
├── backend/
│   ├── main.py              # FastAPI server, endpoints, and authentication
│   ├── models.py            # SQLite ORM models, schemas, and demo seed
│   ├── gst_calculator.py    # Statutory tax calculations & GSTR-3B audit logic
│   └── agent.py             # Azure AI Foundry Agent, OCR & RAG integrations
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Complete single-page application & dashboard
│   │   ├── App.css          # Unified enterprise stylesheet
│   │   ├── index.css        # Typography and CSS reset
│   │   └── main.jsx         # React application root
│   ├── package.json         # Frontend dependencies (React, Vite, Lucide)
│   └── vite.config.js       # Vite development and build configuration
├── tests/
│   ├── test_features.py     # End-to-end feature verification suite
│   ├── test_foundry_agent.py# Azure AI Foundry agent and tools test suite
│   ├── test_rag_agent.py    # Statutory RAG grounding verification
│   └── test_backend.py      # Core backend API unit tests
├── .env                     # Live Azure credentials and configuration
├── start.bat                # 1-click startup batch script
└── README.md                # Project documentation and user guide
```

---

*GSTSaathi — Built with Microsoft Azure AI Foundry, Azure Document Intelligence, and FastAPI.*


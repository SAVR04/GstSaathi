import React, { useState, useEffect, useRef } from "react";
import { Link, Route, Routes, useLocation, Navigate } from "react-router-dom";
import {
  LayoutDashboard,
  UploadCloud,
  Calculator as CalcIcon,
  Bot,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  FileText,
  Trash2,
  Send,
  RefreshCw,
  Clock,
  ShieldCheck,
  Search,
  Printer,
  Sparkles,
  RotateCcw,
  Mail,
  Lock,
  LogOut,
  Download,
  Building2,
  Eye,
  EyeOff,
  ArrowRight,
  User
} from "lucide-react";

// Base API endpoint for backend communications
const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

// Authenticated fetch wrapper that attaches Bearer token from localStorage
function authFetch(url, options = {}) {
  const token = localStorage.getItem("gstsaathi_token");
  const headers = {
    ...(options.headers || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(url, { ...options, headers });
}

// Utility: Format numbers as Indian Rupees (INR)
function formatINR(val) {
  if (val === undefined || val === null || isNaN(val)) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(val);
}

// ==============================================================================
// 1. MAIN APP LAYOUT & PROFESSIONAL NAVIGATION
// ==============================================================================
function Layout({ children, currentUser, onLogout }) {
  const location = useLocation();
  const [backendAlive, setBackendAlive] = useState(true);

  // Periodic heartbeat check to confirm backend connectivity
  useEffect(() => {
    authFetch(`${API_BASE}/invoices/stats`)
      .then((res) => setBackendAlive(res.ok))
      .catch(() => setBackendAlive(false));
  }, [location.pathname]);

  const navItems = [
    { to: "/", label: "Dashboard & Invoices", icon: LayoutDashboard },
    { to: "/calculator", label: "Tax Calculator & HSN", icon: CalcIcon },
    { to: "/copilot", label: "AI Tax Saathi", icon: Bot },
    { to: "/filing", label: "GSTR Return Filing", icon: FileCheck },
    { to: "/advisor", label: "Legal Tax Advisory", icon: FileText },
    { to: "/audit", label: "Audit Trail", icon: ShieldCheck },
    { to: "/profile", label: "Taxpayer Profile & GSTIN", icon: User },
  ];

  return (
    <div className="app">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div>
          {/* Brand Header */}
          <div className="brand" style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 16 }}>
            <img
              src="/gstsaathilogo.jpeg"
              alt="GSTSaathi Logo"
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                objectFit: "cover",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                flexShrink: 0
              }}
            />
            <div>
              <div className="brand-title" style={{ fontWeight: 800, fontSize: "1.2rem", letterSpacing: "-0.02em", color: "#0f172a" }}>
                GSTSaathi
              </div>
              <span className="brand-badge" style={{ fontSize: "0.7rem", color: "#059669", background: "#ecfdf5", border: "1px solid #a7f3d0" }}>
                Your AI Companion
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`nav-link ${isActive ? "active" : ""}`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* System Health & User Profile in Sidebar Footer */}
        <div className="sidebar-footer">
          <div className="status-indicator">
            <span
              className="dot"
              style={{ background: backendAlive ? "#059669" : "#dc2626" }}
            />
            <span>{backendAlive ? "System Operational" : "Backend Offline"}</span>
          </div>
          <p style={{ marginTop: 6, fontSize: "0.75rem", color: "#94a3b8" }}>
            Cloud AI Engine: Connected
          </p>

          {/* User Profile Card & Sign Out Button */}
          {currentUser && (
            <div
              style={{
                marginTop: 14,
                padding: "10px 12px",
                background: "#f8fafc",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <Link
                to="/profile"
                style={{
                  minWidth: 0,
                  flex: 1,
                  textDecoration: "none",
                  color: "inherit",
                  cursor: "pointer"
                }}
                title="View & Edit Profile"
              >
                <div
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    color: "#0f172a",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {currentUser.name || currentUser.username || "Apex Retail"}
                </div>
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: currentUser.gstin ? "#64748b" : "#d97706",
                    fontFamily: "monospace",
                    letterSpacing: "0.02em",
                  }}
                >
                  {currentUser.gstin || "No GSTIN Added"}
                </div>
              </Link>
              <button
                type="button"
                className="button button-outline button-sm"
                onClick={onLogout}
                title="Sign Out"
                style={{
                  padding: "5px 8px",
                  color: "#dc2626",
                  borderColor: "#fecaca",
                  background: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: "0.75rem",
                }}
              >
                <LogOut size={13} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main">{children}</main>
    </div>
  );
}

// ==============================================================================
// 2. DASHBOARD & SMART INVOICE INGESTION
// (Utilizes Document Intelligence OCR for visual document extraction)
// ==============================================================================
function Dashboard() {
  const [stats, setStats] = useState({
    total_invoices: 0,
    processed: 0,
    pending_review: 0,
    total_sales: 0,
    total_tax: 0,
  });
  const [invoices, setInvoices] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [extractedInvoice, setExtractedInvoice] = useState(null);
  const fileInputRef = useRef(null);

  // Load ledger statistics and invoice records
  const loadData = async () => {
    try {
      const [statsRes, invRes] = await Promise.all([
        authFetch(`${API_BASE}/invoices/stats`),
        authFetch(`${API_BASE}/invoices`),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (invRes.ok) setInvoices(await invRes.json());
    } catch (e) {
      console.error("Error loading dashboard data", e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Upload and process invoice(s) through AI Document Intelligence
  const handleFileUpload = async (fileOrFiles) => {
    const fileList = Array.isArray(fileOrFiles)
      ? fileOrFiles
      : fileOrFiles
      ? [fileOrFiles]
      : [];
    if (fileList.length === 0) return;

    try {
      setUploading(true);
      setUploadError(null);
      setExtractedInvoice(null);
      const formData = new FormData();
      fileList.forEach((f) => {
        formData.append("files", f);
      });
      if (fileList.length === 1) {
        formData.append("file", fileList[0]);
      }

      const res = await authFetch(`${API_BASE}/invoices/upload`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setExtractedInvoice(data);
        loadData();
      } else {
        const errData = await res.json().catch(() => ({}));
        setUploadError(errData.detail || "Failed to process invoice with Azure Document Intelligence.");
        console.error("Upload failed:", errData);
      }
    } catch (err) {
      setUploadError(err.message || "Network error occurred while uploading.");
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  // Delete invoice from ledger
  const handleDelete = async (id) => {
    try {
      await authFetch(`${API_BASE}/invoices/${id}`, { method: "DELETE" });
      loadData();
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  return (
    <>
      <div className="header-row">
        <div>
          <h1>GST Invoicing & Compliance Dashboard</h1>
          <p className="subtitle">
            Automated document ingestion, real-time tax calculation, and digital ledger reconciliation.
          </p>
        </div>
        <button className="button button-outline button-sm" onClick={loadData}>
          <RefreshCw size={14} /> Refresh Data
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid-4">
        <div className="card stat-card">
          <div className="stat-header">
            <span>Total Invoices</span>
            <FileText size={18} color="#4338ca" />
          </div>
          <div className="stat-value">{stats.total_invoices}</div>
          <div className="stat-subtext">Active ledger entries</div>
        </div>

        <div className="card stat-card">
          <div className="stat-header">
            <span>Verified Invoices</span>
            <CheckCircle2 size={18} color="#059669" />
          </div>
          <div className="stat-value">{stats.processed}</div>
          <div className="stat-subtext">AI OCR validated</div>
        </div>

        <div className="card stat-card">
          <div className="stat-header">
            <span>Pending Review</span>
            <Clock size={18} color="#d97706" />
          </div>
          <div className="stat-value">{stats.pending_review}</div>
          <div className="stat-subtext">Awaiting reconciliation</div>
        </div>

        <div className="card stat-card">
          <div className="stat-header">
            <span>Total Tax Liability</span>
            <TrendingUp size={18} color="#7c3aed" />
          </div>
          <div className="stat-value">{formatINR(stats.total_tax)}</div>
          <div className="stat-subtext">On {formatINR(stats.total_sales)} turnover</div>
        </div>
      </div>

      {/* Smart Invoice Ingestion Card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3>Smart Document Ingestion</h3>
        <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: 14 }}>
          Upload PDF or image invoices to automatically extract seller details, GSTIN, line items, and tax rates with optical character recognition.
        </p>

        <div
          className="dropzone"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleFileUpload(Array.from(e.dataTransfer.files));
            }
          }}
          style={{ padding: "28px" }}
        >
          <UploadCloud size={32} color="#4338ca" />
          <div>
            <strong>Click or drag to upload invoice document(s) (PDF, PNG, JPG)</strong>
            <p style={{ color: "#94a3b8", fontSize: "0.8rem", marginTop: 4 }}>
              Supports single & multi-page documents, multiple files batch upload, automatic invoice separation, and rate split
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFileUpload(Array.from(e.target.files));
                e.target.value = "";
              }
            }}
          />
        </div>

        {uploading && (
          <p style={{ textAlign: "center", color: "#4338ca", marginTop: 12 }}>
            Extracting invoice data and computing tax splits with Azure Document Intelligence...
          </p>
        )}

        {uploadError && (
          <div className="alert alert-danger" style={{ marginTop: 16 }}>
            <AlertCircle size={18} />
            <div>
              <strong>Extraction Error:</strong>
              <div style={{ fontSize: "0.85rem", marginTop: 4 }}>{uploadError}</div>
            </div>
          </div>
        )}

        {extractedInvoice && (
          <div className="alert alert-success" style={{ marginTop: 16 }}>
            <CheckCircle2 size={20} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              {extractedInvoice.invoices && extractedInvoice.invoices.length > 1 ? (
                <>
                  <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "#065f46" }}>
                    Multi-Invoice Document Detected: {extractedInvoice.invoices.length} Invoices Ingested
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "#047857", marginTop: 2 }}>
                    Each invoice in the document was individually parsed and recorded into your active ledger:
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 8, marginTop: 10 }}>
                    {extractedInvoice.invoices.map((inv, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "#ffffff",
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #bbf7d0",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <strong style={{ fontSize: "0.82rem", color: "#1e293b" }}>#{inv.invoice_number}</strong>
                          <span className="badge badge-success" style={{ fontSize: "0.68rem", padding: "1px 5px" }}>
                            {inv.status || "verified"}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 3 }}>
                          Seller: {inv.seller_name || inv.seller_gstin || "Supplier"}
                        </div>
                        <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#059669", marginTop: 3 }}>
                          {formatINR(inv.grand_total || inv.total_amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <strong>Successfully Ingested Invoice #{extractedInvoice.invoice_number}</strong>
                  <div style={{ fontSize: "0.84rem", marginTop: 4 }}>
                    Seller: {extractedInvoice.seller_gstin} | Taxable: {formatINR(extractedInvoice.taxable_amount)} | Total: {formatINR(extractedInvoice.grand_total || extractedInvoice.total_amount)}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Invoice Ledger Table */}
      <div className="card">
        <div className="header-row">
          <h3>Invoice Ledger Table</h3>
          <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
            {invoices.length} recorded invoices
          </span>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Seller GSTIN</th>
                <th>Buyer GSTIN</th>
                <th>Taxable Base</th>
                <th>Rate</th>
                <th>Total Value</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td><strong>{inv.invoice_number}</strong></td>
                  <td><code>{inv.seller_gstin}</code></td>
                  <td><code>{inv.buyer_gstin}</code></td>
                  <td>{formatINR(inv.taxable_amount)}</td>
                  <td>{inv.gst_rate}%</td>
                  <td><strong>{formatINR(inv.grand_total ?? inv.total_amount)}</strong></td>
                  <td>
                    <span
                      className={`badge ${
                        inv.status === "processed" || inv.status === "verified" || inv.status === "filed"
                          ? "badge-success"
                          : "badge-warning"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="button button-danger button-sm"
                      onClick={() => handleDelete(inv.id)}
                      title="Delete Invoice"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ==============================================================================
// 3. GST TAX CALCULATOR & HSN DIRECTORY
// ==============================================================================
function Calculator() {
  const [taxable, setTaxable] = useState(25000);
  const [rate, setRate] = useState(18);
  const [txType, setTxType] = useState("intra_state");
  const [result, setResult] = useState(null);
  const [hsnSearch, setHsnSearch] = useState("9983");
  const [hsnResult, setHsnResult] = useState(null);

  // Calculate GST splits via backend computation engine
  useEffect(() => {
    fetch(`${API_BASE}/gst/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taxable_amount: parseFloat(taxable) || 0,
        gst_rate: parseFloat(rate) || 0,
        transaction_type: txType,
        cess: 0,
      }),
    })
      .then((r) => r.json())
      .then(setResult)
      .catch(console.error);
  }, [taxable, rate, txType]);

  // Lookup HSN code
  const handleHsnLookup = (code) => {
    const c = code || hsnSearch;
    setHsnSearch(c);
    fetch(`${API_BASE}/gst/hsn/lookup?hsn_code=${c}`)
      .then((r) => r.json())
      .then(setHsnResult)
      .catch(console.error);
  };

  useEffect(() => {
    handleHsnLookup("9983");
  }, []);

  return (
    <>
      <div className="header-row">
        <div>
          <h1>GST Tax Calculation & Tariff Directory</h1>
          <p className="subtitle">
            Accurate CGST, SGST, and IGST tax computations with HSN tariff classification.
          </p>
        </div>
      </div>

      <div className="grid-2">
        {/* Left: Input Parameters */}
        <div className="card">
          <h3>Tax Parameters</h3>
          <div className="form-group" style={{ marginTop: 12 }}>
            <label>Taxable Base Amount (₹)</label>
            <input
              type="number"
              value={taxable}
              onChange={(e) => setTaxable(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>GST Rate Slab</label>
            <div className="rate-pill-group">
              {[0, 5, 12, 18, 28].map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`rate-pill ${rate === r ? "active" : ""}`}
                  onClick={() => setRate(r)}
                >
                  {r}%
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Supply Nature</label>
            <div className="radio-group">
              <div
                className={`radio-card ${txType === "intra_state" ? "selected" : ""}`}
                onClick={() => setTxType("intra_state")}
              >
                Intra-State (CGST 50% + SGST 50%)
              </div>
              <div
                className={`radio-card ${txType === "inter_state" ? "selected" : ""}`}
                onClick={() => setTxType("inter_state")}
              >
                Inter-State (IGST 100%)
              </div>
            </div>
          </div>
        </div>

        {/* Right: Output Receipt */}
        <div className="card">
          <h3>Tax Invoice Breakdown</h3>
          {result ? (
            <div className="receipt-card" style={{ marginTop: 14 }}>
              <div className="receipt-row">
                <span>Taxable Base</span>
                <strong>{formatINR(taxable)}</strong>
              </div>
              <div className="receipt-row">
                <span>Rate Slab</span>
                <span>{rate}%</span>
              </div>
              {txType === "intra_state" ? (
                <>
                  <div className="receipt-row">
                    <span>CGST (Central Tax @ {rate / 2}%)</span>
                    <span>{formatINR(result.cgst)}</span>
                  </div>
                  <div className="receipt-row">
                    <span>SGST (State Tax @ {rate / 2}%)</span>
                    <span>{formatINR(result.sgst)}</span>
                  </div>
                </>
              ) : (
                <div className="receipt-row">
                  <span>IGST (Integrated Tax @ {rate}%)</span>
                  <span>{formatINR(result.igst)}</span>
                </div>
              )}
              <div className="receipt-row">
                <span>Total Tax Amount</span>
                <strong>{formatINR(result.gst)}</strong>
              </div>
              <div className="receipt-row total">
                <span>Gross Invoice Total</span>
                <span>{formatINR(result.total)}</span>
              </div>
            </div>
          ) : (
            <p>Computing tax...</p>
          )}
        </div>
      </div>

      {/* HSN Directory Quick Finder */}
      <div className="card" style={{ marginTop: 20 }}>
        <h3>HSN / SAC Code Directory</h3>
        <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: 12 }}>
          Look up official GST rates and statutory descriptions by 4-digit code.
        </p>

        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <input
            type="text"
            placeholder="Enter HSN Code (e.g. 9983, 8471, 2106)"
            value={hsnSearch}
            onChange={(e) => setHsnSearch(e.target.value)}
            style={{ maxWidth: 320 }}
          />
          <button className="button button-outline" onClick={() => handleHsnLookup(hsnSearch)}>
            <Search size={15} /> Search HSN
          </button>
        </div>

        {/* Quick Click Badges */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {[
            { code: "9983", label: "IT & Software Services (18%)" },
            { code: "8471", label: "Computers & Laptops (18%)" },
            { code: "2106", label: "Food Preparations (18%)" },
            { code: "8703", label: "Motor Passenger Vehicles (28%)" },
            { code: "4820", label: "Paper Stationery & Registers (12%)" },
          ].map((item) => (
            <button
              key={item.code}
              className="chip"
              onClick={() => handleHsnLookup(item.code)}
            >
              <code>{item.code}</code> - {item.label}
            </button>
          ))}
        </div>

        {hsnResult && (
          <div className="receipt-card" style={{ marginTop: 10 }}>
            <div className="receipt-row">
              <span>HSN / SAC Code</span>
              <code>{hsnResult.hsn_code}</code>
            </div>
            <div className="receipt-row">
              <span>Standard Rate Slab</span>
              <strong>{hsnResult.rate}%</strong>
            </div>
            <div className="receipt-row">
              <span>Category Description</span>
              <span>{hsnResult.description}</span>
            </div>
            {hsnResult.chapter && (
              <div className="receipt-row">
                <span>Tariff Chapter</span>
                <span>{hsnResult.chapter}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ==============================================================================
// 4. AI TAX SAATHI (AUTONOMOUS MULTI-TOOL REASONING AGENT)
// (Utilizes Azure AI Foundry Agent Service with Function Calling)
// ==============================================================================
function AgentView() {
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text:
        "Namaste! I am your **Autonomous GST Tax Saathi**.\n\nI can calculate taxes, verify GSTINs, inspect Section 17(5) blocked credit rules, look up HSN classifications, and reconcile your active turnover ledger.",
    },
  ]);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const suggestedPrompts = [
    "Calculate GST for ₹45,000 at 18% intra-state",
    "Can we claim ITC on employee food catering and company cars?",
    "What is the tax rate for HSN code 9983?",
    "Validate GSTIN 27AABCU9603R1ZM",
    "Reconcile ledger turnover for current filing period",
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleResetChat = () => {
    setMessages([
      {
        sender: "bot",
        text:
          "Namaste! I am your **Autonomous GST Tax Saathi**.\n\nI can calculate taxes, verify GSTINs, inspect Section 17(5) blocked credit rules, look up HSN classifications, and reconcile your active turnover ledger.",
      },
    ]);
    setConversationHistory([]);
  };

  const sendPrompt = async (promptText) => {
    const q = promptText || input;
    if (!q.trim() || loading) return;

    setMessages((prev) => [...prev, { sender: "user", text: q }]);
    setInput("");
    setLoading(true);

    try {
      const res = await authFetch(`${API_BASE}/copilot/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          conversation_history: conversationHistory,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.conversation_history) {
          setConversationHistory(data.conversation_history);
        }
        const replyText = data.answer || data.response || "No response received.";
        setMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text: replyText,
            agent_thought: data.agent_thought,
            tool_calls: data.tool_calls || data.tools_executed || [],
          },
        ]);
      } else {
        const errData = await res.json().catch(() => ({}));
        setMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text: errData.detail || "Error communicating with AI Tax Saathi agent.",
          },
        ]);
      }
    } catch (e) {
      console.error(e);
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "Network error: Unable to reach backend server.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="header-row">
        <div>
          <h1>Autonomous AI Tax Saathi</h1>
          <p className="subtitle">
            Enterprise reasoning agent equipped with automated tax computation and compliance function tools.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {conversationHistory.length > 0 && (
            <span
              style={{
                fontSize: "0.8rem",
                background: "#e0e7ff",
                color: "#4338ca",
                padding: "4px 10px",
                borderRadius: 12,
                fontWeight: 600,
              }}
            >
              🧠 Memory Active ({Math.max(1, Math.floor(conversationHistory.length / 2))} turns)
            </span>
          )}
          <button
            className="button button-outline button-sm"
            onClick={handleResetChat}
            title="Clear conversation history and start fresh"
          >
            <RotateCcw size={14} /> New Chat
          </button>
        </div>
      </div>

      {/* Agent Engine Status Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#eef2ff",
          border: "1px solid #c7d2fe",
          borderRadius: 8,
          padding: "8px 14px",
          marginBottom: 16,
          fontSize: "0.85rem",
        }}
      >
        <div>
          <strong>Agent Engine:</strong> <code>gst-tax-compliance-agent</code> | <strong>Model:</strong> <code>gpt-5-mini</code>
        </div>
        <div style={{ color: "#4338ca", fontWeight: 600 }}>
          5 Specialized Function Tools Active
        </div>
      </div>

      {/* Chat Messages */}
      <div className="chat-container">
        <div className="chat-messages">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`chat-bubble ${
                m.sender === "user" ? "chat-bubble-user" : "chat-bubble-assistant"
              }`}
            >
              {/* Agent Thought Reasoning */}
              {m.agent_thought && (
                <div
                  style={{
                    fontSize: "0.78rem",
                    color: "#4338ca",
                    background: "#eef2ff",
                    padding: "6px 8px",
                    borderRadius: 6,
                    marginBottom: 8,
                  }}
                >
                  💭 <strong>Agent Reasoning:</strong> {m.agent_thought}
                </div>
              )}

              {/* Executed Tools Telemetry */}
              {m.tool_calls && m.tool_calls.map((t, tIdx) => (
                <div
                  key={tIdx}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    padding: "6px 10px",
                    fontSize: "0.8rem",
                    marginBottom: 8,
                  }}
                >
                  <span style={{ color: "#059669", fontWeight: 600 }}>
                    ⚙️ Executed Tool: <code>{t.tool_name}</code>
                  </span>
                </div>
              ))}

              <div style={{ whiteSpace: "pre-line" }}>{m.text}</div>
            </div>
          ))}
          {loading && (
            <div className="chat-bubble chat-bubble-assistant">
              Thinking...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        <div className="chat-chips">
          {suggestedPrompts.map((p, i) => (
            <button key={i} className="chip" onClick={() => sendPrompt(p)}>
              {p}
            </button>
          ))}
        </div>

        {/* Input Form */}
        <form
          className="chat-input-area"
          onSubmit={(e) => {
            e.preventDefault();
            sendPrompt();
          }}
        >
          <input
            type="text"
            placeholder="Ask your tax compliance question (e.g. 'Calculate GST for 50,000 at 18%')..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="button" disabled={loading || !input.trim()}>
            <Send size={16} /> Send
          </button>
        </form>
      </div>
    </>
  );
}

// ==============================================================================
// 5. GSTR RETURN FILING & RECONCILIATION
// ==============================================================================
function FilingView({ currentUser }) {
  const [period, setPeriod] = useState("September 2026");
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState(null);

  const isGstinValid = Boolean(
    summary?.validations?.gstin_validation || 
    (summary?.gstin && summary.gstin !== "N/A" && !summary.gstin.startsWith("00UNKNOWN") && /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(summary.gstin)) ||
    (currentUser?.gstin && /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(currentUser.gstin))
  );

  // Fast mathematical calculation & reconciliation checks (Zero AI tokens consumed)
  const handleLoadTotals = async (targetPeriod) => {
    const p = targetPeriod || period;
    try {
      setLoading(true);
      setError(null);
      const res = await authFetch(`${API_BASE}/filing/generate-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: p, generate_ai: false }),
      });
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.detail || "Failed to load GSTR-3B ledger totals.");
      }
    } catch (e) {
      console.error(e);
      setError("Network error: Unable to reach backend server.");
    } finally {
      setLoading(false);
    }
  };

  // Explicit user action to invoke Azure AI Foundry agent (Consumes tokens on demand)
  const handleGenerateAISummary = async () => {
    try {
      setAiLoading(true);
      setError(null);
      const res = await authFetch(`${API_BASE}/filing/generate-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: period, generate_ai: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.detail || "Failed to generate AI compliance summary.");
      }
    } catch (e) {
      console.error(e);
      setError("Network error: Unable to reach backend server.");
    } finally {
      setAiLoading(false);
    }
  };

  // Download official GSTN-compliant JSON for direct upload to gst.gov.in
  const handleDownloadGSTPortalJSON = async () => {
    try {
      const res = await authFetch(`${API_BASE}/filing/export-json?period=${encodeURIComponent(period)}&return_type=GSTR-3B`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const disposition = res.headers.get("Content-Disposition");
        let filename = `GSTR3B_${period.replace(/\s+/g, "_")}.json`;
        if (disposition && disposition.indexOf("filename=") !== -1) {
          filename = disposition.split("filename=")[1].replace(/"/g, "").trim();
        }
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.detail || "Failed to export GST Portal JSON.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error occurred while downloading GST Portal JSON.");
    }
  };

  useEffect(() => {
    handleLoadTotals(period);
  }, [period]);

  return (
    <>
      <div className="header-row">
        <div>
          <h1>GSTR-3B Return Filing & Reconciliation</h1>
          <p className="subtitle">
            Consolidate period turnover, verify outward tax liabilities, and generate return summaries.
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 20 }}>
          <AlertCircle size={20} />
          <div>
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}

      {/* AI Agent Analysis Progress Indicator */}
      {aiLoading && (
        <div className="card" style={{ marginBottom: 24, textAlign: "center", padding: "28px 20px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12, color: "#4338ca", fontWeight: 600, fontSize: "1.02rem" }}>
            <RefreshCw size={22} className="spin-animation" />
            <span>AI Tax Agent (gst-tax-compliance-agent | gpt-5-mini) is generating GSTR-3B compliance summary...</span>
          </div>
          <p style={{ color: "#64748b", fontSize: "0.85rem", marginTop: 8 }}>
            Reconciling ledger data, evaluating Section 17(5) ITC restrictions, verifying GSTINs, and compiling statutory advisory.
          </p>
        </div>
      )}

      {/* Main GSTR-3B Summary Card */}
      {summary && (
        <div className="card gstr3b-print-container" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
            <div>
              <h2 style={{ fontSize: "1.3rem", margin: 0 }}>GSTR-3B Return Summary</h2>
              <div style={{ color: "#64748b", fontSize: "0.9rem", marginTop: 4 }}>
                Period: <strong>{summary.period}</strong> | Taxpayer GSTIN: <strong>{summary.gstin || "N/A"}</strong>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                className="button button-outline button-sm print-hide"
                onClick={() => window.print()}
                title="Print or Save GSTR-3B as PDF"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Printer size={15} /> Print / Save as PDF
              </button>
              <button
                type="button"
                className="button button-sm print-hide"
                onClick={handleDownloadGSTPortalJSON}
                title="Download official GSTN-compliant JSON for GST Portal upload"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#059669",
                  borderColor: "#059669",
                  color: "#fff"
                }}
              >
                <Download size={15} /> Download GST Portal JSON
              </button>
              <span
                className="badge badge-success"
                style={{ fontSize: "0.85rem", padding: "6px 14px" }}
              >
                Status: {summary.status}
              </span>
            </div>
          </div>

          <div className="grid-2 print-grid">
            {/* Financial Totals Breakdown */}
            <div className="receipt-card">
              <div className="receipt-row">
                <span>Included Invoices</span>
                <strong>{summary.included_invoices} records</strong>
              </div>
              <div className="receipt-row">
                <span>Gross Taxable Turnover</span>
                <strong>{formatINR(summary.gross_taxable_turnover)}</strong>
              </div>
              <div className="receipt-row">
                <span>CGST</span>
                <span>{formatINR(summary.cgst)}</span>
              </div>
              <div className="receipt-row">
                <span>SGST</span>
                <span>{formatINR(summary.sgst)}</span>
              </div>
              <div className="receipt-row">
                <span>IGST</span>
                <span>{formatINR(summary.igst)}</span>
              </div>
              <div className="receipt-row total">
                <span>Total Tax Payable</span>
                <span>{formatINR(summary.total_tax_payable)}</span>
              </div>
              {summary.eligible_itc > 0 && (
                <div className="receipt-row" style={{ color: "#059669" }}>
                  <span>Eligible Input Tax Credit (ITC)</span>
                  <span>{formatINR(summary.eligible_itc)}</span>
                </div>
              )}
              {summary.blocked_itc > 0 && (
                <div className="receipt-row" style={{ color: "#dc2626" }}>
                  <span>Blocked ITC (Section 17(5))</span>
                  <span>{formatINR(summary.blocked_itc)}</span>
                </div>
              )}
            </div>

            {/* Validation & Verification Checklist */}
            <div style={{ padding: "18px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
              <h4 style={{ margin: "0 0 14px 0", fontSize: "0.95rem" }}>Validation Checklist:</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.88rem", color: summary.validations?.invoice_reconciliation ? "#059669" : "#dc2626" }}>
                  <CheckCircle2 size={18} /> Invoice reconciliation
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.88rem", color: isGstinValid ? "#059669" : "#dc2626" }}>
                  <CheckCircle2 size={18} /> GSTIN structural validation
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.88rem", color: summary.validations?.itc_validation ? "#059669" : "#dc2626" }}>
                  <CheckCircle2 size={18} /> Section 17(5) ITC blocked rules
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.88rem", color: summary.validations?.tax_calculation ? "#059669" : "#dc2626" }}>
                  <CheckCircle2 size={18} /> CGST + SGST vs IGST calculation
                </div>
              </div>

              <div style={{ marginTop: 24, paddingTop: 14, borderTop: "1px solid #e2e8f0", fontSize: "0.9rem" }}>
                <strong>Status:</strong> <span style={{ color: "#059669", fontWeight: 700, marginLeft: 6 }}>{summary.status}</span>
              </div>
            </div>
          </div>

          {/* AI Statutory Compliance & Advisory Summary */}
          {summary.ai_summary ? (
            <div
              style={{
                marginTop: 20,
                padding: "20px",
                background: "#f8fafc",
                borderRadius: 12,
                border: "1px solid #c7d2fe",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      background: "#eef2ff",
                      color: "#4338ca",
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      border: "1px solid #c7d2fe",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6
                    }}
                  >
                    <Bot size={15} /> gst-tax-compliance-agent
                  </span>
                  <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
                    Engine: <strong>Azure AI Foundry (gpt-5-mini)</strong>
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className="badge badge-success" style={{ fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <ShieldCheck size={14} /> Statutory Verified
                  </span>
                  <button
                    type="button"
                    className="button button-outline button-sm print-hide"
                    onClick={handleGenerateAISummary}
                    disabled={aiLoading}
                    title="Regenerate summary with AI agent"
                    style={{ padding: "4px 10px", fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    <RefreshCw size={13} className={aiLoading ? "spin-animation" : ""} /> Re-analyze
                  </button>
                </div>
              </div>

              {summary.agent_thought && (
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "#4338ca",
                    background: "#eef2ff",
                    padding: "8px 12px",
                    borderRadius: 6,
                    marginBottom: 12,
                  }}
                >
                  💭 <strong>Agent Reasoning:</strong> {summary.agent_thought}
                </div>
              )}

              <div
                style={{
                  fontSize: "0.92rem",
                  lineHeight: "1.65",
                  color: "#1e293b",
                  whiteSpace: "pre-line",
                  background: "#ffffff",
                  padding: "16px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                }}
              >
                {summary.ai_summary}
              </div>
            </div>
          ) : (
            /* On-Demand Button Card to Conserve Tokens */
            !aiLoading && (
              <div
                className="print-hide"
                style={{
                  marginTop: 20,
                  padding: "24px 20px",
                  background: "#f8fafc",
                  borderRadius: 12,
                  border: "1.5px dashed #c7d2fe",
                  textAlign: "center",
                }}
              >
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#4338ca", fontWeight: 700, fontSize: "1.05rem" }}>
                  <Bot size={20} /> AI Tax Compliance Summary (On Demand)
                </div>
                <p style={{ color: "#64748b", fontSize: "0.88rem", maxWidth: 620, margin: "8px auto 16px" }}>
                  Synthesize an executive statutory compliance & reconciliation summary using <strong>gst-tax-compliance-agent</strong> (Azure AI Foundry <code>gpt-5-mini</code>).
                  Tokens are only consumed when you click generate below.
                </p>
                <button
                  type="button"
                  className="button"
                  onClick={handleGenerateAISummary}
                  disabled={aiLoading}
                  style={{ padding: "10px 24px", fontSize: "0.92rem", display: "inline-flex", alignItems: "center", gap: 8, margin: "0 auto" }}
                >
                  <Sparkles size={16} /> Generate AI Compliance Summary
                </button>
              </div>
            )
          )}

          {/* Official Print Footer */}
          <div className="print-only official-print-footer" style={{ marginTop: 20, paddingTop: 12, borderTop: "1px solid #cbd5e1", fontSize: "0.8rem", color: "#64748b", justifyContent: "space-between" }}>
            <span>GSTSaathi — Enterprise Tax Compliance & Reconciliation</span>
            <span>Generated on: {new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</span>
          </div>
        </div>
      )}

      {/* Controls & Period Selector */}
      <div className="card">
        <h3>Select Return Period</h3>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end", marginTop: 14, flexWrap: "wrap" }}>
          <div className="form-group" style={{ flex: 1, minWidth: 240, margin: 0 }}>
            <label>Filing Period</label>
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="September 2026">September 2026 (Monthly Return)</option>
              <option value="August 2026">August 2026 (Monthly Return)</option>
              <option value="Q2 2026-27">Q2 2026-27 (Quarterly QRMP)</option>
            </select>
          </div>

          <button
            className="button button-outline"
            style={{ padding: "12px 20px" }}
            onClick={() => handleLoadTotals(period)}
            disabled={loading || aiLoading}
            title="Recalculate ledger totals without consuming AI tokens"
          >
            <RefreshCw size={15} className={loading ? "spin-animation" : ""} /> {loading ? "Calculating..." : "Recalculate Totals"}
          </button>
        </div>
      </div>
    </>
  );
}

// ==============================================================================
// 6. STATUTORY LEGAL ADVISOR (RETRIEVAL-AUGMENTED GENERATION - RAG)
// (Utilizes RAG grounding over statutory CGST Act provisions)
// ==============================================================================
function LegalAdvisorView() {
  const [ragQuery, setRagQuery] = useState("What are the conditions to claim ITC under Section 16?");
  const [ragResult, setRagResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const sampleQueries = [
    "What are the conditions to claim ITC under Section 16?",
    "Are food, beverages, and motor vehicles blocked from ITC under Section 17(5)?",
    "What are the turnover limits and restrictions for Composition Levy under Section 10?",
    "What interest rates apply on delayed payment under Section 50?",
    "When is an E-Way Bill mandatory under Rule 138?",
  ];

  const runRag = async (q) => {
    const query = q || ragQuery;
    if (!query.trim() || loading) return;
    try {
      setLoading(true);
      const res = await authFetch(`${API_BASE}/modules/rag/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (res.ok) setRagResult(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="header-row">
        <div>
          <h1>Statutory Tax Advisory & Legal Grounding</h1>
          <p className="subtitle">
            Retrieval-Augmented statutory legal guidance grounded directly in the Central Goods and Services Tax (CGST) Act.
          </p>
        </div>
      </div>

      {/* Agent Engine Status Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#eef2ff",
          border: "1px solid #c7d2fe",
          borderRadius: 8,
          padding: "8px 14px",
          marginBottom: 16,
          fontSize: "0.85rem",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div>
          <strong>Agent Engine:</strong> <code>gst-rag-advisory-agent</code> | <strong>Model:</strong> <code>gpt-5-mini</code>
        </div>
        <div style={{ color: "#4338ca", fontWeight: 600 }}>
          Foundry IQ: <code>gst-knowledge-base</code> | Search: <code>{ragResult?.search_service || "Azure AI Search"}</code>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3>Search Statutory Knowledge Base</h3>
        <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: 12 }}>
          Query complex GST legal questions to retrieve statutory citations with verified groundedness confidence.
        </p>

        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <input
            type="text"
            value={ragQuery}
            onChange={(e) => setRagQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runRag(ragQuery);
            }}
            placeholder="Type your statutory question..."
          />
          <button className="button" onClick={() => runRag(ragQuery)} disabled={loading}>
            {loading ? "Searching..." : "Search Legal Code"}
          </button>
        </div>

        {/* Quick Query Presets */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {sampleQueries.map((sq, i) => (
            <button
              key={i}
              type="button"
              className="chip"
              onClick={() => {
                setRagQuery(sq);
              }}
              title="Click to insert this question into the search box"
            >
              {sq}
            </button>
          ))}
        </div>
      </div>

      {!ragResult && !loading && (
        <div className="card" style={{ textAlign: "center", padding: "36px 20px", color: "#64748b" }}>
          <div style={{ color: "#4338ca", marginBottom: 10 }}>
            <Sparkles size={32} style={{ margin: "0 auto" }} />
          </div>
          <h4 style={{ margin: "0 0 6px", color: "#1e293b", fontSize: "1.05rem" }}>GST Statutory Legal Advisory Ready</h4>
          <p style={{ margin: "0 auto", fontSize: "0.88rem", maxWidth: 540 }}>
            Click <strong>"Search Legal Code"</strong> or pick one of the query presets above to consult the <code>gst-rag-advisory-agent</code> grounded in the CGST Act.
          </p>
        </div>
      )}

      {ragResult && (
        <div className="card">
          <div className="header-row">
            <div>
              <h3 style={{ margin: 0 }}>Grounded Legal Analysis</h3>
              <div style={{ color: "#64748b", fontSize: "0.8rem", marginTop: 4 }}>
                Agent: <strong>{ragResult.agent || "gst-rag-advisory-agent"}</strong> | Knowledge Base: <strong>{ragResult.knowledge_base || "gst-knowledge-base"}</strong>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {ragResult.groundedness_evaluation?.groundedness_score !== undefined && (
                <span className="badge badge-success">
                  Groundedness: {Math.round(ragResult.groundedness_evaluation.groundedness_score * 100)}%
                </span>
              )}
              {ragResult.groundedness_evaluation?.content_safety_status && (
                <span className="badge badge-primary">
                  Safety: {ragResult.groundedness_evaluation.content_safety_status}
                </span>
              )}
            </div>
          </div>

          <div className="receipt-card" style={{ marginTop: 12 }}>
            <div style={{ whiteSpace: "pre-line", fontSize: "0.9rem", lineHeight: 1.65 }}>
              {ragResult.grounded_response}
            </div>
          </div>

          {/* Source Legal Documents */}
          <div style={{ marginTop: 16 }}>
            <h4 style={{ fontSize: "0.9rem", marginBottom: 10, color: "#475569" }}>
              Statutory References Cited ({((ragResult.retrieved_statutory_context || ragResult.grounding_sources_used || []).length)} sources):
            </h4>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {(ragResult.retrieved_statutory_context || ragResult.grounding_sources_used || []).map((src, i) => (
                <div
                  key={i}
                  style={{
                    padding: "10px 14px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    fontSize: "0.84rem",
                    flex: "1 1 calc(50% - 12px)",
                    minWidth: 280,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <strong style={{ color: "#4338ca" }}>{src.section || src.id || "Statutory Provision"}</strong>
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{src.source_document || "CGST Act, 2017"}</span>
                  </div>
                  {src.title && <div style={{ fontWeight: 600, fontSize: "0.82rem", marginBottom: 4 }}>{src.title}</div>}
                  {src.excerpt && (
                    <div style={{ color: "#475569", fontSize: "0.8rem", lineHeight: 1.5 }}>
                      "{src.excerpt}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ==============================================================================
// 7. ENTERPRISE AUDIT TRAIL
// (Immutable chronological ledger tracking all application, OCR, and AI agent actions)
// ==============================================================================
function AuditView() {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterAgent, setFilterAgent] = useState("all");
  const [filterEvent, setFilterEvent] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      const res = await authFetch(`${API_BASE}/copilot/audit-logs`);
      if (res.ok) setAuditLogs(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const getEventBadgeColor = (eventType) => {
    const et = (eventType || "").toUpperCase();
    if (et.includes("OCR") || et.includes("DOCUMENT")) return { bg: "#f3e8ff", color: "#6b21a8", border: "#d8b4fe" };
    if (et.includes("RAG") || et.includes("STATUTORY")) return { bg: "#ecfdf5", color: "#065f46", border: "#a7f3d0" };
    if (et.includes("SUMMARY") || et.includes("GSTR3B")) return { bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe" };
    if (et.includes("FILED") || et.includes("SUBMIT")) return { bg: "#fffbeb", color: "#92400e", border: "#fde68a" };
    if (et.includes("OVERRIDE") || et.includes("HUMAN")) return { bg: "#fef2f2", color: "#991b1b", border: "#fecaca" };
    if (et.includes("COPILOT") || et.includes("QUERY")) return { bg: "#eef2ff", color: "#3730a3", border: "#c7d2fe" };
    return { bg: "#f1f5f9", color: "#334155", border: "#cbd5e1" };
  };

  const filteredLogs = auditLogs.filter((l) => {
    const agentMatch = filterAgent === "all" || (l.agent || "system").toLowerCase() === filterAgent.toLowerCase();
    const eventMatch = filterEvent === "all" || (l.event_type || l.action || "").toLowerCase() === filterEvent.toLowerCase();
    const term = searchTerm.toLowerCase();
    const searchMatch = !term ||
      (l.description || l.details || "").toLowerCase().includes(term) ||
      (l.reference_id || "").toLowerCase().includes(term) ||
      (l.event_type || l.action || "").toLowerCase().includes(term) ||
      (l.agent || "").toLowerCase().includes(term);
    return agentMatch && eventMatch && searchMatch;
  });

  return (
    <>
      <div className="header-row">
        <div>
          <h1>Audit Trail</h1>
          <p className="subtitle">
            Comprehensive, immutable chronological record of all invoice extractions, GST calculations, AI reasoning steps, and compliance actions.
          </p>
        </div>
        <button className="button button-outline button-sm" onClick={loadAuditLogs} disabled={loading}>
          <RefreshCw size={14} className={loading ? "spin-animation" : ""} /> {loading ? "Refreshing..." : "Refresh Trail"}
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: "2 1 260px", position: "relative" }}>
            <input
              type="text"
              placeholder="Search by action, description, or reference ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: 34 }}
            />
            <Search size={16} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          </div>

          <div style={{ flex: "1 1 180px" }}>
            <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)}>
              <option value="all">All Agents & Services</option>
              <option value="gst-tax-compliance-agent">gst-tax-compliance-agent</option>
              <option value="gst-document-ocr-agent">gst-document-ocr-agent</option>
              <option value="gst-rag-advisory-agent">gst-rag-advisory-agent</option>
              <option value="gst_ledger">gst_ledger</option>
              <option value="filing_service">filing_service</option>
              <option value="human_review">human_review</option>
            </select>
          </div>

          <div style={{ flex: "1 1 180px" }}>
            <select value={filterEvent} onChange={(e) => setFilterEvent(e.target.value)}>
              <option value="all">All Event Types</option>
              <option value="DOCUMENT_INTELLIGENCE_OCR">DOCUMENT_INTELLIGENCE_OCR</option>
              <option value="INVOICE_CREATED">INVOICE_CREATED</option>
              <option value="GSTR3B_SUMMARY_GENERATED">GSTR3B_SUMMARY_GENERATED</option>
              <option value="STATUTORY_RAG_ADVISORY">STATUTORY_RAG_ADVISORY</option>
              <option value="TAX_COPILOT_QUERY">TAX_COPILOT_QUERY</option>
              <option value="GSTR_RETURN_FILED">GSTR_RETURN_FILED</option>
              <option value="HUMAN_STATUS_OVERRIDE">HUMAN_STATUS_OVERRIDE</option>
            </select>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 12, borderTop: "1px solid #f1f5f9", fontSize: "0.82rem", color: "#64748b" }}>
          <div>
            Showing <strong>{filteredLogs.length}</strong> of <strong>{auditLogs.length}</strong> audit events
          </div>
          {(filterAgent !== "all" || filterEvent !== "all" || searchTerm) && (
            <button
              type="button"
              className="chip"
              onClick={() => { setFilterAgent("all"); setFilterEvent("all"); setSearchTerm(""); }}
              style={{ fontSize: "0.78rem", padding: "3px 10px" }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Audit Log Stream */}
      <div className="card">
        {filteredLogs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
            <FileText size={36} style={{ marginBottom: 8, opacity: 0.5 }} />
            <div>No audit events found matching the specified filters.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filteredLogs.map((log) => {
              const badgeStyle = getEventBadgeColor(log.event_type || log.action);
              return (
                <div
                  key={log.id}
                  style={{
                    padding: "14px 16px",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    background: "#ffffff",
                    transition: "box-shadow 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span
                        style={{
                          background: badgeStyle.bg,
                          color: badgeStyle.color,
                          border: `1px solid ${badgeStyle.border}`,
                          padding: "3px 8px",
                          borderRadius: 4,
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          fontFamily: "monospace",
                        }}
                      >
                        {log.event_type || log.action}
                      </span>
                      <span
                        style={{
                          background: "#f1f5f9",
                          color: "#475569",
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: "0.76rem",
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Bot size={13} /> {log.agent || "system"}
                      </span>
                      {log.reference_id && log.reference_id !== "-" && (
                        <span
                          style={{
                            background: "#eef2ff",
                            color: "#4338ca",
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: "0.76rem",
                            fontWeight: 600,
                          }}
                        >
                          Ref: {log.reference_id}
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        className="badge badge-success"
                        style={{ fontSize: "0.72rem", padding: "2px 6px" }}
                      >
                        {log.status || "success"}
                      </span>
                      <span style={{ fontSize: "0.78rem", color: "#94a3b8", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Clock size={12} /> {log.timestamp}
                      </span>
                    </div>
                  </div>

                  <div style={{ color: "#334155", fontSize: "0.88rem", lineHeight: 1.55 }}>
                    {log.description || log.details}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ==============================================================================
// 8. AUTHENTICATION (LOGIN & REGISTRATION VIEW - UI PRO MAX)
// ==============================================================================
const GST_STATE_CODES = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan",
  "09": "Uttar Pradesh", "10": "Bihar", "19": "West Bengal", "24": "Gujarat",
  "27": "Maharashtra", "29": "Karnataka", "32": "Kerala", "33": "Tamil Nadu",
  "36": "Telangana", "37": "Andhra Pradesh"
};

function LoginView({ onLoginSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError(null);

    if (isSignUp) {
      if (!username.trim() || !email.trim() || !password.trim()) {
        setError("Please enter your Username, Email, and Password.");
        return;
      }
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: username.trim().toLowerCase(),
            email: email.trim(),
            password: password.trim(),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          onLoginSuccess(data.user, data.token);
        } else {
          const errData = await res.json().catch(() => ({}));
          setError(errData.detail || "Registration failed. Please check your details.");
        }
      } catch (err) {
        console.error(err);
        setError("Network error: Unable to connect to authentication server.");
      } finally {
        setLoading(false);
      }
    } else {
      if (!identifier.trim() || !password.trim()) {
        setError("Please enter your registered email or username, and password.");
        return;
      }
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: identifier.trim(), password }),
        });
        if (res.ok) {
          const data = await res.json();
          onLoginSuccess(data.user, data.token);
        } else {
          const errData = await res.json().catch(() => ({}));
          setError(errData.detail || "Invalid username/email or password.");
        }
      } catch (err) {
        console.error(err);
        setError("Network error: Unable to connect to authentication server.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="auth-viewport">
      <div className="auth-container">
        {/* LEFT ENTERPRISE SHOWCASE PANE */}
        <div className="auth-showcase-pane">
          <div className="auth-showcase-glow" />

          <div>
            {/* Branding Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
              <img
                src="/gstsaathilogo.jpeg"
                alt="GSTSaathi Logo"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  objectFit: "cover",
                  boxShadow: "0 8px 16px rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.2)"
                }}
              />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h2 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0, color: "#ffffff", letterSpacing: "-0.02em" }}>
                    GSTSaathi
                  </h2>
                  <span
                    style={{
                      background: "rgba(99, 102, 241, 0.25)",
                      color: "#a5b4fc",
                      border: "1px solid rgba(165, 180, 252, 0.3)",
                      padding: "2px 8px",
                      borderRadius: "12px",
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase"
                    }}
                  >
                    v1.0 Enterprise
                  </span>
                </div>
                <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: 2 }}>
                  Autonomous Tax Intelligence & Statutory Compliance
                </div>
              </div>
            </div>

            {/* Value Proposition Highlights */}
            <div style={{ marginTop: 28 }}>
              <div className="auth-feature-card">
                <div style={{ background: "rgba(99, 102, 241, 0.2)", padding: 8, borderRadius: 8, color: "#818cf8" }}>
                  <Sparkles size={18} />
                </div>
                <div>
                  <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "#f8fafc" }}>
                    Multi-Invoice Document OCR
                  </div>
                  <div style={{ fontSize: "0.76rem", color: "#94a3b8", marginTop: 2 }}>
                    Ingest single and multi-page PDFs with automatic line-item parsing via Azure AI.
                  </div>
                </div>
              </div>

              <div className="auth-feature-card">
                <div style={{ background: "rgba(16, 185, 129, 0.2)", padding: 8, borderRadius: 8, color: "#34d399" }}>
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "#f8fafc" }}>
                    Statutory CGST RAG Grounding
                  </div>
                  <div style={{ fontSize: "0.76rem", color: "#94a3b8", marginTop: 2 }}>
                    Verified legal answers grounded in CGST Act 2017 with official section citations.
                  </div>
                </div>
              </div>

              <div className="auth-feature-card">
                <div style={{ background: "rgba(56, 189, 248, 0.2)", padding: 8, borderRadius: 8, color: "#38bdf8" }}>
                  <Download size={18} />
                </div>
                <div>
                  <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "#f8fafc" }}>
                    GSTN Portal Ready JSON Export
                  </div>
                  <div style={{ fontSize: "0.76rem", color: "#94a3b8", marginTop: 2 }}>
                    One-click export of reconciled GSTR-3B filings formatted for official GST portal upload.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trust Badge Footer */}
          <div style={{ paddingTop: 20, borderTop: "1px solid rgba(255, 255, 255, 0.1)", display: "flex", alignItems: "center", gap: 10 }}>
            <CheckCircle2 size={16} color="#34d399" />
            <span style={{ fontSize: "0.74rem", color: "#94a3b8" }}>
              Enterprise Grade • Azure AI Foundry Powered • 256-bit Security
            </span>
          </div>
        </div>

        {/* RIGHT AUTH FORM PANE */}
        <div className="auth-form-pane">
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>
              {isSignUp ? "Create Enterprise Account" : "Sign In to GSTSaathi"}
            </h3>
            <p style={{ color: "#64748b", fontSize: "0.86rem", marginTop: 6 }}>
              {isSignUp
                ? "Register with your username, email, and password. Add your GSTIN anytime from your profile."
                : "Enter your registered username or email to access your tax ledger and filings."}
            </p>
          </div>

          {/* Segmented Switcher Tabs */}
          <div
            style={{
              display: "flex",
              background: "#f1f5f9",
              borderRadius: 10,
              padding: 4,
              marginBottom: 24,
              border: "1px solid #e2e8f0"
            }}
          >
            <button
              type="button"
              className="auth-tab-btn"
              style={{
                background: !isSignUp ? "#ffffff" : "transparent",
                color: !isSignUp ? "#4338ca" : "#64748b",
                boxShadow: !isSignUp ? "0 2px 5px rgba(0,0,0,0.06)" : "none",
              }}
              onClick={() => {
                setIsSignUp(false);
                setError(null);
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className="auth-tab-btn"
              style={{
                background: isSignUp ? "#ffffff" : "transparent",
                color: isSignUp ? "#4338ca" : "#64748b",
                boxShadow: isSignUp ? "0 2px 5px rgba(0,0,0,0.06)" : "none",
              }}
              onClick={() => {
                setIsSignUp(true);
                setError(null);
              }}
            >
              Register (Sign Up)
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              className="alert alert-danger"
              style={{
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: "0.85rem"
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {isSignUp ? (
              <>
                {/* Username Field */}
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Account Username
                  </label>
                  <div className="auth-input-wrapper">
                    <User size={16} className="auth-input-icon" />
                    <input
                      type="text"
                      className="auth-input-field"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                      placeholder="e.g. jdoe_enterprise"
                      required={isSignUp}
                    />
                  </div>
                </div>

                {/* Email Field */}
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Taxpayer Email Address
                  </label>
                  <div className="auth-input-wrapper">
                    <Mail size={16} className="auth-input-icon" />
                    <input
                      type="email"
                      className="auth-input-field"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. name@company.com"
                      required
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Email or Username Field */}
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                    Email Address or Username
                  </label>
                  <div className="auth-input-wrapper">
                    <Mail size={16} className="auth-input-icon" />
                    <input
                      type="text"
                      className="auth-input-field"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Username or email address"
                      required
                    />
                  </div>
                </div>
              </>
            )}

            {/* Password Field with Show/Hide Toggle */}
            <div className="form-group" style={{ marginBottom: 22 }}>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                Account Password
              </label>
              <div className="auth-input-wrapper">
                <Lock size={16} className="auth-input-icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  className="auth-input-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your account password"
                  required
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Primary Submit Button */}
            <button
              type="submit"
              className="button"
              style={{
                width: "100%",
                padding: "13px",
                fontSize: "0.94rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                borderRadius: 10,
                background: "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)",
                boxShadow: "0 4px 12px rgba(79, 70, 229, 0.25)"
              }}
              disabled={loading}
            >
              {loading ? (
                <span>{isSignUp ? "Creating Enterprise Account..." : "Signing in..."}</span>
              ) : (
                <>
                  <span>{isSignUp ? "Create Account & Sign In" : "Sign In to GSTSaathi"}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ==============================================================================
// 8.1 USER PROFILE & GSTIN CONFIGURATION VIEW
// ==============================================================================
function ProfileView({ currentUser, onUserUpdate, onLogout }) {
  const [profileData, setProfileData] = useState(null);
  const [name, setName] = useState(currentUser?.name || "");
  const [gstin, setGstin] = useState(currentUser?.gstin || "");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  const isGstinValid = gstin.trim() ? GSTIN_REGEX.test(gstin.trim().toUpperCase()) : false;
  const gstinState = gstin.length >= 2 ? (GST_STATE_CODES[gstin.slice(0, 2)] || `State Code ${gstin.slice(0, 2)}`) : null;

  const loadProfile = async () => {
    try {
      const res = await authFetch(`${API_BASE}/profile`);
      if (res.ok) {
        const data = await res.json();
        setProfileData(data);
        if (data.user) {
          setName(data.user.name || "");
          setGstin(data.user.gstin || "");
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    setMessage(null);
    setError(null);

    const cleanGstin = gstin.trim().toUpperCase();
    if (cleanGstin && !isGstinValid) {
      setError("Please enter a valid 15-digit GSTIN (e.g. 07BBBBB1111B2Z3) or leave it blank.");
      return;
    }

    try {
      setSaving(true);
      const res = await authFetch(`${API_BASE}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          gstin: cleanGstin || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        onUserUpdate(updated);
        localStorage.setItem("gstsaathi_user", JSON.stringify(updated));
        setMessage("Business profile and GSTIN updated successfully!");
        loadProfile();
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.detail || "Failed to update profile.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error: Unable to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleClearData = async () => {
    if (!window.confirm("Are you sure you want to permanently clear all your ledger invoices and return filings? This cannot be undone.")) {
      return;
    }
    try {
      setClearing(true);
      setMessage(null);
      setError(null);
      const res = await authFetch(`${API_BASE}/profile/data`, { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        setMessage(data.message || "Ledger data cleared successfully.");
        loadProfile();
      } else {
        setError("Failed to clear ledger data.");
      }
    } catch (e) {
      console.error(e);
      setError("Network error while clearing data.");
    } finally {
      setClearing(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("WARNING: Are you sure you want to permanently delete your account and all associated invoices? You will be immediately logged out.")) {
      return;
    }
    try {
      setDeleting(true);
      const res = await authFetch(`${API_BASE}/profile/account`, { method: "DELETE" });
      if (res.ok) {
        alert("Your account and all associated data have been permanently deleted.");
        onLogout();
      } else {
        setError("Failed to delete account.");
      }
    } catch (e) {
      console.error(e);
      setError("Network error while deleting account.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 800 }}>Taxpayer Profile & Settings</h1>
          <p style={{ color: "#64748b", fontSize: "0.9rem", marginTop: 4 }}>
            Manage your business credentials, 15-digit GSTIN, and account data privacy.
          </p>
        </div>
      </div>

      {message && (
        <div className="alert alert-success" style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle2 size={18} />
          <div>{message}</div>
        </div>
      )}

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertCircle size={18} />
          <div>{error}</div>
        </div>
      )}

      {/* Account Overview Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="card stat-card">
          <div className="stat-header">
            <span className="stat-label">Active GSTIN</span>
            <Building2 size={18} color="#4f46e5" />
          </div>
          <div className="stat-value" style={{ fontSize: "1.15rem", fontFamily: "monospace" }}>
            {currentUser?.gstin || "Not Configured"}
          </div>
          <div className="stat-sub">{currentUser?.name || currentUser?.username || "Enterprise"}</div>
        </div>

        <div className="card stat-card">
          <div className="stat-header">
            <span className="stat-label">Total Invoices</span>
            <FileText size={18} color="#059669" />
          </div>
          <div className="stat-value">{profileData?.total_invoices ?? 0}</div>
          <div className="stat-sub">Isolated to this account</div>
        </div>

        <div className="card stat-card">
          <div className="stat-header">
            <span className="stat-label">Recorded Turnover</span>
            <TrendingUp size={18} color="#0284c7" />
          </div>
          <div className="stat-value">{formatINR(profileData?.total_taxable_amount || 0)}</div>
          <div className="stat-sub">Cumulative base value</div>
        </div>

        <div className="card stat-card">
          <div className="stat-header">
            <span className="stat-label">Tax Liability</span>
            <CalcIcon size={18} color="#d97706" />
          </div>
          <div className="stat-value">{formatINR(profileData?.total_tax_liability || 0)}</div>
          <div className="stat-sub">CGST + SGST + IGST</div>
        </div>
      </div>

      {/* Profile & GSTIN Settings Form */}
      <div className="card" style={{ padding: "28px 30px", marginBottom: 24 }}>
        <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
          <Building2 size={18} color="#4338ca" /> Business Details & Statutory GSTIN
        </h3>
        <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: 20 }}>
          Add your 15-digit GSTIN so your OCR invoices, ledger reconciliation, and GSTR filings use your official tax identification.
        </p>

        <form onSubmit={handleSaveProfile}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 18 }}>
            <div className="form-group">
              <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#334155" }}>
                Username (Account Identifier)
              </label>
              <input
                type="text"
                value={currentUser?.username || "taxpayer"}
                disabled
                style={{ background: "#f8fafc", color: "#64748b", cursor: "not-allowed" }}
              />
            </div>

            <div className="form-group">
              <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#334155" }}>
                Email Address
              </label>
              <input
                type="email"
                value={currentUser?.email || ""}
                disabled
                style={{ background: "#f8fafc", color: "#64748b", cursor: "not-allowed" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
            <div className="form-group">
              <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#334155" }}>
                Business / Taxpayer Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Apex Retail Enterprises"
              />
            </div>

            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#334155" }}>
                  15-Digit GSTIN
                </label>
                <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                  {gstin.length}/15 chars
                </span>
              </div>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                placeholder="e.g. 07BBBBB1111B2Z3"
                maxLength={15}
                style={{ textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "monospace" }}
              />
              {gstin.length > 0 && (
                <div style={{ marginTop: 6, fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 6 }}>
                  {isGstinValid ? (
                    <span style={{ color: "#059669", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                      <CheckCircle2 size={13} /> Valid GSTIN ({gstinState} • PAN: {gstin.slice(2, 12)})
                    </span>
                  ) : gstin.length === 15 ? (
                    <span style={{ color: "#dc2626", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                      <AlertCircle size={13} /> Invalid pattern (Expected 2 State Digits + 10 PAN + 3 Check chars)
                    </span>
                  ) : (
                    <span style={{ color: "#64748b" }}>
                      Enter 15 characters {gstinState ? `(${gstinState})` : ""}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="button"
            disabled={saving}
            style={{ padding: "10px 22px", fontSize: "0.88rem", fontWeight: 600 }}
          >
            {saving ? "Saving Changes..." : "Save Business Profile"}
          </button>
        </form>
      </div>

      {/* Data & Privacy Controls (Danger Zone) */}
      <div className="card" style={{ padding: "28px 30px", border: "1px solid #fee2e2", background: "#fff" }}>
        <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#dc2626", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertCircle size={18} color="#dc2626" /> Data Privacy & Account Controls
        </h3>
        <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: 20 }}>
          Manage your data retention. You can clear your ledger entries while keeping your account, or permanently delete your account.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Clear Data Row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px",
              background: "#f8fafc",
              borderRadius: 10,
              border: "1px solid #e2e8f0"
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#0f172a" }}>Clear Ledger Invoices & Filings</div>
              <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: 2 }}>
                Permanently purge all uploaded invoices, extracted data, and return drafts for your account.
              </div>
            </div>
            <button
              type="button"
              className="button button-outline button-sm"
              onClick={handleClearData}
              disabled={clearing}
              style={{ color: "#d97706", borderColor: "#fde68a", whiteSpace: "nowrap" }}
            >
              {clearing ? "Clearing..." : "Delete Ledger Data"}
            </button>
          </div>

          {/* Delete Account Row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px",
              background: "#fef2f2",
              borderRadius: 10,
              border: "1px solid #fecaca"
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#991b1b" }}>Delete Entire Account</div>
              <div style={{ fontSize: "0.78rem", color: "#b91c1c", marginTop: 2 }}>
                Permanently delete your user credentials and all associated invoices. This cannot be undone.
              </div>
            </div>
            <button
              type="button"
              className="button button-sm"
              onClick={handleDeleteAccount}
              disabled={deleting}
              style={{ background: "#dc2626", borderColor: "#dc2626", color: "#ffffff", whiteSpace: "nowrap" }}
            >
              {deleting ? "Deleting..." : "Delete Account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 404 Fallback
function NotFound() {
  return (
    <div style={{ textAlign: "center", padding: 60 }}>
      <h1>404 - Page Not Found</h1>
      <Link className="button" to="/" style={{ marginTop: 16 }}>
        Return to Dashboard
      </Link>
    </div>
  );
}

// ==============================================================================
// 9. ROOT ROUTING & SESSION MANAGEMENT
// ==============================================================================
export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem("gstsaathi_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleLoginSuccess = (user, token) => {
    setCurrentUser(user);
    try {
      localStorage.setItem("gstsaathi_user", JSON.stringify(user));
      if (token) localStorage.setItem("gstsaathi_token", token);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = async () => {
    try {
      await authFetch(`${API_BASE}/auth/logout`, { method: "POST" });
    } catch (err) {
      console.error("Logout error:", err);
    }
    setCurrentUser(null);
    try {
      localStorage.removeItem("gstsaathi_user");
      localStorage.removeItem("gstsaathi_token");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Routes>
      <Route
        path="/login"
        element={
          currentUser ? (
            <Navigate to="/" replace />
          ) : (
            <LoginView onLoginSuccess={handleLoginSuccess} />
          )
        }
      />
      <Route
        path="/*"
        element={
          !currentUser ? (
            <Navigate to="/login" replace />
          ) : (
            <Layout currentUser={currentUser} onLogout={handleLogout}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/calculator" element={<Calculator />} />
                <Route path="/copilot" element={<AgentView />} />
                {/* Alias /agent to /copilot for backward compatibility */}
                <Route path="/agent" element={<Navigate to="/copilot" replace />} />
                <Route path="/filing" element={<FilingView currentUser={currentUser} />} />
                <Route path="/advisor" element={<LegalAdvisorView />} />
                <Route path="/audit" element={<AuditView />} />
                <Route path="/profile" element={<ProfileView currentUser={currentUser} onUserUpdate={(u) => setCurrentUser(u)} onLogout={handleLogout} />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
          )
        }
      />
    </Routes>
  );
}


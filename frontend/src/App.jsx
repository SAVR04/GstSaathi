import React, { useState, useEffect, useRef } from "react";
import { Link, Route, Routes, useLocation, useNavigate } from "react-router-dom";
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
  Plus,
  Send,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Clock,
  ShieldCheck,
  Building2,
  ExternalLink
} from "lucide-react";

// API Base URL config
const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

// Currency formatter for Indian Rupees
function formatINR(val) {
  if (val === undefined || val === null || isNaN(val)) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(val);
}

// ---------------------------------------------------------
// Navigation & Layout
// ---------------------------------------------------------
function Layout({ children }) {
  const location = useLocation();
  const [backendAlive, setBackendAlive] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/invoices/stats`)
      .then((res) => setBackendAlive(res.ok))
      .catch(() => setBackendAlive(false));
  }, [location.pathname]);

  const navItems = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/upload", label: "Upload Invoice", icon: UploadCloud },
    { to: "/calculator", label: "GST Calculator", icon: CalcIcon },
    { to: "/assistant", label: "AI Assistant", icon: Bot },
    { to: "/review", label: "Filing Review", icon: FileCheck },
    { to: "/azure-modules", label: "AI-103 Azure Modules", icon: Sparkles },
    { to: "/audit", label: "Responsible AI Logs", icon: ShieldCheck },
  ];

  return (
    <div className="app">
      <aside className="sidebar">
        <div>
          <div className="brand">
            <div className="brand-icon">₹</div>
            <div>
              <div className="brand-title">GST Copilot</div>
              <span className="brand-badge">Smart Tax OS</span>
            </div>
          </div>

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

        <div className="sidebar-footer">
          <div className="status-indicator">
            <span
              className="dot"
              style={{ background: backendAlive ? "#059669" : "#dc2626" }}
            />
            <span>{backendAlive ? "Backend Connected" : "Backend Offline"}</span>
          </div>
          <p style={{ marginTop: 8, fontSize: "0.75rem", color: "#94a3b8" }}>
            FastAPI + SQLite Active
          </p>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}

// ---------------------------------------------------------
// 1. Dashboard View
// ---------------------------------------------------------
function Dashboard() {
  const [stats, setStats] = useState({
    total_invoices: 0,
    processed: 0,
    pending_review: 0,
    total_sales: 0,
    total_tax: 0,
  });
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsRes, invRes] = await Promise.all([
        fetch(`${API_BASE}/invoices/stats`),
        fetch(`${API_BASE}/invoices`),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (invRes.ok) setInvoices(await invRes.json());
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/invoices/${id}`, { method: "DELETE" });
      if (res.ok) {
        loadData();
      }
    } catch (err) {
      console.error("Failed to delete invoice", err);
    }
  };

  return (
    <>
      <div className="header-row">
        <div>
          <h1>GST Intelligence Dashboard</h1>
          <p className="subtitle">
            Real-time compliance monitoring, invoice ledger, and tax liabilities.
          </p>
        </div>
        <button className="button button-outline button-sm" onClick={loadData}>
          <RefreshCw size={14} /> Refresh Data
        </button>
      </div>

      <div className="grid-4">
        <div className="card stat-card">
          <div className="stat-header">
            <span>Total Invoices</span>
            <div className="stat-icon" style={{ background: "#eef2ff", color: "#4338ca" }}>
              <FileText size={18} />
            </div>
          </div>
          <div className="stat-value">{stats.total_invoices}</div>
          <div className="stat-subtext">Recorded in ledger</div>
        </div>

        <div className="card stat-card">
          <div className="stat-header">
            <span>Processed</span>
            <div className="stat-icon" style={{ background: "#ecfdf5", color: "#059669" }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="stat-value">{stats.processed}</div>
          <div className="stat-subtext">Verified & parsed</div>
        </div>

        <div className="card stat-card">
          <div className="stat-header">
            <span>Pending Review</span>
            <div className="stat-icon" style={{ background: "#fffbeb", color: "#d97706" }}>
              <Clock size={18} />
            </div>
          </div>
          <div className="stat-value">{stats.pending_review}</div>
          <div className="stat-subtext">Needs approval</div>
        </div>

        <div className="card stat-card">
          <div className="stat-header">
            <span>Total Tax Liability</span>
            <div className="stat-icon" style={{ background: "#f5f3ff", color: "#7c3aed" }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="stat-value">{formatINR(stats.total_tax)}</div>
          <div className="stat-subtext">On {formatINR(stats.total_sales)} sales</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h2>Quick Actions</h2>
        <p style={{ color: "#64748b", marginBottom: 14, fontSize: "0.9rem" }}>
          Execute compliance workflows with AI assistance and automated calculations.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link className="button" to="/upload">
            <UploadCloud size={16} /> Upload New Invoice
          </Link>
          <Link className="button button-outline" to="/calculator">
            <CalcIcon size={16} /> GST Tax Calculator
          </Link>
          <Link className="button button-outline" to="/assistant">
            <Bot size={16} /> Ask AI Copilot
          </Link>
          <Link className="button button-outline" to="/review">
            <FileCheck size={16} /> Review Filing Totals
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="header-row" style={{ marginBottom: 16 }}>
          <h2>Recent Invoice Ledger</h2>
          <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
            Showing {invoices.length} invoices
          </span>
        </div>

        {loading ? (
          <p style={{ color: "#94a3b8", padding: 20, textAlign: "center" }}>
            Loading ledger...
          </p>
        ) : invoices.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <FileText size={40} color="#cbd5e1" style={{ marginBottom: 10 }} />
            <p style={{ color: "#64748b" }}>No invoices found in database.</p>
            <Link className="button button-sm" to="/upload" style={{ marginTop: 12 }}>
              Upload Your First Invoice
            </Link>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Seller GSTIN</th>
                  <th>Buyer GSTIN</th>
                  <th>Taxable Amt</th>
                  <th>Rate</th>
                  <th>Tax Breakdown</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <strong>{inv.invoice_number}</strong>
                    </td>
                    <td><code style={{ fontSize: "0.8rem" }}>{inv.seller_gstin}</code></td>
                    <td><code style={{ fontSize: "0.8rem" }}>{inv.buyer_gstin}</code></td>
                    <td>{formatINR(inv.taxable_amount)}</td>
                    <td>{inv.gst_rate}%</td>
                    <td style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      {inv.igst > 0 ? (
                        <span>IGST: {formatINR(inv.igst)}</span>
                      ) : (
                        <span>CGST: {formatINR(inv.cgst)} | SGST: {formatINR(inv.sgst)}</span>
                      )}
                    </td>
                    <td>
                      <strong>{formatINR(inv.total_amount)}</strong>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          inv.status === "processed"
                            ? "badge-success"
                            : "badge-warning"
                        }`}
                      >
                        {inv.status.replace("_", " ")}
                      </span>
                    </td>
                    <td>
                      <button
                        className="button button-danger button-sm"
                        onClick={() => handleDelete(inv.id)}
                        title="Delete invoice"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------
// 2. Invoice Upload View
// ---------------------------------------------------------
function Upload() {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extractedInvoice, setExtractedInvoice] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const fileInputRef = useRef(null);

  // Manual Form State
  const [manualForm, setManualForm] = useState({
    invoice_number: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    taxable_amount: 15000,
    gst_rate: 18,
    transaction_type: "intra_state",
    seller_gstin: "27AABCU9603R1ZM",
    buyer_gstin: "07AAAAA0000A1Z5",
  });

  const loadRecent = async () => {
    try {
      const res = await fetch(`${API_BASE}/invoices`);
      if (res.ok) {
        const list = await res.json();
        setRecentInvoices(list.slice(0, 5));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadRecent();
  }, []);

  const handleFileUpload = async (file) => {
    if (!file) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE}/invoices/upload`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setExtractedInvoice(data);
        loadRecent();
      } else {
        alert("Upload processing failed");
      }
    } catch (err) {
      console.error(err);
      alert("Error uploading file");
    } finally {
      setUploading(false);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    try {
      setUploading(true);
      const res = await fetch(`${API_BASE}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...manualForm,
          taxable_amount: parseFloat(manualForm.taxable_amount),
          gst_rate: parseFloat(manualForm.gst_rate),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setExtractedInvoice(data);
        loadRecent();
        // Reset invoice number for next
        setManualForm({
          ...manualForm,
          invoice_number: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="header-row">
        <div>
          <h1>Invoice Ingestion & Extraction</h1>
          <p className="subtitle">
            Upload tax invoices (PDF, JPG, PNG) for automated OCR parsing and ledger entry.
          </p>
        </div>
        <button
          className="button button-outline button-sm"
          onClick={() => setManualMode(!manualMode)}
        >
          {manualMode ? "Switch to File Upload" : "Enter Manually"}
        </button>
      </div>

      <div className="grid-2">
        {/* Left Column: Upload / Manual Entry Form */}
        <div>
          {!manualMode ? (
            <div className="card">
              <h3>Upload Invoice Document</h3>
              <p style={{ color: "#64748b", fontSize: "0.88rem", marginBottom: 16 }}>
                Drop an invoice or select a file to simulate automated parsing and tax extraction.
              </p>

              <div
                className={`dropzone ${dragOver ? "dragover" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current.click()}
              >
                <div className="dropzone-icon">
                  <UploadCloud size={28} />
                </div>
                <div>
                  <strong style={{ fontSize: "1rem" }}>
                    Click to browse or drag & drop invoice
                  </strong>
                  <p style={{ color: "#94a3b8", fontSize: "0.82rem", marginTop: 4 }}>
                    Supported: PDF, JPG, JPEG, PNG (Max 15MB)
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: "none" }}
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
              </div>

              {uploading && (
                <div style={{ textAlign: "center", padding: "16px 0", color: "#4338ca" }}>
                  <RefreshCw className="spin" size={18} style={{ marginRight: 8 }} />
                  Simulating OCR and parsing tax metadata...
                </div>
              )}
            </div>
          ) : (
            <div className="card">
              <h3>Manual Invoice Entry</h3>
              <p style={{ color: "#64748b", fontSize: "0.88rem", marginBottom: 16 }}>
                Directly add an invoice to the GST ledger.
              </p>
              <form onSubmit={handleManualSubmit}>
                <div className="form-group">
                  <label>Invoice Number</label>
                  <input
                    type="text"
                    required
                    value={manualForm.invoice_number}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, invoice_number: e.target.value })
                    }
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="form-group">
                    <label>Seller GSTIN</label>
                    <input
                      type="text"
                      value={manualForm.seller_gstin}
                      onChange={(e) =>
                        setManualForm({ ...manualForm, seller_gstin: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Buyer GSTIN</label>
                    <input
                      type="text"
                      value={manualForm.buyer_gstin}
                      onChange={(e) =>
                        setManualForm({ ...manualForm, buyer_gstin: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="form-group">
                    <label>Taxable Value (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={manualForm.taxable_amount}
                      onChange={(e) =>
                        setManualForm({ ...manualForm, taxable_amount: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>GST Rate (%)</label>
                    <select
                      value={manualForm.gst_rate}
                      onChange={(e) =>
                        setManualForm({ ...manualForm, gst_rate: e.target.value })
                      }
                    >
                      <option value="0">0% (Exempt)</option>
                      <option value="5">5% (Essential)</option>
                      <option value="12">12% (Standard I)</option>
                      <option value="18">18% (Standard II)</option>
                      <option value="28">28% (Luxury)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Transaction Type</label>
                  <div className="radio-group">
                    <div
                      className={`radio-card ${
                        manualForm.transaction_type === "intra_state" ? "selected" : ""
                      }`}
                      onClick={() =>
                        setManualForm({ ...manualForm, transaction_type: "intra_state" })
                      }
                    >
                      <span>Intra-State (CGST + SGST)</span>
                    </div>
                    <div
                      className={`radio-card ${
                        manualForm.transaction_type === "inter_state" ? "selected" : ""
                      }`}
                      onClick={() =>
                        setManualForm({ ...manualForm, transaction_type: "inter_state" })
                      }
                    >
                      <span>Inter-State (IGST)</span>
                    </div>
                  </div>
                </div>

                <button type="submit" className="button" style={{ width: "100%", marginTop: 8 }}>
                  <Plus size={16} /> Save Invoice to Ledger
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right Column: Extracted Invoice Preview */}
        <div>
          {extractedInvoice ? (
            <div className="card">
              <div className="header-row" style={{ marginBottom: 12 }}>
                <h3>Extracted Tax Invoice</h3>
                <span className="badge badge-success">
                  <CheckCircle2 size={13} /> {extractedInvoice.status}
                </span>
              </div>

              <div className="alert alert-success">
                <CheckCircle2 size={18} />
                <div>
                  <strong>Successfully Parsed & Saved!</strong>
                  <div style={{ fontSize: "0.82rem" }}>
                    Invoice record #{extractedInvoice.id} committed to database.
                  </div>
                </div>
              </div>

              <div className="receipt-card">
                <div className="receipt-row">
                  <span>Invoice Number</span>
                  <strong>{extractedInvoice.invoice_number}</strong>
                </div>
                <div className="receipt-row">
                  <span>Seller GSTIN</span>
                  <code>{extractedInvoice.seller_gstin}</code>
                </div>
                <div className="receipt-row">
                  <span>Buyer GSTIN</span>
                  <code>{extractedInvoice.buyer_gstin}</code>
                </div>
                <div className="receipt-row">
                  <span>Taxable Base</span>
                  <span>{formatINR(extractedInvoice.taxable_amount)}</span>
                </div>
                <div className="receipt-row">
                  <span>Applied GST Rate</span>
                  <span>{extractedInvoice.gst_rate}%</span>
                </div>
                {extractedInvoice.igst > 0 ? (
                  <div className="receipt-row">
                    <span>IGST (Integrated Tax)</span>
                    <span>{formatINR(extractedInvoice.igst)}</span>
                  </div>
                ) : (
                  <>
                    <div className="receipt-row">
                      <span>CGST (Central Tax)</span>
                      <span>{formatINR(extractedInvoice.cgst)}</span>
                    </div>
                    <div className="receipt-row">
                      <span>SGST (State Tax)</span>
                      <span>{formatINR(extractedInvoice.sgst)}</span>
                    </div>
                  </>
                )}
                <div className="receipt-row total">
                  <span>Total Payable</span>
                  <span>{formatINR(extractedInvoice.total_amount)}</span>
                </div>
              </div>

              <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
                <Link to="/review" className="button button-outline" style={{ flex: 1 }}>
                  Go to Filing Review
                </Link>
                <button
                  className="button"
                  style={{ flex: 1 }}
                  onClick={() => setExtractedInvoice(null)}
                >
                  Upload Another
                </button>
              </div>
            </div>
          ) : (
            <div className="card">
              <h3>Recently Uploaded Invoices</h3>
              <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: 14 }}>
                Latest invoices recorded in your SQLite database.
              </p>
              {recentInvoices.length === 0 ? (
                <p style={{ color: "#94a3b8" }}>No invoices yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {recentInvoices.map((inv) => (
                    <div
                      key={inv.id}
                      style={{
                        padding: "12px 14px",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <strong>{inv.invoice_number}</strong>
                        <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                          Rate: {inv.gst_rate}% | GSTIN: {inv.seller_gstin.slice(0, 5)}...
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <strong>{formatINR(inv.total_amount)}</strong>
                        <div style={{ fontSize: "0.75rem", color: "#059669" }}>
                          {inv.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------
// 3. GST Calculator View
// ---------------------------------------------------------
function Calculator() {
  const [taxableAmount, setTaxableAmount] = useState(25000);
  const [gstRate, setGstRate] = useState(18);
  const [transactionType, setTransactionType] = useState("intra_state");
  const [cess, setCess] = useState(0);
  const [calcResult, setCalcResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const rates = [0, 5, 12, 18, 28];

  const calculateGST = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/gst/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taxable_amount: parseFloat(taxableAmount) || 0,
          gst_rate: parseFloat(gstRate) || 0,
          transaction_type: transactionType,
          cess: parseFloat(cess) || 0,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCalcResult(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateGST();
  }, [taxableAmount, gstRate, transactionType, cess]);

  return (
    <>
      <div className="header-row">
        <div>
          <h1>GST Calculation Engine</h1>
          <p className="subtitle">
            Calculate accurate CGST, SGST, IGST, and Cess for any taxable supply.
          </p>
        </div>
      </div>

      <div className="grid-2">
        {/* Left Card: Input Parameters */}
        <div className="card">
          <h2>Calculation Parameters</h2>

          <div className="form-group">
            <label>Taxable Amount (₹)</label>
            <input
              type="number"
              min="0"
              step="100"
              value={taxableAmount}
              onChange={(e) => setTaxableAmount(e.target.value)}
              placeholder="e.g. 50000"
            />
          </div>

          <div className="form-group">
            <label>Select GST Tax Slab</label>
            <div className="rate-pill-group">
              {rates.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`rate-pill ${gstRate === r ? "active" : ""}`}
                  onClick={() => setGstRate(r)}
                >
                  {r}% {r === 0 ? "(Exempt)" : ""}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Transaction Nature</label>
            <div className="radio-group">
              <div
                className={`radio-card ${transactionType === "intra_state" ? "selected" : ""}`}
                onClick={() => setTransactionType("intra_state")}
              >
                <span>Intra-State (Within State: CGST + SGST)</span>
              </div>
              <div
                className={`radio-card ${transactionType === "inter_state" ? "selected" : ""}`}
                onClick={() => setTransactionType("inter_state")}
              >
                <span>Inter-State (Outside State: IGST)</span>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Compensation Cess (₹ Optional)</label>
            <input
              type="number"
              min="0"
              value={cess}
              onChange={(e) => setCess(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Right Card: Real-Time Results Breakdown */}
        <div className="card">
          <h2>Tax Summary Breakdown</h2>
          <p style={{ color: "#64748b", fontSize: "0.88rem", marginBottom: 14 }}>
            Computed via backend <code>POST /api/v1/gst/calculate</code>
          </p>

          {calcResult ? (
            <div>
              <div className="receipt-card">
                <div className="receipt-row">
                  <span>Taxable Base Value</span>
                  <strong>{formatINR(taxableAmount)}</strong>
                </div>
                <div className="receipt-row">
                  <span>Applied Slab</span>
                  <span>{gstRate}%</span>
                </div>

                {transactionType === "intra_state" ? (
                  <>
                    <div className="receipt-row">
                      <span>CGST (Central Tax @ {gstRate / 2}%)</span>
                      <span style={{ color: "#4338ca", fontWeight: 600 }}>
                        {formatINR(calcResult.cgst)}
                      </span>
                    </div>
                    <div className="receipt-row">
                      <span>SGST (State Tax @ {gstRate / 2}%)</span>
                      <span style={{ color: "#4338ca", fontWeight: 600 }}>
                        {formatINR(calcResult.sgst)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="receipt-row">
                    <span>IGST (Integrated Tax @ {gstRate}%)</span>
                    <span style={{ color: "#4338ca", fontWeight: 600 }}>
                      {formatINR(calcResult.igst)}
                    </span>
                  </div>
                )}

                {parseFloat(cess) > 0 && (
                  <div className="receipt-row">
                    <span>Compensation Cess</span>
                    <span>{formatINR(cess)}</span>
                  </div>
                )}

                <div className="receipt-row">
                  <span>Total Tax Amount</span>
                  <strong>{formatINR(calcResult.gst + (parseFloat(cess) || 0))}</strong>
                </div>

                <div className="receipt-row total">
                  <span>Grand Total (Invoice Value)</span>
                  <span>{formatINR(calcResult.total)}</span>
                </div>
              </div>

              <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
                <Link to="/assistant" className="button button-outline" style={{ flex: 1 }}>
                  <Bot size={15} /> Ask Rules on this Slab
                </Link>
                <Link to="/upload" className="button" style={{ flex: 1 }}>
                  <Plus size={15} /> Create Invoice with this
                </Link>
              </div>
            </div>
          ) : (
            <p style={{ color: "#94a3b8" }}>Calculating...</p>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------
// 4. AI Assistant View
// ---------------------------------------------------------
function Assistant() {
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text:
        "Namaste! I am the **Azure AI Foundry GST Compliance Agent** (`gst-tax-compliance-agent`).\n\nI am equipped with autonomous tools to calculate taxes, check Section 17(5) blocked credits, lookup HSN codes, validate GSTINs, and reconcile your compliance ledger.",
      type: "intro",
      tools_registered: ["calculate_gst_tool", "validate_gstin_tool", "lookup_hsn_tool", "check_itc_section_17_5_tool", "reconcile_ledger_summary_tool"],
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const suggestedQuestions = [
    "Calculate GST for 45,000 at 18% intra-state",
    "Can I claim ITC on employee food catering and company cars?",
    "What is the tax rate for HSN code 9983?",
    "Validate GSTIN 27AABCU9603R1ZM",
    "Reconcile ledger summary for current period",
    "What are GSTR-1 and GSTR-3B due dates?",
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (textToSend) => {
    const q = textToSend || input;
    if (!q.trim() || loading) return;

    const userMsg = { sender: "user", text: q };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/copilot/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text: data.answer,
            type: data.type,
            tool_calls: data.tool_calls,
            agent_thought: data.agent_thought,
            agent_name: data.agent_name,
            mode: data.mode,
            model: data.model,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text: "Sorry, I encountered an error executing the agent workflow.",
          },
        ]);
      }
    } catch (err) {
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

  // Simple formatter to parse bold and bullets
  const renderFormattedText = (text) => {
    if (!text) return null;
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const formattedParts = parts.map((part, pIdx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      return (
        <div key={idx} style={{ minHeight: line === "" ? 8 : undefined }}>
          {formattedParts}
        </div>
      );
    });
  };

  return (
    <>
      <div className="header-row">
        <div>
          <h1>Azure AI Foundry Tax Compliance Agent</h1>
          <p className="subtitle">
            Autonomous agent equipped with function tools for GST calculations, HSN lookups, and statutory validation.
          </p>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#eef2ff",
          border: "1px solid #c7d2fe",
          borderRadius: 10,
          padding: "10px 16px",
          marginBottom: 16,
          fontSize: "0.85rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="dot" style={{ background: "#4338ca" }} />
          <strong>Agent:</strong> <code>gst-tax-compliance-agent</code>
          <span style={{ color: "#6366f1" }}>|</span>
          <strong>Model:</strong> <code>gpt-4o</code>
        </div>
        <div style={{ color: "#4338ca", fontSize: "0.8rem", fontWeight: 600 }}>
          5 Tools: calculate_gst • validate_gstin • lookup_hsn • check_itc • reconcile_ledger
        </div>
      </div>

      <div className="chat-container">
        <div className="chat-messages">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`chat-bubble ${
                m.sender === "user" ? "chat-bubble-user" : "chat-bubble-assistant"
              }`}
            >
              {m.agent_thought && (
                <div
                  style={{
                    fontSize: "0.78rem",
                    color: "#6366f1",
                    background: "rgba(99, 102, 241, 0.08)",
                    padding: "6px 10px",
                    borderRadius: 6,
                    marginBottom: 8,
                    borderLeft: "3px solid #6366f1",
                  }}
                >
                  💭 <strong>Agent Reasoning:</strong> {m.agent_thought}
                </div>
              )}

              {m.tool_calls && m.tool_calls.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  {m.tool_calls.map((tc, tcIdx) => (
                    <div
                      key={tcIdx}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 6,
                        padding: "6px 10px",
                        fontSize: "0.78rem",
                        color: "#0f172a",
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ color: "#059669", fontWeight: 600 }}>
                        ⚙️ Executed Tool: <code>{tc.tool_name}</code>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {renderFormattedText(m.text)}
            </div>
          ))}
          {loading && (
            <div className="chat-bubble chat-bubble-assistant">
              <span style={{ color: "#64748b" }}>
                <Sparkles size={14} style={{ marginRight: 6 }} />
                Azure AI Foundry Agent reasoning and invoking tools...
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        <div className="chat-chips">
          {suggestedQuestions.map((q, i) => (
            <button
              key={i}
              className="chip"
              onClick={() => sendMessage(q)}
              disabled={loading}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          className="chat-input-area"
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
        >
          <input
            type="text"
            placeholder="Instruct the agent (e.g. 'Calculate GST on 60,000 at 18% intra-state')..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="button" disabled={loading || !input.trim()}>
            <Send size={16} /> Instruct Agent
          </button>
        </form>
      </div>
    </>
  );
}

// ---------------------------------------------------------
// 5. Filing Review & Approval View
// ---------------------------------------------------------
function Review() {
  const [period, setPeriod] = useState("September 2026");
  const [filings, setFilings] = useState([]);
  const [stats, setStats] = useState({ total_sales: 0, total_tax: 0, total_invoices: 0 });
  const [draftFiling, setDraftFiling] = useState(null);
  const [submissionReceipt, setSubmissionReceipt] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const [filingRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/filings`),
        fetch(`${API_BASE}/invoices/stats`),
      ]);
      if (filingRes.ok) setFilings(await filingRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePrepareDraft = async () => {
    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE}/filings/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: period,
          total_sales: stats.total_sales,
          total_tax: stats.total_tax,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setDraftFiling(data);
        loadData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMockSubmit = async () => {
    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE}/filings/mock-submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filing_id: draftFiling ? draftFiling.id : null,
          period: period,
          total_sales: stats.total_sales,
          total_tax: stats.total_tax,
        }),
      });
      if (res.ok) {
        const receipt = await res.json();
        setSubmissionReceipt(receipt);
        loadData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="header-row">
        <div>
          <h1>GSTR Filing Review & Mock Submission</h1>
          <p className="subtitle">
            Validate outward supplies and net tax liability before mock filing submission.
          </p>
        </div>
      </div>

      <div className="alert alert-info">
        <AlertCircle size={20} />
        <div>
          <strong>Educational Demonstration Mode:</strong>
          <div style={{ fontSize: "0.84rem" }}>
            The submission feature simulates the GSTN filing flow and generates a valid-format
            ARN (Application Reference Number). It does not connect to the live Government portal.
          </div>
        </div>
      </div>

      {submissionReceipt && (
        <div className="card" style={{ border: "2px solid #059669", background: "#f0fdf4" }}>
          <div className="header-row" style={{ marginBottom: 10 }}>
            <h3 style={{ color: "#065f46", display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 color="#059669" size={22} /> GSTR-3B Return Submitted (Mock)
            </h3>
            <span className="badge badge-success">Status: Filed</span>
          </div>
          <p style={{ color: "#065f46", fontSize: "0.9rem", marginBottom: 14 }}>
            {submissionReceipt.message}
          </p>

          <div className="receipt-card" style={{ background: "white" }}>
            <div className="receipt-row">
              <span>Application Reference Number (ARN)</span>
              <strong style={{ color: "#059669", fontSize: "1.1rem" }}>
                {submissionReceipt.arn}
              </strong>
            </div>
            <div className="receipt-row">
              <span>Return Period</span>
              <span>{submissionReceipt.period}</span>
            </div>
            <div className="receipt-row">
              <span>Gross Taxable Turnover</span>
              <span>{formatINR(submissionReceipt.total_sales)}</span>
            </div>
            <div className="receipt-row">
              <span>Net Tax Discharged</span>
              <span>{formatINR(submissionReceipt.total_tax)}</span>
            </div>
            <div className="receipt-row">
              <span>Submission Timestamp</span>
              <span>{submissionReceipt.submission_time}</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid-2">
        {/* Left Column: Period & Computation Review */}
        <div className="card">
          <h2>Tax Period Ledger Summary</h2>

          <div className="form-group">
            <label>Select Filing Period</label>
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="September 2026">September 2026 (Monthly)</option>
              <option value="August 2026">August 2026 (Monthly)</option>
              <option value="Q2 (July - Sept 2026)">Q2 2026-27 (Quarterly QRMP)</option>
              <option value="Q1 (April - June 2026)">Q1 2026-27 (Quarterly QRMP)</option>
            </select>
          </div>

          <div className="receipt-card" style={{ margin: "20px 0" }}>
            <div className="receipt-row">
              <span>Invoices Included</span>
              <strong>{stats.total_invoices} records</strong>
            </div>
            <div className="receipt-row">
              <span>Total Outward Taxable Value</span>
              <strong>{formatINR(stats.total_sales)}</strong>
            </div>
            <div className="receipt-row">
              <span>Eligible Processed Records</span>
              <span>{stats.processed} verified</span>
            </div>
            <div className="receipt-row total">
              <span>Total Tax Payable</span>
              <span>{formatINR(stats.total_tax)}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              className="button button-outline"
              style={{ flex: 1 }}
              onClick={handlePrepareDraft}
              disabled={submitting}
            >
              Prepare Draft
            </button>
            <button
              className="button"
              style={{ flex: 1 }}
              onClick={handleMockSubmit}
              disabled={submitting}
            >
              <ShieldCheck size={16} /> Submit Draft (Mock)
            </button>
          </div>
        </div>

        {/* Right Column: Filing History */}
        <div className="card">
          <h2>Filing Audit History</h2>
          <p style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: 14 }}>
            Historical filings logged in database table <code>filings</code>.
          </p>

          {filings.length === 0 ? (
            <p style={{ color: "#94a3b8" }}>No filings recorded yet. Click "Prepare Draft" or "Submit Draft".</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filings.map((f) => (
                <div
                  key={f.id}
                  style={{
                    padding: "14px",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    background: "#ffffff",
                  }}
                >
                  <div className="header-row" style={{ marginBottom: 6 }}>
                    <strong>{f.period}</strong>
                    <span
                      className={`badge ${
                        f.status.includes("Submitted")
                          ? "badge-success"
                          : "badge-primary"
                      }`}
                    >
                      {f.status}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.84rem", color: "#64748b" }}>
                    Sales: {formatINR(f.total_sales)} | Tax: {formatINR(f.total_tax)}
                  </div>
                  {f.arn && (
                    <div style={{ fontSize: "0.78rem", color: "#059669", marginTop: 4 }}>
                      ARN: <code>{f.arn}</code>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function AuditView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/copilot/audit-logs`);
      if (res.ok) setLogs(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <>
      <div className="header-row">
        <div>
          <h1>Responsible AI & Human Oversight Audit Trail</h1>
          <p className="subtitle">
            AI-103 Compliance: Complete traceability of AI extractions, queries, and human verification.
          </p>
        </div>
        <button className="button button-outline button-sm" onClick={loadLogs}>
          <RefreshCw size={14} /> Refresh Logs
        </button>
      </div>

      <div className="alert alert-info">
        <ShieldCheck size={20} />
        <div>
          <strong>Microsoft Responsible AI Principle:</strong>
          <div style={{ fontSize: "0.84rem" }}>
            Transparency, Accountability, and Human-in-the-loop oversight. Every automated action and human review is immutably logged in the SQLite audit ledger.
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Audit Ledger Records</h2>
        {loading ? (
          <p style={{ color: "#94a3b8", padding: 20 }}>Loading audit records...</p>
        ) : logs.length === 0 ? (
          <p style={{ color: "#94a3b8", padding: 20 }}>No audit logs recorded yet.</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Log ID</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Details</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td>#{l.id}</td>
                    <td>
                      <span className="badge badge-primary">{l.action}</span>
                    </td>
                    <td><code>{l.actor}</code></td>
                    <td style={{ fontSize: "0.85rem" }}>{l.details}</td>
                    <td style={{ fontSize: "0.8rem", color: "#64748b" }}>{l.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function AzureModulesView() {
  const [activeTab, setActiveTab] = useState(1);
  const [ragQuery, setRagQuery] = useState("What are the conditions to claim ITC under Section 16?");
  const [ragResult, setRagResult] = useState(null);
  const [ragLoading, setRagLoading] = useState(false);

  const [langText, setLangText] = useState("Vendor Apex Infotech PAN ABCDE1234F GSTIN 27AABCU9603R1ZM charged ₹45,000 for IT consulting services. Contact +91 9876543210.");
  const [langResult, setLangResult] = useState(null);
  const [langLoading, setLangLoading] = useState(false);

  const [agentInfo, setAgentInfo] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/copilot/agent-info`)
      .then((res) => res.json())
      .then((data) => setAgentInfo(data))
      .catch(console.error);
  }, []);

  const handleRagSearch = async () => {
    try {
      setRagLoading(true);
      const res = await fetch(`${API_BASE}/modules/rag/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: ragQuery }),
      });
      if (res.ok) setRagResult(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setRagLoading(false);
    }
  };

  const handleLangAnalyze = async () => {
    try {
      setLangLoading(true);
      const res = await fetch(`${API_BASE}/modules/language/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: langText }),
      });
      if (res.ok) setLangResult(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLangLoading(false);
    }
  };

  return (
    <>
      <div className="header-row">
        <div>
          <h1>AI-103 Microsoft Learn Azure AI Hub</h1>
          <p className="subtitle">
            Interactive demonstration of all 4 Microsoft Learn modules required for course evaluation.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { id: 1, title: "Module 1: Generative AI & RAG", icon: "🧠" },
          { id: 2, title: "Module 2: AI Agents on Azure", icon: "🤖" },
          { id: 3, title: "Module 3: Natural Language Solutions", icon: "💬" },
          { id: 4, title: "Module 4: Visual Data Insights", icon: "👁️" },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`rate-pill ${activeTab === tab.id ? "active" : ""}`}
            style={{ padding: "10px 18px", fontSize: "0.9rem" }}
            onClick={() => setActiveTab(tab.id)}
          >
            <span style={{ marginRight: 6 }}>{tab.icon}</span>
            {tab.title}
          </button>
        ))}
      </div>

      {/* MODULE 1 */}
      {activeTab === 1 && (
        <div className="card">
          <div className="header-row">
            <div>
              <h3>Module 1: Develop Generative AI Apps in Azure (RAG Pattern)</h3>
              <p style={{ color: "#64748b", fontSize: "0.85rem" }}>
                Grounds LLM generations with statutory GST provisions and evaluates groundedness scores.
              </p>
            </div>
            <span className="badge badge-primary">Azure OpenAI + RAG</span>
          </div>

          <div className="form-group" style={{ marginTop: 12 }}>
            <label>User Compliance Query</label>
            <input
              type="text"
              value={ragQuery}
              onChange={(e) => setRagQuery(e.target.value)}
              placeholder="e.g. Explain Section 17(5) blocked credits"
            />
          </div>

          <button className="button" onClick={handleRagSearch} disabled={ragLoading}>
            {ragLoading ? "Grounding with GST Acts..." : "Execute RAG Retrieval & Generation"}
          </button>

          {ragResult && (
            <div style={{ marginTop: 20 }}>
              <div className="alert alert-success">
                <CheckCircle2 size={18} />
                <div>
                  <strong>Groundedness Evaluation: {ragResult.groundedness_evaluation.groundedness_score * 100}%</strong>
                  <div style={{ fontSize: "0.82rem" }}>
                    Hallucination Risk: {ragResult.groundedness_evaluation.hallucination_risk} | Safety: {ragResult.groundedness_evaluation.content_safety_status}
                  </div>
                </div>
              </div>

              <div className="receipt-card" style={{ marginBottom: 14 }}>
                <strong>Retrieved Grounding Documents (Simulating Azure AI Search Index):</strong>
                {ragResult.retrieved_statutory_context.map((d) => (
                  <div key={d.id} style={{ marginTop: 8, fontSize: "0.85rem" }}>
                    <code style={{ color: "#4338ca", fontWeight: 600 }}>[{d.id}] {d.title}</code>
                    <p style={{ color: "#475569", marginTop: 2 }}>{d.text}</p>
                  </div>
                ))}
              </div>

              <div className="card" style={{ background: "#f8fafc" }}>
                <h4>Grounded Answer</h4>
                <div style={{ fontSize: "0.9rem", marginTop: 8, whiteSpace: "pre-line" }}>
                  {ragResult.grounded_response}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODULE 2 */}
      {activeTab === 2 && (
        <div className="card">
          <div className="header-row">
            <div>
              <h3>Module 2: Develop AI Agents on Azure (Agent Service)</h3>
              <p style={{ color: "#64748b", fontSize: "0.85rem" }}>
                Multi-tool compliance agent architecture utilizing Azure AI Foundry Agent Service.
              </p>
            </div>
            <span className="badge badge-success">5 Registered Tools</span>
          </div>

          <div className="receipt-card" style={{ margin: "16px 0" }}>
            <div className="receipt-row">
              <span>Agent Name</span>
              <strong>{agentInfo?.agent_name || "gst-tax-compliance-agent"}</strong>
            </div>
            <div className="receipt-row">
              <span>Foundation Model</span>
              <code>{agentInfo?.model || "gpt-4o"}</code>
            </div>
            <div className="receipt-row">
              <span>SDK Service</span>
              <span>Azure AI Foundry Projects SDK (azure-ai-projects)</span>
            </div>
            <div className="receipt-row">
              <span>Execution State</span>
              <span className="badge badge-success">Autonomous Tool Calling Active</span>
            </div>
          </div>

          <h4>Registered Function Calling Tools (Declared in agent_tools.py):</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            {agentInfo?.tools?.map((t, idx) => (
              <div key={idx} style={{ padding: 12, border: "1px solid #e2e8f0", borderRadius: 8 }}>
                <div className="header-row" style={{ marginBottom: 4 }}>
                  <code style={{ color: "#4338ca", fontWeight: 700, fontSize: "0.95rem" }}>
                    ⚙️ {t.function.name}
                  </code>
                  <span className="badge badge-primary">FunctionTool</span>
                </div>
                <p style={{ fontSize: "0.85rem", color: "#475569" }}>{t.function.description}</p>
                <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: 4 }}>
                  Required parameters: {t.function.parameters.required?.join(", ") || "None"}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20 }}>
            <Link to="/assistant" className="button">
              Test Agent in AI Assistant Tab <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      )}

      {/* MODULE 3 */}
      {activeTab === 3 && (
        <div className="card">
          <div className="header-row">
            <div>
              <h3>Module 3: Develop Natural Language Solutions in Azure</h3>
              <p style={{ color: "#64748b", fontSize: "0.85rem" }}>
                Azure AI Language: Named Entity Recognition (NER), PII Masking, and Intent Classification.
              </p>
            </div>
            <span className="badge badge-warning">PII Privacy Guard</span>
          </div>

          <div className="form-group" style={{ marginTop: 12 }}>
            <label>Test Input Text (Contains PII like PAN and Phone)</label>
            <textarea
              rows={3}
              value={langText}
              onChange={(e) => setLangText(e.target.value)}
            />
          </div>

          <button className="button" onClick={handleLangAnalyze} disabled={langLoading}>
            {langLoading ? "Analyzing Text & Redacting PII..." : "Extract Entities & Redact PII"}
          </button>

          {langResult && (
            <div style={{ marginTop: 20 }}>
              <div className="alert alert-info">
                <ShieldCheck size={18} />
                <div>
                  <strong>Responsible AI Privacy Protection (PII Redacted Text):</strong>
                  <div style={{ fontSize: "0.9rem", marginTop: 4, fontFamily: "monospace" }}>
                    "{langResult.redacted_text_for_privacy}"
                  </div>
                </div>
              </div>

              <div className="grid-2" style={{ marginTop: 14 }}>
                <div className="receipt-card">
                  <strong>Detected Named Entities (Tax NER):</strong>
                  {langResult.named_entities.map((e, idx) => (
                    <div key={idx} className="receipt-row">
                      <code>{e.text}</code>
                      <span className="badge badge-primary">{e.category}</span>
                    </div>
                  ))}
                </div>

                <div className="receipt-card">
                  <strong>Redacted PII Entities:</strong>
                  {langResult.pii_detected.map((p, idx) => (
                    <div key={idx} className="receipt-row">
                      <code style={{ color: "#dc2626" }}>{p.text}</code>
                      <span className="badge badge-warning">{p.category}</span>
                    </div>
                  ))}
                  <div className="receipt-row total">
                    <span>Classified Intent</span>
                    <strong style={{ fontSize: "0.9rem" }}>{langResult.intent_classification.top_intent}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODULE 4 */}
      {activeTab === 4 && (
        <div className="card">
          <div className="header-row">
            <div>
              <h3>Module 4: Extract Insights from Visual Data on Azure</h3>
              <p style={{ color: "#64748b", fontSize: "0.85rem" }}>
                Azure AI Document Intelligence prebuilt-invoice model & OCR for line items and stamp detection.
              </p>
            </div>
            <span className="badge badge-success">Document Intelligence</span>
          </div>

          <p style={{ fontSize: "0.9rem", color: "#475569", margin: "10px 0 16px" }}>
            This module powers the <strong>Upload Invoice</strong> tab. When an invoice document (PDF or image) is processed, Azure Document Intelligence extracts fields with granular confidence scores:
          </p>

          <div className="receipt-card">
            <div className="receipt-row">
              <span>Document Intelligence Model</span>
              <code>prebuilt-invoice</code>
            </div>
            <div className="receipt-row">
              <span>InvoiceId Extraction Confidence</span>
              <span className="badge badge-success">99% Confidence</span>
            </div>
            <div className="receipt-row">
              <span>VendorTaxId (GSTIN) Validation</span>
              <span className="badge badge-success">98% Confidence</span>
            </div>
            <div className="receipt-row">
              <span>Subtotal & Tax Split Breakdown</span>
              <span className="badge badge-success">98% Confidence</span>
            </div>
            <div className="receipt-row">
              <span>Visual Stamp & Signature Verification</span>
              <span className="badge badge-primary">Verified Detected</span>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <Link to="/upload" className="button">
              Try Live Document Upload <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

function NotFound() {
  return (
    <div style={{ textAlign: "center", padding: 60 }}>
      <h1>404 - Page Not Found</h1>
      <p style={{ color: "#64748b", marginBottom: 20 }}>
        The requested view does not exist.
      </p>
      <Link className="button" to="/">
        Return to Dashboard
      </Link>
    </div>
  );
}

// ---------------------------------------------------------
// Main App Component
// ---------------------------------------------------------
export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/calculator" element={<Calculator />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/review" element={<Review />} />
        <Route path="/azure-modules" element={<AzureModulesView />} />
        <Route path="/audit" element={<AuditView />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

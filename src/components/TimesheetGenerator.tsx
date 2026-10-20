"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import type { TimesheetHeader, TimesheetRow, AttendanceStatus, SPLData } from "@/lib/types";
import {
  generateMonthRows,
  calcHours,
  summarizeTimesheet,
  MONTH_NAMES_TITLE,
  STATUS_OPTIONS,
  TASK_PRESETS,
  formatTimesheetSummaryText,
  saveTimesheetDraft,
  loadTimesheetDraft,
  saveTimesheetToHistory,
} from "@/lib/types";
import { exportTimesheetExcel, exportSPLExcel } from "@/lib/excel-export";
import { exportTimesheetPDF } from "@/lib/pdf-export";
import { SAMPLE_HEADER, getSampleTimesheetRows } from "@/lib/sample-data";

// ===== Initial State =====
const CURRENT_DATE = new Date();

const DEFAULT_HEADER: TimesheetHeader = {
  projectName: "OPERATIONAL RISK MANAGEMENT SYSTEM (ORMS)",
  department: "EDV / ADV",
  name: "Mohamad Burhanudin",
  npp: "901513",
  periode: "September 2026",
  month: 9,
  year: 2026,
  employeeTitle: "Developer",
  officerName: "Valentino Tarigan",
  officerTitle: "Officer",
  managerName: "Gita Kartika",
  managerTitle: "Pgs. Team Leader",
  deptHeadName: "Adhy Perdhana",
  deptHeadTitle: "Department Head",
  projectId: "P25068",
  aplikasiBerdampak: "ORMS",
  aipFitur: "Implementasi ORMS",
  dateStamp: "01 Oktober 2026",
};

const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_DATE.getFullYear() - 2 + i);

export default function TimesheetGenerator() {
  const [activeTab, setActiveTab] = useState<"timesheet" | "spl" | "export">("timesheet");
  const [header, setHeader] = useState<TimesheetHeader>(() => {
    if (typeof window !== "undefined") {
      const draft = loadTimesheetDraft();
      if (draft?.header) return draft.header;
    }
    return DEFAULT_HEADER;
  });

  const [rows, setRows] = useState<TimesheetRow[]>(() => {
    if (typeof window !== "undefined") {
      const draft = loadTimesheetDraft();
      if (draft?.rows && draft.rows.length > 0) return draft.rows;
    }
    return generateMonthRows(DEFAULT_HEADER.month, DEFAULT_HEADER.year, {
      projectName: DEFAULT_HEADER.projectName,
      projectId: DEFAULT_HEADER.projectId,
      aplikasiBerdampak: DEFAULT_HEADER.aplikasiBerdampak,
      aipFitur: DEFAULT_HEADER.aipFitur,
    });
  });

  const [isExporting, setIsExporting] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "info" | "warning" } | null>(null);
  
  // UI states
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [showProjectColumns, setShowProjectColumns] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "workdays" | "weekends" | "overtime" | "absence">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSPLRow, setSelectedSPLRow] = useState<TimesheetRow | null>(null);
  const [showQuickFillModal, setShowQuickFillModal] = useState(false);
  const [quickFillStart, setQuickFillStart] = useState("08:00");
  const [quickFillEnd, setQuickFillEnd] = useState("17:00");
  const [quickFillTask, setQuickFillTask] = useState("");

  // Show Toast
  const showToast = useCallback((text: string, type: "success" | "info" | "warning" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4500);
  }, []);

  // 2. Auto-save draft on changes (debounced)
  useEffect(() => {
    if (rows.length > 0) {
      const timeout = setTimeout(() => {
        saveTimesheetDraft(header, rows);
      }, 800);
      return () => clearTimeout(timeout);
    }
  }, [header, rows]);

  // Regenerate rows when Month/Year changes
  const handleRegenerateMonth = useCallback(
    (month: number, year: number) => {
      const generated = generateMonthRows(month, year, {
        projectName: header.projectName,
        projectId: header.projectId,
        aplikasiBerdampak: header.aplikasiBerdampak,
        aipFitur: header.aipFitur,
      });
      const periodeLabel = `${MONTH_NAMES_TITLE[month - 1]} ${year}`;
      setHeader((h) => ({ ...h, month, year, periode: periodeLabel }));
      setRows(generated);
      showToast(`Kalender diperbarui ke ${periodeLabel} (${generated.length} hari)`, "info");
    },
    [header.projectName, header.projectId, header.aplikasiBerdampak, header.aipFitur, showToast]
  );

  // Load sample Adidata data
  const handleLoadSample = useCallback(() => {
    setHeader(SAMPLE_HEADER);
    const sampleRows = getSampleTimesheetRows();
    setRows(sampleRows);
    showToast("Data contoh resmi September 2026 berhasil dimuat!", "success");
  }, [showToast]);

  // Update a single row field
  const updateRow = useCallback(
    (id: string, field: keyof TimesheetRow, value: string | number | boolean | AttendanceStatus) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          const updated = { ...r, [field]: value };
          
          // Recalculate total hours when time changes
          if (field === "startTime" || field === "endTime") {
            const start = field === "startTime" ? (value as string) : r.startTime;
            const end = field === "endTime" ? (value as string) : r.endTime;
            const d = new Date(r.date);
            updated.totalHours = calcHours(start, end, d.getDay());
          }
          
          // Auto-handle status changes
          if (field === "status") {
            const s = value as AttendanceStatus;
            if (["S", "V", "PM", "X", "H"].includes(s)) {
              updated.startTime = "";
              updated.endTime = "";
              updated.totalHours = 0;
              if (s === "X" && r.isWeekend) updated.activity = "Weekend";
              if (s === "S" && !updated.activity) updated.activity = "Sakit";
              if (s === "V" && !updated.activity) updated.activity = "Cuti Tahunan";
              if (s === "H" && !updated.activity) updated.activity = "Hari Libur Nasional";
            } else if (s === "P") {
              if (!updated.startTime && !updated.endTime) {
                const defaultStart = r.isWeekend ? "09:00" : "08:00";
                const defaultEnd = r.isWeekend ? "18:00" : "17:00";
                updated.startTime = defaultStart;
                updated.endTime = defaultEnd;
                const d = new Date(r.date);
                updated.totalHours = calcHours(defaultStart, defaultEnd, d.getDay());
              }
              if (updated.activity === "Weekend") {
                updated.activity = "";
              }
            }
          }
          return updated;
        })
      );
    },
    []
  );

  // Quick Action: Enable Overtime for Weekend Row
  const handleAddWeekendOvertime = useCallback((rowId: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const d = new Date(r.date);
        const hours = calcHours("09:00", "18:00", d.getDay());
        return {
          ...r,
          status: "P" as AttendanceStatus,
          startTime: "09:00",
          endTime: "18:00",
          totalHours: hours,
          activity: r.activity === "Weekend" ? "Support SIT & Perbaikan Defect" : r.activity,
        };
      })
    );
    showToast("Hari lembur akhir pekan berhasil ditambahkan. SPL otomatis disiapkan!", "success");
  }, [showToast]);

  // Bulk fill active working days
  const handleExecuteBulkFill = useCallback(() => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.isWeekend || r.status === "H" || r.status === "S" || r.status === "V") return r;
        const d = new Date(r.date);
        return {
          ...r,
          status: "P" as AttendanceStatus,
          startTime: quickFillStart,
          endTime: quickFillEnd,
          totalHours: calcHours(quickFillStart, quickFillEnd, d.getDay()),
          activity: r.activity && r.activity !== "Weekend" ? r.activity : (quickFillTask || r.activity),
        };
      })
    );
    setShowQuickFillModal(false);
    showToast(`Jam kerja (${quickFillStart} - ${quickFillEnd}) diterapkan ke seluruh hari kerja!`, "success");
  }, [quickFillStart, quickFillEnd, quickFillTask, showToast]);

  // Fill empty activities with a preset
  const handleApplyTaskPresetToEmpty = useCallback((taskText: string) => {
    let filledCount = 0;
    setRows((prev) =>
      prev.map((r) => {
        if (r.status === "P" && (!r.activity || r.activity === "Weekend")) {
          filledCount++;
          return { ...r, activity: taskText };
        }
        return r;
      })
    );
    showToast(`${filledCount} hari kerja kosong berhasil diisi dengan aktivitas template!`, "info");
  }, [showToast]);

  // Statistics Summary
  const summary = useMemo(() => summarizeTimesheet(rows), [rows]);

  // Overtime rows
  const overtimeRows = useMemo(() => {
    return rows.filter((r) => (r.isWeekend && r.status === "P" && r.totalHours > 0) || r.totalHours > 8.5);
  }, [rows]);

  // Empty activities count on working days
  const emptyActivityCount = useMemo(() => {
    return rows.filter((r) => r.status === "P" && (!r.activity || r.activity.trim() === "")).length;
  }, [rows]);

  // Filtered rows for the table view
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      // 1. Filter Tab
      if (filterMode === "workdays" && r.isWeekend) return false;
      if (filterMode === "weekends" && !r.isWeekend) return false;
      if (filterMode === "overtime" && !((r.isWeekend && r.status === "P") || r.totalHours > 8.5)) return false;
      if (filterMode === "absence" && !["S", "V", "PM", "H"].includes(r.status)) return false;

      // 2. Search Query
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const matchAct = r.activity?.toLowerCase().includes(q);
        const matchDate = r.date.includes(q) || r.dayName.toLowerCase().includes(q);
        const matchProject = r.projectName?.toLowerCase().includes(q) || r.projectId?.toLowerCase().includes(q);
        if (!matchAct && !matchDate && !matchProject) return false;
      }

      return true;
    });
  }, [rows, filterMode, searchQuery]);

  // Handle Timesheet Excel export
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      await exportTimesheetExcel({ header, rows });
      showToast("File Timesheet Excel (.xlsx) resmi Adidata berhasil didownload!", "success");
      saveTimesheetToHistory(header, rows);
    } catch (e: unknown) {
      console.error(e);
      showToast(`Gagal export Excel: ${e instanceof Error ? e.message : "Coba lagi"}`, "warning");
    } finally {
      setIsExporting(false);
    }
  };

  // Handle PDF export
  const handleExportPDF = () => {
    try {
      exportTimesheetPDF({ header, rows });
      showToast("Dialog cetak / PDF dibuka. Siap dicetak!", "info");
      saveTimesheetToHistory(header, rows);
    } catch (e: unknown) {
      console.error(e);
      showToast("Gagal memproses cetak PDF", "warning");
    }
  };

  // Handle single SPL Export
  const handleExportSingleSPL = async (row: TimesheetRow) => {
    setIsExporting(true);
    try {
      const splData: SPLData = {
        npp: header.npp,
        name: header.name,
        department: header.department,
        position: header.employeeTitle || "Developer",
        teamLeaderName: header.managerName || "Gita Kartika",
        teamLeaderTitle: header.managerTitle || "Pgs. Team Leader",
        deptHeadName: header.deptHeadName || "Adhy Perdhana",
        deptHeadTitle: header.deptHeadTitle || "Department Head",
        entries: [
          {
            no: 1,
            date: row.date,
            startTime: row.startTime ? `${row.startTime}:00` : "09:00:00",
            endTime: row.endTime ? `${row.endTime}:00` : "18:00:00",
            tasks: row.activity || "1. Support SIT\n2. Perbaikan Defect",
          },
        ],
      };
      await exportSPLExcel(splData);
      showToast(`File SPL Excel tanggal ${row.date} berhasil didownload!`, "success");
    } catch (e: unknown) {
      console.error(e);
      showToast(`Gagal export SPL: ${e instanceof Error ? e.message : "Coba lagi"}`, "warning");
    } finally {
      setIsExporting(false);
    }
  };

  // Copy WhatsApp / Slack text summary
  const handleCopySummary = () => {
    const summaryText = formatTimesheetSummaryText(header, rows);
    navigator.clipboard.writeText(summaryText);
    showToast("Ringkasan Timesheet disalin ke clipboard! Siap kirim ke WA/Slack.", "success");
  };

  // Save to History archive
  const handleManualSaveArchive = () => {
    saveTimesheetToHistory(header, rows);
    showToast(`Timesheet periode ${header.periode} berhasil diarsipkan ke Riwayat!`, "success");
  };

  return (
    <div className="animate-fade-in" style={{ position: "relative" }}>
      {/* Toast Notification */}
      {toastMsg && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 20px",
            borderRadius: "var(--radius-md)",
            background:
              toastMsg.type === "success"
                ? "rgba(6, 78, 59, 0.95)"
                : toastMsg.type === "warning"
                ? "rgba(120, 53, 15, 0.95)"
                : "rgba(30, 58, 138, 0.95)",
            color: "#ffffff",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            backdropFilter: "blur(12px)",
            fontWeight: 500,
            fontSize: "0.875rem",
            maxWidth: "460px",
          }}
          className="animate-fade-in"
        >
          <span>{toastMsg.type === "success" ? "✅" : toastMsg.type === "warning" ? "⚠️" : "ℹ️"}</span>
          <span style={{ flex: 1 }}>{toastMsg.text}</span>
          <button
            onClick={() => setToastMsg(null)}
            style={{ background: "none", border: "none", color: "white", cursor: "pointer", opacity: 0.7 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Hero / Page Header */}
      <div className="page-header">
        <div className="page-badge">
          <span>📋</span>
          <span>Standar Template Resmi Adidata</span>
        </div>
        <h1 className="page-title">
          Timesheet & <span className="page-title-gradient">Surat Lembur</span>
        </h1>
        <p className="page-subtitle">
          Input aktivitas harian, hitung otomatis jam kerja & potongan istirahat (Jumat 1.5h, Reguler 1h), dan download Excel resmi dengan 1-klik.
        </p>
      </div>

      <div className="main-content">
        {/* Navigation Tabs */}
        <div className="stepper-nav">
          <button
            type="button"
            className={`stepper-item ${activeTab === "timesheet" ? "active" : ""}`}
            onClick={() => setActiveTab("timesheet")}
          >
            <span className="stepper-badge">1</span>
            <span>📋 Editor Timesheet Harian</span>
          </button>
          <span className="stepper-separator">›</span>
          <button
            type="button"
            className={`stepper-item ${activeTab === "spl" ? "active" : ""}`}
            onClick={() => setActiveTab("spl")}
          >
            <span className="stepper-badge">{overtimeRows.length > 0 ? "⚡" : "2"}</span>
            <span>🌙 Surat Lembur (SPL)</span>
            {overtimeRows.length > 0 && (
              <span
                style={{
                  background: "var(--accent-amber)",
                  color: "#000",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                }}
              >
                {overtimeRows.length}
              </span>
            )}
          </button>
          <span className="stepper-separator">›</span>
          <button
            type="button"
            className={`stepper-item ${activeTab === "export" ? "active" : ""}`}
            onClick={() => setActiveTab("export")}
          >
            <span className="stepper-badge">3</span>
            <span>🚀 Export & Unduh</span>
          </button>
        </div>

        {/* =========================================================================
            HEADER / PROFILE SUMMARY CARD (COLLAPSIBLE)
        ========================================================================= */}
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--gradient-brand)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  color: "white",
                  flexShrink: 0,
                }}
              >
                👤
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    {header.name || "Nama Karyawan"}
                  </span>
                  <span
                    style={{
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: "0.8rem",
                      background: "rgba(255, 255, 255, 0.08)",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      color: "var(--text-secondary)",
                    }}
                  >
                    NPP: {header.npp || "-"}
                  </span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      background: "rgba(99, 102, 241, 0.15)",
                      color: "var(--accent-indigo)",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontWeight: 600,
                    }}
                  >
                    {header.department || "EDV / ADV"}
                  </span>
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "3px" }}>
                  💼 <strong>{header.projectName || "Proyek"}</strong> ({header.projectId || "ID"}) • Periode:{" "}
                  <strong style={{ color: "#a5b4fc" }}>
                    {MONTH_NAMES_TITLE[header.month - 1]} {header.year}
                  </strong>
                </div>
              </div>
            </div>

            {/* Quick Header Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleLoadSample}
                title="Muat contoh data resmi September 2026"
              >
                ⚡ Muat Contoh Adidata
              </button>
              <button
                type="button"
                className={`btn btn-sm ${showProfileDrawer ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setShowProfileDrawer(!showProfileDrawer)}
              >
                {showProfileDrawer ? "▲ Tutup Form Detail" : "✏️ Edit Info & TTD"}
              </button>
            </div>
          </div>

          {/* Collapsible Edit Form for Employee & Project Details */}
          {showProfileDrawer && (
            <div
              style={{
                marginTop: "1.5rem",
                paddingTop: "1.25rem",
                borderTop: "1px solid var(--border-color)",
              }}
              className="animate-fade-in"
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  Data Karyawan, Periode & Otorisasi Excel
                </span>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  Nilai ini akan otomatis dicetak ke header dan footer Excel resmi
                </span>
              </div>

              {/* Form Section 1: Karyawan */}
              <div className="form-grid" style={{ marginBottom: "1.25rem" }}>
                <div className="form-group">
                  <label className="form-label">
                    Nama Karyawan <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={header.name}
                    placeholder="Contoh: Mohamad Burhanudin"
                    onChange={(e) => setHeader((h) => ({ ...h, name: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    NPP <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={header.npp}
                    placeholder="Contoh: 901513"
                    onChange={(e) => setHeader((h) => ({ ...h, npp: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Departemen / Divisi</label>
                  <input
                    type="text"
                    className="form-input"
                    value={header.department}
                    placeholder="EDV / ADV"
                    onChange={(e) => setHeader((h) => ({ ...h, department: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Jabatan / Posisi</label>
                  <input
                    type="text"
                    className="form-input"
                    value={header.employeeTitle}
                    placeholder="Developer"
                    onChange={(e) => setHeader((h) => ({ ...h, employeeTitle: e.target.value }))}
                  />
                </div>
              </div>

              {/* Form Section 2: Bulan & Proyek */}
              <div className="form-grid" style={{ marginBottom: "1.25rem" }}>
                <div className="form-group">
                  <label className="form-label">
                    Pilih Bulan <span className="hint">Auto ubah kalender</span>
                  </label>
                  <select
                    className="form-select"
                    value={header.month}
                    onChange={(e) => {
                      const m = parseInt(e.target.value);
                      handleRegenerateMonth(m, header.year);
                    }}
                  >
                    {MONTH_NAMES_TITLE.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tahun</label>
                  <select
                    className="form-select"
                    value={header.year}
                    onChange={(e) => {
                      const y = parseInt(e.target.value);
                      handleRegenerateMonth(header.month, y);
                    }}
                  >
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Nama Proyek</label>
                  <input
                    type="text"
                    className="form-input"
                    value={header.projectName}
                    placeholder="OPERATIONAL RISK MANAGEMENT SYSTEM (ORMS)"
                    onChange={(e) => setHeader((h) => ({ ...h, projectName: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Project ID</label>
                  <input
                    type="text"
                    className="form-input"
                    value={header.projectId}
                    placeholder="P25068"
                    onChange={(e) => setHeader((h) => ({ ...h, projectId: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Aplikasi Berdampak</label>
                  <input
                    type="text"
                    className="form-input"
                    value={header.aplikasiBerdampak}
                    placeholder="ORMS"
                    onChange={(e) => setHeader((h) => ({ ...h, aplikasiBerdampak: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">AIP Fitur</label>
                  <input
                    type="text"
                    className="form-input"
                    value={header.aipFitur}
                    placeholder="Implementasi ORMS"
                    onChange={(e) => setHeader((h) => ({ ...h, aipFitur: e.target.value }))}
                  />
                </div>
              </div>

              {/* Form Section 3: Tanda Tangan */}
              <div className="form-grid" style={{ marginBottom: "1rem" }}>
                <div className="form-group">
                  <label className="form-label">Pemeriksa 1: Officer</label>
                  <input
                    type="text"
                    className="form-input"
                    value={header.officerName}
                    placeholder="Valentino Tarigan"
                    onChange={(e) => setHeader((h) => ({ ...h, officerName: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Pemeriksa 2: Team Leader</label>
                  <input
                    type="text"
                    className="form-input"
                    value={header.managerName}
                    placeholder="Gita Kartika"
                    onChange={(e) => setHeader((h) => ({ ...h, managerName: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Menyetujui: Dept Head</label>
                  <input
                    type="text"
                    className="form-input"
                    value={header.deptHeadName}
                    placeholder="Adhy Perdhana"
                    onChange={(e) => setHeader((h) => ({ ...h, deptHeadName: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Tanggal TTD (Date Stamp)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={header.dateStamp}
                    placeholder="01 Oktober 2026"
                    onChange={(e) => setHeader((h) => ({ ...h, dateStamp: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowProfileDrawer(false)}
                >
                  ✓ Selesai Mengedit Info
                </button>
              </div>
            </div>
          )}
        </div>

        {/* =========================================================================
            LIVE KPI CARDS
        ========================================================================= */}
        <div className="stats-grid" style={{ marginBottom: "1.25rem" }}>
          <div className="stat-card stat-card-highlight">
            <div className="stat-header">
              <span className="stat-label">Total Jam Kerja</span>
              <span className="stat-icon">⏱️</span>
            </div>
            <div className="stat-value">{summary.totalHours.toFixed(1)}h</div>
            <div className="stat-subtext">Netto setelah potong istirahat</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Hari Masuk (P)</span>
              <span className="stat-icon">💼</span>
            </div>
            <div className="stat-value" style={{ color: "var(--accent-emerald)" }}>
              {summary.present}
            </div>
            <div className="stat-subtext">Dari {rows.length} total hari kalender</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Lembur / SPL</span>
              <span className="stat-icon">🌙</span>
            </div>
            <div className="stat-value" style={{ color: overtimeRows.length > 0 ? "var(--accent-amber)" : "var(--text-muted)" }}>
              {overtimeRows.length} Hari
            </div>
            <div className="stat-subtext">
              {overtimeRows.length > 0 ? "Siap diexport ke file SPL" : "Belum ada lembur"}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Cuti / Sakit / Izin</span>
              <span className="stat-icon">🏖️</span>
            </div>
            <div className="stat-value">
              {summary.sick + summary.vacation + summary.permit}
            </div>
            <div className="stat-subtext">
              S:{summary.sick} • V:{summary.vacation} • PM:{summary.permit}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Status Pengisian</span>
              <span className="stat-icon">{emptyActivityCount === 0 ? "✅" : "⚠️"}</span>
            </div>
            <div
              className="stat-value"
              style={{
                fontSize: "1.15rem",
                color: emptyActivityCount === 0 ? "var(--accent-emerald)" : "var(--accent-amber)",
                paddingTop: "6px",
              }}
            >
              {emptyActivityCount === 0 ? "Lengkap" : `${emptyActivityCount} Kosong`}
            </div>
            <div className="stat-subtext">
              {emptyActivityCount === 0 ? "Semua hari kerja memiliki deskripsi" : "Ada hari kerja tanpa remark"}
            </div>
          </div>
        </div>

        {/* =========================================================================
            TAB 1: TIMESHEET EDITOR
        ========================================================================= */}
        {activeTab === "timesheet" && (
          <div className="card">
            {/* Table Toolbar */}
            <div className="table-toolbar">
              <div className="filter-pills">
                <button
                  type="button"
                  className={`filter-pill ${filterMode === "all" ? "active" : ""}`}
                  onClick={() => setFilterMode("all")}
                >
                  Semua ({rows.length})
                </button>
                <button
                  type="button"
                  className={`filter-pill ${filterMode === "workdays" ? "active" : ""}`}
                  onClick={() => setFilterMode("workdays")}
                >
                  Hari Kerja ({rows.filter((r) => !r.isWeekend).length})
                </button>
                <button
                  type="button"
                  className={`filter-pill ${filterMode === "weekends" ? "active" : ""}`}
                  onClick={() => setFilterMode("weekends")}
                >
                  Akhir Pekan ({rows.filter((r) => r.isWeekend).length})
                </button>
                <button
                  type="button"
                  className={`filter-pill ${filterMode === "overtime" ? "active" : ""}`}
                  onClick={() => setFilterMode("overtime")}
                >
                  Lembur ({overtimeRows.length})
                </button>
                <button
                  type="button"
                  className={`filter-pill ${filterMode === "absence" ? "active" : ""}`}
                  onClick={() => setFilterMode("absence")}
                >
                  Cuti / Sakit ({rows.filter((r) => ["S", "V", "PM", "H"].includes(r.status)).length})
                </button>
              </div>

              {/* Search & Mode Toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <input
                  type="text"
                  className="table-input-compact"
                  placeholder="🔍 Cari aktivitas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: "160px" }}
                />

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowProjectColumns(!showProjectColumns)}
                  title="Tampilkan / sembunyikan kolom Project Name, ID, App, Fitur"
                >
                  {showProjectColumns ? "✕ Kolom Ringkas" : "📑 Mode Kolom Proyek"}
                </button>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowQuickFillModal(true)}
                >
                  ⚡ Isi Cepat Jam Kerja
                </button>
              </div>
            </div>

            {/* Quick Task Template Bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                background: "rgba(255, 255, 255, 0.02)",
                borderRadius: "var(--radius-sm)",
                marginBottom: "12px",
                border: "1px dashed var(--border-color)",
                overflowX: "auto",
              }}
            >
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                💡 TEMPLATE TUGAS CEPAT:
              </span>
              {TASK_PRESETS.slice(0, 4).map((task) => (
                <button
                  key={task}
                  type="button"
                  onClick={() => handleApplyTaskPresetToEmpty(task)}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: "0.75rem", padding: "3px 8px" }}
                  title="Klik untuk mengisi hari kerja yang aktivitasnya masih kosong"
                >
                  + {task}
                </button>
              ))}
            </div>

            {/* Main Interactive Table */}
            <div className="timesheet-table-wrapper">
              <table className="timesheet-table">
                <thead>
                  <tr>
                    <th className="col-num">#</th>
                    <th className="col-date">Tanggal</th>
                    <th style={{ width: "75px" }}>Hari</th>
                    <th style={{ width: "95px" }}>Jam Masuk</th>
                    <th style={{ width: "95px" }}>Jam Pulang</th>
                    <th style={{ width: "70px", textAlign: "center" }}>Durasi</th>
                    <th style={{ width: "105px" }}>Status</th>
                    <th style={{ minWidth: "260px" }}>Aktivitas / Remark (Kolom L-N)</th>
                    {showProjectColumns && (
                      <>
                        <th style={{ width: "140px" }}>Proyek (O)</th>
                        <th style={{ width: "80px" }}>ID (P)</th>
                        <th style={{ width: "80px" }}>App (Q)</th>
                        <th style={{ width: "110px" }}>Fitur (R)</th>
                      </>
                    )}
                    <th style={{ width: "85px", textAlign: "center" }}>Lembur / SPL</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={showProjectColumns ? 12 : 8} style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--text-muted)" }}>
                        Tidak ada baris yang sesuai dengan filter atau pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, idx) => {
                      const isWeekendWorking = row.isWeekend && row.status === "P";
                      const isWeekendOff = row.isWeekend && row.status !== "P";
                      const isMissingActivity = row.status === "P" && (!row.activity || row.activity.trim() === "");
                      const [, monthNum, dayNum] = row.date.split("-").map(Number);
                      const monthLabel = MONTH_NAMES_TITLE[(monthNum || 1) - 1]?.slice(0, 3) || "";

                      return (
                        <tr
                          key={row.id}
                          className={
                            isWeekendWorking
                              ? "row-lembur"
                              : isWeekendOff
                              ? "row-weekend"
                              : row.status === "H"
                              ? "row-holiday"
                              : ""
                          }
                        >
                          {/* Row Number */}
                          <td className="col-num">{idx + 1}</td>

                          {/* Date Display */}
                          <td className="col-date">
                            <span style={{ color: isWeekendOff ? "var(--text-muted)" : "var(--text-primary)" }}>
                              {String(dayNum).padStart(2, "0")} {monthLabel}
                            </span>
                          </td>

                          {/* Day Name */}
                          <td>
                            <span
                              style={{
                                color: row.isWeekend
                                  ? isWeekendWorking
                                    ? "var(--accent-amber)"
                                    : "var(--text-muted)"
                                  : "var(--text-secondary)",
                                fontWeight: row.isWeekend ? 600 : 500,
                                fontSize: "0.82rem",
                              }}
                            >
                              {row.dayName}
                            </span>
                          </td>

                          {/* Start Time Input */}
                          <td>
                            <input
                              type="time"
                              className="table-input-compact"
                              value={row.startTime}
                              disabled={row.status !== "P"}
                              onChange={(e) => updateRow(row.id, "startTime", e.target.value)}
                            />
                          </td>

                          {/* End Time Input */}
                          <td>
                            <input
                              type="time"
                              className="table-input-compact"
                              value={row.endTime}
                              disabled={row.status !== "P"}
                              onChange={(e) => updateRow(row.id, "endTime", e.target.value)}
                            />
                          </td>

                          {/* Calculated Net Hours */}
                          <td style={{ textAlign: "center" }}>
                            {row.totalHours > 0 ? (
                              <span
                                style={{
                                  fontFamily: "JetBrains Mono, monospace",
                                  fontWeight: 700,
                                  color: isWeekendWorking ? "var(--accent-amber)" : "var(--accent-cyan)",
                                }}
                                title={
                                  row.dayName === "Jumat"
                                    ? "Potongan istirahat Jumat: 1.5 Jam"
                                    : "Potongan istirahat standar: 1 Jam"
                                }
                              >
                                {row.totalHours}h
                              </span>
                            ) : (
                              <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>—</span>
                            )}
                          </td>

                          {/* Status Dropdown Pill */}
                          <td>
                            <select
                              className="table-input-compact"
                              value={row.status}
                              onChange={(e) => updateRow(row.id, "status", e.target.value as AttendanceStatus)}
                              style={{
                                fontWeight: 700,
                                color:
                                  row.status === "P"
                                    ? "var(--accent-emerald)"
                                    : row.status === "S"
                                    ? "var(--accent-rose)"
                                    : row.status === "V"
                                    ? "var(--accent-cyan)"
                                    : row.status === "BT"
                                    ? "var(--accent-amber)"
                                    : "var(--text-secondary)",
                              }}
                            >
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s.value} value={s.value}>
                                  {s.value} - {s.description}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Activity / Remark Input */}
                          <td>
                            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                              <input
                                type="text"
                                className="table-input-compact"
                                value={row.activity}
                                disabled={row.status === "X" && !isWeekendWorking}
                                placeholder={
                                  row.status === "X"
                                    ? "Akhir Pekan (Klik +Lembur jika masuk)"
                                    : "Tulis aktivitas yang dikerjakan..."
                                }
                                onChange={(e) => updateRow(row.id, "activity", e.target.value)}
                                style={{
                                  borderColor: isMissingActivity ? "rgba(245, 158, 11, 0.5)" : undefined,
                                }}
                              />
                              {isMissingActivity && (
                                <span
                                  style={{
                                    position: "absolute",
                                    right: "8px",
                                    fontSize: "0.75rem",
                                    color: "var(--accent-amber)",
                                    pointerEvents: "none",
                                  }}
                                  title="Aktivitas masih kosong"
                                >
                                  ⚠️
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Expanded Columns: Project Name, ID, App, Fitur */}
                          {showProjectColumns && (
                            <>
                              <td>
                                <input
                                  type="text"
                                  className="table-input-compact"
                                  value={row.projectName || ""}
                                  placeholder={header.projectName}
                                  disabled={row.status !== "P"}
                                  onChange={(e) => updateRow(row.id, "projectName", e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="table-input-compact"
                                  value={row.projectId || ""}
                                  placeholder={header.projectId}
                                  disabled={row.status !== "P"}
                                  onChange={(e) => updateRow(row.id, "projectId", e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="table-input-compact"
                                  value={row.aplikasiBerdampak || ""}
                                  placeholder={header.aplikasiBerdampak}
                                  disabled={row.status !== "P"}
                                  onChange={(e) => updateRow(row.id, "aplikasiBerdampak", e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="table-input-compact"
                                  value={row.aipFitur || ""}
                                  placeholder={header.aipFitur}
                                  disabled={row.status !== "P"}
                                  onChange={(e) => updateRow(row.id, "aipFitur", e.target.value)}
                                />
                              </td>
                            </>
                          )}

                          {/* Overtime / SPL Action Button */}
                          <td style={{ textAlign: "center" }}>
                            {row.isWeekend && row.status !== "P" ? (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleAddWeekendOvertime(row.id)}
                                style={{
                                  fontSize: "0.72rem",
                                  padding: "3px 6px",
                                  color: "var(--text-secondary)",
                                  border: "1px dashed var(--border-color)",
                                }}
                                title="Catat jam kerja lembur di akhir pekan ini"
                              >
                                + Lembur
                              </button>
                            ) : isWeekendWorking || row.totalHours > 8.5 ? (
                              <button
                                type="button"
                                className="btn btn-warning btn-sm"
                                onClick={() => setSelectedSPLRow(row)}
                                style={{ fontSize: "0.75rem", padding: "3px 8px", fontWeight: 700 }}
                                title="Generate Surat Perintah Lembur untuk hari ini"
                              >
                                ⚡ SPL
                              </button>
                            ) : (
                              <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Navigation & Export Prompt */}
            <div
              style={{
                marginTop: "1.25rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "1rem",
              }}
            >
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleCopySummary}
                >
                  📋 Salin Teks Ringkasan (WA/Slack)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleManualSaveArchive}
                >
                  💾 Simpan ke Riwayat
                </button>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                {overtimeRows.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-warning"
                    onClick={() => setActiveTab("spl")}
                  >
                    🌙 Review {overtimeRows.length} SPL →
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setActiveTab("export")}
                >
                  Lanjut ke Download & Cetak →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: SURAT LEMBUR (SPL) MANAGER
        ========================================================================= */}
        {activeTab === "spl" && (
          <div className="card animate-fade-in">
            <div className="card-header">
              <div>
                <div className="card-title">
                  <div className="card-icon">🌙</div>
                  <span>Daftar Surat Perintah Lembur (SPL)</span>
                </div>
                <div className="card-subtitle">
                  Sistem otomatis mendeteksi hari lembur dari aktivitas akhir pekan atau jam kerja melebihi standar.
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setActiveTab("timesheet")}
              >
                ← Kembali ke Tabel Timesheet
              </button>
            </div>

            {overtimeRows.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "3rem 1rem",
                  background: "rgba(255, 255, 255, 0.02)",
                  borderRadius: "var(--radius-md)",
                  border: "1px dashed var(--border-color)",
                }}
              >
                <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🏖️</div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  Belum Ada Hari Lembur yang Terdeteksi
                </h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", maxWidth: "450px", margin: "0.5rem auto 1.25rem" }}>
                  Untuk mencatat lembur, buka <strong>Editor Timesheet</strong> lalu klik tombol <strong>+ Lembur</strong> di hari Sabtu/Minggu atau masukkan jam kerja di atas 8.5 jam.
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setActiveTab("timesheet")}
                >
                  Buka Editor Timesheet
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div className="alert alert-info">
                  <span>💡</span>
                  <span>
                    Ditemukan <strong>{overtimeRows.length} hari penugasan lembur</strong>. Anda dapat mengunduh file Excel SPL per tanggal di bawah ini sesuai template resmi Adidata.
                  </span>
                </div>

                {overtimeRows.map((ot, index) => (
                  <div
                    key={ot.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "16px",
                      background: "rgba(255, 255, 255, 0.03)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-color)",
                      flexWrap: "wrap",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "0.95rem" }}>
                          Penugasan #{index + 1}: {ot.dayName}, {ot.date}
                        </span>
                        <span
                          style={{
                            background: "rgba(245, 158, 11, 0.15)",
                            color: "var(--accent-amber)",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            fontWeight: 700,
                            fontSize: "0.78rem",
                            fontFamily: "JetBrains Mono, monospace",
                          }}
                        >
                          {ot.startTime} - {ot.endTime} ({ot.totalHours} Jam)
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "0.85rem",
                          color: "var(--text-secondary)",
                          marginTop: "6px",
                          whiteSpace: "pre-line",
                          lineHeight: 1.4,
                        }}
                      >
                        {ot.activity || "Belum ada rincian tugas lembur..."}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setSelectedSPLRow(ot)}
                      >
                        ✏️ Edit Tugas
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleExportSingleSPL(ot)}
                        disabled={isExporting}
                      >
                        ⬇️ Unduh SPL Excel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 3: EXPORT & CETAK
        ========================================================================= */}
        {activeTab === "export" && (
          <div className="card animate-fade-in">
            <div className="card-header">
              <div>
                <div className="card-title">
                  <div className="card-icon">🚀</div>
                  <span>Export & Unduh Dokumen</span>
                </div>
                <div className="card-subtitle">
                  Unduh file Timesheet Excel (.xlsx) resmi Adidata atau cetak format PDF.
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setActiveTab("timesheet")}
              >
                ← Edit Data Lagi
              </button>
            </div>

            {/* Validation Notice */}
            {emptyActivityCount > 0 ? (
              <div className="alert alert-warning" style={{ marginBottom: "1.5rem" }}>
                <span>⚠️</span>
                <span>
                  Perhatian: Ada <strong>{emptyActivityCount} hari kerja</strong> yang kolom aktivitasnya belum diisi. Anda tetap bisa mengunduh Excel sekarang, namun disarankan melengkapinya terlebih dahulu.
                </span>
              </div>
            ) : (
              <div className="alert alert-success" style={{ marginBottom: "1.5rem" }}>
                <span>✅</span>
                <span>
                  Timesheet <strong>{header.name}</strong> ({header.npp}) periode{" "}
                  <strong>
                    {MONTH_NAMES_TITLE[header.month - 1]} {header.year}
                  </strong>{" "}
                  lengkap dan siap diexport.
                </span>
              </div>
            )}

            {/* Primary Action Buttons */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "1rem",
                marginBottom: "2rem",
              }}
            >
              <div
                style={{
                  background: "rgba(16, 185, 129, 0.08)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: "var(--radius-md)",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "28px" }}>📊</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text-primary)" }}>
                      Timesheet Resmi (.xlsx)
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      Menggunakan master template Adidata dengan rumus jam kerja otomatis
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-success btn-lg"
                  onClick={handleExportExcel}
                  disabled={isExporting}
                  style={{ width: "100%", marginTop: "auto" }}
                >
                  {isExporting ? "⏳ Memproses Template..." : "⬇️ Download Excel (.xlsx)"}
                </button>
              </div>

              <div
                style={{
                  background: "rgba(99, 102, 241, 0.08)",
                  border: "1px solid rgba(99, 102, 241, 0.3)",
                  borderRadius: "var(--radius-md)",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "28px" }}>🖨️</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text-primary)" }}>
                      Cetak / PDF Timesheet
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      Format siap cetak landscape A4 dengan kolom tanda tangan
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  onClick={handleExportPDF}
                  style={{ width: "100%", marginTop: "auto" }}
                >
                  🖨️ Cetak / Simpan PDF
                </button>
              </div>

              <div
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-md)",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "28px" }}>💬</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text-primary)" }}>
                      Kirim Laporan WA / Slack
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      Format teks rapi siap kirim ke Team Leader atau PM
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-lg"
                  onClick={handleCopySummary}
                  style={{ width: "100%", marginTop: "auto" }}
                >
                  📋 Salin Teks Ringkasan
                </button>
              </div>
            </div>

            {/* Document Verification Overview */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.02)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-color)",
                padding: "1.25rem",
              }}
            >
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Metadata Tanda Tangan & Otorisasi
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>PEMERIKSA 1 (OFFICER)</div>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)", marginTop: "2px" }}>
                    {header.officerName || "—"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>PEMERIKSA 2 (TEAM LEADER)</div>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)", marginTop: "2px" }}>
                    {header.managerName || "—"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>MENYETUJUI (DEPT HEAD)</div>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)", marginTop: "2px" }}>
                    {header.deptHeadName || "—"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>TANGGAL TANDA TANGAN</div>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)", marginTop: "2px" }}>
                    {header.dateStamp || "—"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            MODAL: EDIT SPL TASKS
        ========================================================================= */}
        {selectedSPLRow && (
          <div className="modal-backdrop animate-fade-in" onClick={() => setSelectedSPLRow(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="card-header">
                <div className="card-title">
                  <div className="card-icon">🌙</div>
                  <span>Surat Perintah Lembur (SPL)</span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelectedSPLRow(null)}
                >
                  ✕
                </button>
              </div>

              <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                File SPL untuk tanggal <strong>{selectedSPLRow.dayName}, {selectedSPLRow.date}</strong> ({selectedSPLRow.startTime} - {selectedSPLRow.endTime}).
              </p>

              <div className="form-group" style={{ marginBottom: "1.25rem" }}>
                <label className="form-label">
                  Rincian Tugas yang Dikerjakan Saat Lembur
                  <span className="hint">Mendukung multi-baris / poin</span>
                </label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  value={selectedSPLRow.activity}
                  onChange={(e) => {
                    updateRow(selectedSPLRow.id, "activity", e.target.value);
                    setSelectedSPLRow((prev) => (prev ? { ...prev, activity: e.target.value } : null));
                  }}
                  placeholder="Contoh:&#10;1. Support SIT & Testing&#10;2. Perbaikan Defect CR60137 - [KRI] Input & Penugasan"
                />
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedSPLRow(null)}
                >
                  Tutup
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    await handleExportSingleSPL(selectedSPLRow);
                    setSelectedSPLRow(null);
                  }}
                >
                  ⬇️ Download SPL Excel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            MODAL: QUICK BULK FILL WORKING DAYS
        ========================================================================= */}
        {showQuickFillModal && (
          <div className="modal-backdrop animate-fade-in" onClick={() => setShowQuickFillModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="card-header">
                <div className="card-title">
                  <div className="card-icon">⚡</div>
                  <span>Isi Cepat Jam Kerja</span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowQuickFillModal(false)}
                >
                  ✕
                </button>
              </div>

              <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "1.25rem" }}>
                Terapkan jam kerja default ke seluruh hari kerja aktif (Senin - Jumat). Rumus akan otomatis memotong jam istirahat sesuai aturan Adidata (Jumat 1.5h, lainnya 1h).
              </p>

              <div className="form-grid" style={{ marginBottom: "1.25rem" }}>
                <div className="form-group">
                  <label className="form-label">Jam Mulai</label>
                  <input
                    type="time"
                    className="form-input"
                    value={quickFillStart}
                    onChange={(e) => setQuickFillStart(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Jam Selesai</label>
                  <input
                    type="time"
                    className="form-input"
                    value={quickFillEnd}
                    onChange={(e) => setQuickFillEnd(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                <label className="form-label">
                  Aktivitas Default (Opsional)
                  <span className="hint">Hanya isi hari yang kosong</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Contoh: Pengembangan Fitur & Integrasi ORMS"
                  value={quickFillTask}
                  onChange={(e) => setQuickFillTask(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowQuickFillModal(false)}
                >
                  Batal
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleExecuteBulkFill}
                >
                  ⚡ Terapkan Sekarang
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

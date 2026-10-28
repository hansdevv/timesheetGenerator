"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import type { TimesheetHeader, TimesheetRow, AttendanceStatus, SPLData } from "@/lib/types";
import {
  generateMonthRows,
  calcHours,
  formatTimeWithSeconds,
  summarizeTimesheet,
  isOvertimeRow,
  MONTH_NAMES_TITLE,
  STATUS_OPTIONS,
  TASK_PRESETS,
  formatTimesheetSummaryText,
  saveTimesheetDraft,
  loadTimesheetDraft,
  saveTimesheetToHistory,
} from "@/lib/types";
import { exportTimesheetExcel, exportSPLExcel } from "@/lib/excel-export";
import { exportTimesheetPDF, exportSPLPDF } from "@/lib/pdf-export";
import { SAMPLE_HEADER, getSampleTimesheetRows } from "@/lib/sample-data";
import { useAppStore } from "@/lib/storage";
import {
  ClockIcon,
  BriefcaseIcon,
  UserIcon,
  MoonIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  DownloadIcon,
  PrinterIcon,
  CopyIcon,
  SearchIcon,
  SparklesIcon,
  EditIcon,
  PlusIcon,
  SlidersIcon,
  FileTextIcon,
  UmbrellafillIcon,
  ArchiveIcon,
  TrashIcon,
} from "@/components/Icons";

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
  const { profile, holidays, timesheetDraft, setTimesheetDraft, addHistoryRecord } = useAppStore();
  const [activeTab, setActiveTab] = useState<"timesheet" | "spl" | "export">("timesheet");
  const [header, setHeader] = useState<TimesheetHeader>(DEFAULT_HEADER);
  const [rows, setRows] = useState<TimesheetRow[]>(() =>
    generateMonthRows(DEFAULT_HEADER.month, DEFAULT_HEADER.year, {
      projectName: DEFAULT_HEADER.projectName,
      projectId: DEFAULT_HEADER.projectId,
      aplikasiBerdampak: DEFAULT_HEADER.aplikasiBerdampak,
      aipFitur: DEFAULT_HEADER.aipFitur,
    })
  );
  const [isLoaded, setIsLoaded] = useState(false);

  // Load draft on mount (client-only, completely prevents SSR hydration mismatch)
  useEffect(() => {
    const draft = timesheetDraft || loadTimesheetDraft();
    if (draft?.header) {
      setHeader({
        ...draft.header,
        signatureDataUrl: draft.header.signatureDataUrl || profile.signatureDataUrl,
      });
    } else if (profile?.name) {
      setHeader((prev) => ({
        ...prev,
        name: profile.name || prev.name,
        npp: profile.employeeId || prev.npp,
        department: profile.department || prev.department,
        employeeTitle: profile.position || prev.employeeTitle,
        projectName: profile.project || prev.projectName,
        projectId: profile.projectId || prev.projectId,
        aplikasiBerdampak: profile.aplikasiBerdampak || prev.aplikasiBerdampak,
        aipFitur: profile.aipFitur || prev.aipFitur,
        officerName: profile.officerName || prev.officerName,
        officerTitle: profile.officerPosition || prev.officerTitle,
        managerName: profile.supervisorName || prev.managerName,
        managerTitle: profile.supervisorPosition || prev.managerTitle,
        deptHeadName: profile.approverName || prev.deptHeadName,
        deptHeadTitle: profile.approverPosition || prev.deptHeadTitle,
        signatureDataUrl: profile.signatureDataUrl || prev.signatureDataUrl,
      }));
    }
    if (draft?.rows && draft.rows.length > 0) {
      setRows(draft.rows);
    }
    setIsLoaded(true);
  }, []);

  const [isExporting, setIsExporting] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "info" | "warning" } | null>(null);
  
  // UI states
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [showProjectColumns, setShowProjectColumns] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "workdays" | "weekends" | "overtime" | "absence">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSPLRow, setSelectedSPLRow] = useState<TimesheetRow | null>(null);
  const [showQuickFillModal, setShowQuickFillModal] = useState(false);
  const [quickFillStart, setQuickFillStart] = useState("08:00:00");
  const [quickFillEnd, setQuickFillEnd] = useState("17:00:00");
  const [quickFillTask, setQuickFillTask] = useState("");

  // Show Toast
  const showToast = useCallback((text: string, type: "success" | "info" | "warning" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4500);
  }, []);

  // 2. Auto-save draft on changes (debounced), only after initial draft is loaded
  useEffect(() => {
    if (!isLoaded) return;
    if (rows.length > 0) {
      const timeout = setTimeout(() => {
        saveTimesheetDraft(header, rows);
        setTimesheetDraft(header, rows);
      }, 800);
      return () => clearTimeout(timeout);
    }
  }, [header, rows, isLoaded, setTimesheetDraft]);

  // Regenerate rows when Month/Year changes
  const handleRegenerateMonth = useCallback(
    (month: number, year: number) => {
      const generated = generateMonthRows(month, year, {
        projectName: header.projectName,
        projectId: header.projectId,
        aplikasiBerdampak: header.aplikasiBerdampak,
        aipFitur: header.aipFitur,
        holidays,
      });
      const periodeLabel = `${MONTH_NAMES_TITLE[month - 1]} ${year}`;
      setHeader((h) => ({ ...h, month, year, periode: periodeLabel }));
      setRows(generated);
      showToast(`Kalender diperbarui ke ${periodeLabel} (${generated.length} hari)`, "info");
    },
    [header.projectName, header.projectId, header.aplikasiBerdampak, header.aipFitur, holidays, showToast]
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
                const defaultStart = r.isWeekend ? "09:00:00" : "08:00:00";
                const defaultEnd = r.isWeekend ? "18:00:00" : "17:00:00";
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
    let updatedRow: TimesheetRow | null = null;
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const d = new Date(r.date);
        const hours = calcHours("09:00:00", "18:00:00", d.getDay());
        const updated: TimesheetRow = {
          ...r,
          status: "P" as AttendanceStatus,
          startTime: "09:00:00",
          endTime: "18:00:00",
          totalHours: hours,
          isOvertime: true,
          overtimeStartTime: "09:00:00",
          overtimeEndTime: "18:00:00",
          activity: r.activity === "Weekend" || !r.activity ? "Support SIT & Perbaikan Defect" : r.activity,
        };
        updatedRow = updated;
        return updated;
      })
    );
    showToast("Hari lembur akhir pekan berhasil ditambahkan. SPL otomatis disiapkan!", "success");
    if (updatedRow) {
      setSelectedSPLRow(updatedRow);
    }
  }, [showToast]);

  // Quick Action: Enable Overtime for Weekday Row
  const handleAddWeekdayOvertime = useCallback((rowId: string) => {
    let updatedRow: TimesheetRow | null = null;
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const d = new Date(r.date);
        const start = r.startTime ? formatTimeWithSeconds(r.startTime) : "08:00:00";
        // If current endTime is 17:00:00 or less (or empty), extend to 20:00:00
        const end = (!r.endTime || r.endTime <= "17:00:00") ? "20:00:00" : formatTimeWithSeconds(r.endTime);
        const hours = calcHours(start, end, d.getDay());
        const updated: TimesheetRow = {
          ...r,
          status: "P" as AttendanceStatus,
          startTime: start,
          endTime: end,
          totalHours: hours,
          isOvertime: true,
          overtimeStartTime: r.overtimeStartTime ? formatTimeWithSeconds(r.overtimeStartTime) : "17:00:00",
          overtimeEndTime: r.overtimeEndTime ? formatTimeWithSeconds(r.overtimeEndTime) : end,
          activity: (!r.activity || r.activity === "Weekend") ? "Lembur: Support & Penyelesaian Defect" : r.activity,
        };
        updatedRow = updated;
        return updated;
      })
    );
    showToast("Lembur hari kerja berhasil diaktifkan! Atur jam & tugas lembur di dialog SPL.", "success");
    if (updatedRow) {
      setSelectedSPLRow(updatedRow);
    }
  }, [showToast]);

  // Quick Action: Remove Overtime from a Row
  const handleRemoveOvertime = useCallback((rowId: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        if (r.isWeekend) {
          return {
            ...r,
            status: "X" as AttendanceStatus,
            startTime: "",
            endTime: "",
            totalHours: 0,
            activity: "Weekend",
            isOvertime: false,
            overtimeStartTime: undefined,
            overtimeEndTime: undefined,
          };
        } else {
          const d = new Date(r.date);
          const standardHours = d.getDay() === 5 ? 7.5 : 8.0;
          return {
            ...r,
            startTime: "08:00:00",
            endTime: "17:00:00",
            totalHours: standardHours,
            isOvertime: false,
            overtimeStartTime: undefined,
            overtimeEndTime: undefined,
          };
        }
      })
    );
    setSelectedSPLRow(null);
    showToast("Status lembur berhasil dinonaktifkan.", "info");
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

  // Overtime rows (both weekdays and weekends)
  const overtimeRows = useMemo(() => {
    return rows.filter(isOvertimeRow);
  }, [rows]);

  const totalSPLOvertimeHours = useMemo(() => {
    return overtimeRows.reduce((acc, row) => {
      if (row.isWeekend) {
        return acc + (row.totalHours || 0);
      }
      const otStart = row.overtimeStartTime || "17:00";
      const otEnd = row.overtimeEndTime || row.endTime || "20:00";
      return acc + calcHours(otStart, otEnd);
    }, 0);
  }, [overtimeRows]);

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
      if (filterMode === "overtime" && !isOvertimeRow(r)) return false;
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

  const recordTimesheetHistory = (hdr: TimesheetHeader, rws: TimesheetRow[]) => {
    saveTimesheetToHistory(hdr, rws);
    const s = summarizeTimesheet(rws);
    const ot = rws.filter(isOvertimeRow).length;
    const periodeLabel = `${MONTH_NAMES_TITLE[hdr.month - 1]} ${hdr.year}`;
    addHistoryRecord({
      kind: "timesheet",
      title: `Timesheet ${periodeLabel}`,
      periode: periodeLabel,
      employeeName: hdr.name,
      employeeId: hdr.npp,
      summaryText: `${s.totalHours.toFixed(1)} Jam • ${s.present} Hari Masuk • ${ot} Lembur`,
      payload: { kind: "timesheet", header: hdr, rows: rws },
    });
  };

  // Handle Timesheet Excel export
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const hdr = { ...header, signatureDataUrl: header.signatureDataUrl || profile.signatureDataUrl };
      await exportTimesheetExcel({ header: hdr, rows });
      showToast("File Timesheet Excel (.xlsx) resmi Adidata berhasil didownload!", "success");
      recordTimesheetHistory(hdr, rows);
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
      const hdr = { ...header, signatureDataUrl: header.signatureDataUrl || profile.signatureDataUrl };
      exportTimesheetPDF({ header: hdr, rows });
      showToast("Dialog cetak / PDF dibuka. Siap dicetak!", "info");
      recordTimesheetHistory(hdr, rows);
    } catch (e: unknown) {
      console.error(e);
      showToast("Gagal memproses cetak PDF", "warning");
    }
  };

  // Handle single SPL Export
  const handleExportSingleSPL = async (row: TimesheetRow) => {
    setIsExporting(true);
    try {
      const otStart = row.overtimeStartTime || (row.isWeekend ? (row.startTime || "09:00") : "17:00");
      const otEnd = row.overtimeEndTime || (row.endTime || "20:00");
      const formattedStart = otStart.length === 5 ? `${otStart}:00` : otStart;
      const formattedEnd = otEnd.length === 5 ? `${otEnd}:00` : otEnd;

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
            startTime: formattedStart,
            endTime: formattedEnd,
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

  // Handle single SPL PDF Export
  const handleExportSingleSPLPDF = (row: TimesheetRow) => {
    try {
      const otStart = row.overtimeStartTime || (row.isWeekend ? (row.startTime || "09:00") : "17:00");
      const otEnd = row.overtimeEndTime || (row.endTime || "20:00");
      const formattedStart = otStart.length === 5 ? `${otStart}:00` : otStart;
      const formattedEnd = otEnd.length === 5 ? `${otEnd}:00` : otEnd;

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
            startTime: formattedStart,
            endTime: formattedEnd,
            tasks: row.activity || "1. Support SIT\n2. Perbaikan Defect",
          },
        ],
      };
      exportSPLPDF(splData);
      showToast(`Pratinjau SPL PDF resmi tanggal ${row.date} dibuka!`, "info");
    } catch (e: unknown) {
      console.error(e);
      showToast("Gagal memproses cetak PDF SPL", "warning");
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
    recordTimesheetHistory(header, rows);
    showToast(`Timesheet periode ${header.periode} berhasil diarsipkan ke Riwayat!`, "success");
  };

  return (
    <div className="animate-fade-in" style={{ position: "relative" }}>
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className="app-toast animate-fade-in"
          style={{
            border: `1px solid ${
              toastMsg.type === "success"
                ? "var(--green)"
                : toastMsg.type === "warning"
                ? "var(--amber)"
                : "var(--accent)"
            }`,
          }}
        >
          <span style={{ color: toastMsg.type === "success" ? "var(--green)" : toastMsg.type === "warning" ? "var(--amber)" : "var(--accent)" }}>
            {toastMsg.type === "success" ? <CheckCircleIcon size={16} /> : <AlertCircleIcon size={16} />}
          </span>
          <span style={{ flex: 1 }}>{toastMsg.text}</span>
          <button
            onClick={() => setToastMsg(null)}
            style={{ background: "none", border: "none", color: "var(--text-lo)", cursor: "pointer", padding: "2px 4px", fontSize: "14px" }}
            aria-label="Tutup notifikasi"
          >
            ✕
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">
          Timesheet &amp; Surat Lembur Adidata
        </h1>
        <p className="page-subtitle">
          Pencatatan jam kerja harian, lembur, dan ekspor dokumen resmi Adidata dengan perhitungan potongan istirahat otomatis (Jumat 1.5 jam, hari lain 1 jam).
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
            <span>Editor Timesheet</span>
          </button>
          <span className="stepper-separator">›</span>
          <button
            type="button"
            className={`stepper-item ${activeTab === "spl" ? "active" : ""}`}
            onClick={() => setActiveTab("spl")}
          >
            <span className="stepper-badge">2</span>
            <span>Surat Lembur (SPL)</span>
            {overtimeRows.length > 0 && (
              <span
                style={{
                  background: "var(--amber-dim)",
                  border: "1px solid var(--amber-dim-border)",
                  color: "var(--amber-text)",
                  padding: "1px 6px",
                  borderRadius: "9999px",
                  fontSize: "0.68rem",
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
            <span>Export & Unduh</span>
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
                  width: "40px",
                  height: "40px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--accent-dim)",
                  border: "1px solid var(--accent-dim-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--accent)",
                  flexShrink: 0,
                }}
              >
                <UserIcon size={18} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "1.02rem", fontWeight: 700, color: "var(--text-hi)" }}>
                    {header.name || "Nama Karyawan"}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono, monospace)",
                      fontSize: "0.76rem",
                      background: "var(--btn-secondary-bg)",
                      border: "1px solid var(--border)",
                      padding: "2px 7px",
                      borderRadius: "var(--radius-xs)",
                      color: "var(--text-mid)",
                      fontWeight: 600,
                    }}
                  >
                    NPP {header.npp || "-"}
                  </span>
                  <span
                    style={{
                      fontSize: "0.74rem",
                      background: "var(--accent-dim)",
                      border: "1px solid var(--accent-dim-border)",
                      color: "var(--accent)",
                      padding: "2px 7px",
                      borderRadius: "var(--radius-xs)",
                      fontWeight: 600,
                    }}
                  >
                    {header.department || "EDV / ADV"}
                  </span>
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-mid)", marginTop: "4px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <BriefcaseIcon size={13} />
                  <span><strong>{header.projectName || "Proyek"}</strong> ({header.projectId || "ID"})</span>
                  <span>•</span>
                  <span>Periode: <strong>{MONTH_NAMES_TITLE[header.month - 1]} {header.year}</strong></span>
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
                <SparklesIcon size={13} />
                <span>Muat Contoh Data</span>
              </button>
              <button
                type="button"
                className={`btn btn-sm ${showProfileDrawer ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setShowProfileDrawer(!showProfileDrawer)}
              >
                <EditIcon size={13} />
                <span>{showProfileDrawer ? "Tutup Form Detail" : "Edit Info & TTD"}</span>
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
              <span className="stat-icon"><ClockIcon size={15} /></span>
            </div>
            <div className="stat-value">{summary.totalHours.toFixed(1)}h</div>
            <div className="stat-subtext">Netto setelah potong istirahat</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Hari Masuk (P)</span>
              <span className="stat-icon"><BriefcaseIcon size={15} /></span>
            </div>
            <div className="stat-value" style={{ color: "var(--green)" }}>
              {summary.present}
            </div>
            <div className="stat-subtext">Dari {rows.length} total hari kalender</div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Lembur / SPL</span>
              <span className="stat-icon"><MoonIcon size={15} /></span>
            </div>
            <div className="stat-value" style={{ color: overtimeRows.length > 0 ? "var(--amber-text)" : "var(--text-mid)" }}>
              {overtimeRows.length} Hari
            </div>
            <div className="stat-subtext">
              {overtimeRows.length > 0 ? "Siap diekspor ke format SPL" : "Tidak ada lembur"}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <span className="stat-label">Cuti / Sakit / Izin</span>
              <span className="stat-icon"><UmbrellafillIcon size={15} /></span>
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
              <span className="stat-icon">
                {emptyActivityCount === 0 ? <CheckCircleIcon size={15} /> : <AlertCircleIcon size={15} />}
              </span>
            </div>
            <div
              className="stat-value"
              style={{
                fontSize: "1.15rem",
                color: emptyActivityCount === 0 ? "var(--green)" : "var(--amber-text)",
                paddingTop: "6px",
              }}
            >
              {emptyActivityCount === 0 ? "Lengkap" : `${emptyActivityCount} Kosong`}
            </div>
            <div className="stat-subtext">
              {emptyActivityCount === 0 ? "Semua hari kerja memiliki remark" : "Ada hari kerja tanpa remark"}
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
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <input
                    type="text"
                    className="table-input-compact"
                    placeholder="Cari aktivitas..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: "160px", paddingLeft: "26px" }}
                  />
                  <div style={{ position: "absolute", left: "8px", pointerEvents: "none", color: "var(--text-lo)", display: "flex", alignItems: "center" }}>
                    <SearchIcon size={12} />
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowProjectColumns(!showProjectColumns)}
                  title="Tampilkan / sembunyikan kolom Project Name, ID, App, Fitur"
                >
                  <SlidersIcon size={13} />
                  <span>{showProjectColumns ? "Kolom Ringkas" : "Kolom Proyek"}</span>
                </button>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowQuickFillModal(true)}
                >
                  <SparklesIcon size={13} />
                  <span>Isi Cepat Jam Kerja</span>
                </button>
              </div>
            </div>

            {/* Quick Task Template Bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 12px",
                background: "var(--bg-card-subtle)",
                borderRadius: "var(--radius-sm)",
                marginBottom: "12px",
                border: "1px solid var(--border)",
                overflowX: "auto",
              }}
            >
              <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-lo)", whiteSpace: "nowrap" }}>
                Preset aktivitas kosong:
              </span>
              {TASK_PRESETS.slice(0, 4).map((task) => (
                <button
                  key={task}
                  type="button"
                  onClick={() => handleApplyTaskPresetToEmpty(task)}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: "0.74rem", padding: "3px 8px" }}
                  title="Klik untuk mengisi hari kerja yang aktivitasnya masih kosong"
                >
                  + {task}
                </button>
              ))}
            </div>

            {/* Main Interactive Table */}
            <div className="timesheet-table-wrapper">
              <div className="mobile-scroll-hint">
                <span>👈 Geser tabel ke samping untuk rincian jam, remark &amp; lembur 👉</span>
              </div>
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
                      const isOvertime = isOvertimeRow(row);
                      const isWeekendWorking = row.isWeekend && row.status === "P";
                      const isWeekendOff = row.isWeekend && row.status !== "P";
                      const isMissingActivity = row.status === "P" && (!row.activity || row.activity.trim() === "");
                      const [, monthNum, dayNum] = row.date.split("-").map(Number);
                      const monthLabel = MONTH_NAMES_TITLE[(monthNum || 1) - 1]?.slice(0, 3) || "";

                      return (
                        <tr
                          key={row.id}
                          className={
                            isOvertime
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
                              step="1"
                              className="table-input-compact"
                              value={formatTimeWithSeconds(row.startTime)}
                              disabled={row.status !== "P"}
                              onChange={(e) => updateRow(row.id, "startTime", e.target.value)}
                            />
                          </td>

                          {/* End Time Input */}
                          <td>
                            <input
                              type="time"
                              step="1"
                              className="table-input-compact"
                              value={formatTimeWithSeconds(row.endTime)}
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
                                  color: isOvertime ? "var(--accent-amber)" : "var(--accent-cyan)",
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
                                    color: "var(--amber-text)",
                                    pointerEvents: "none",
                                    display: "flex",
                                    alignItems: "center",
                                  }}
                                  title="Aktivitas masih kosong"
                                >
                                  <AlertCircleIcon size={13} />
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
                                  padding: "3px 7px",
                                  color: "var(--text-mid)",
                                  border: "1px dashed var(--border-mid)",
                                }}
                                title="Catat jam kerja lembur di akhir pekan ini"
                              >
                                <PlusIcon size={11} />
                                <span>Lembur</span>
                              </button>
                            ) : isOvertime ? (
                              <button
                                type="button"
                                className="btn btn-warning btn-sm"
                                onClick={() => setSelectedSPLRow(row)}
                                style={{ fontSize: "0.74rem", padding: "3px 8px", fontWeight: 700 }}
                                title={
                                  row.isWeekend
                                    ? "Surat Perintah Lembur (Akhir Pekan)"
                                    : "Surat Perintah Lembur (Hari Kerja)"
                                }
                              >
                                <FileTextIcon size={12} />
                                <span>SPL</span>
                              </button>
                            ) : row.status === "P" ? (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleAddWeekdayOvertime(row.id)}
                                style={{
                                  fontSize: "0.72rem",
                                  padding: "3px 7px",
                                  color: "var(--text-mid)",
                                  border: "1px dashed var(--border-mid)",
                                }}
                                title="Tambah lembur di hari kerja ini"
                              >
                                <PlusIcon size={11} />
                                <span>Lembur</span>
                              </button>
                            ) : (
                              <span style={{ color: "var(--text-lo)", fontSize: "0.75rem" }}>—</span>
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
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleCopySummary}
                >
                  <CopyIcon size={13} />
                  <span>Salin Ringkasan (WA/Slack)</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleManualSaveArchive}
                >
                  <ArchiveIcon size={13} />
                  <span>Simpan ke Riwayat</span>
                </button>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                {overtimeRows.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-warning"
                    onClick={() => setActiveTab("spl")}
                  >
                    <span>Review {overtimeRows.length} SPL →</span>
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setActiveTab("export")}
                >
                  <span>Ke Download &amp; Cetak →</span>
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
                  <div className="card-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  </div>
                  <span>Daftar Surat Lembur (SPL)</span>
                </div>
                <div className="card-subtitle">
                  Sistem otomatis mendeteksi hari lembur dari aktivitas hari kerja (weekdays) maupun akhir pekan (weekends).
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
                  padding: "3rem 1.5rem",
                  background: "var(--bg-card-subtle)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ color: "var(--text-lo)", marginBottom: "0.75rem", display: "flex", justifyContent: "center" }}>
                  <FileTextIcon size={32} />
                </div>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-hi)" }}>
                  Belum Ada Hari Lembur yang Terdeteksi
                </h3>
                <p style={{ color: "var(--text-mid)", fontSize: "0.85rem", maxWidth: "450px", margin: "0.4rem auto 1.25rem" }}>
                  Untuk mencatat lembur, buka <strong>Editor Timesheet</strong> lalu klik tombol <strong>+ Lembur</strong> di baris hari kerja (Senin–Jumat) atau akhir pekan (Sabtu/Minggu).
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
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div className="alert alert-info" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <SparklesIcon size={16} />
                    <span>
                      Ditemukan <strong>{overtimeRows.length} penugasan lembur</strong> (hari kerja &amp; akhir pekan). Unduh formulir SPL resmi Adidata per tanggal tugas di bawah ini.
                    </span>
                  </div>
                  <span
                    style={{
                      background: "var(--amber-dim)",
                      border: "1px solid var(--amber-dim-border)",
                      color: "var(--amber-text)",
                      padding: "3px 10px",
                      borderRadius: "9999px",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Total Keseluruhan: {totalSPLOvertimeHours} Jam Lembur
                  </span>
                </div>

                {overtimeRows.map((ot, index) => {
                  const otStart = ot.overtimeStartTime || (ot.isWeekend ? (ot.startTime || "09:00") : "17:00");
                  const otEnd = ot.overtimeEndTime || (ot.endTime || "20:00");

                  return (
                    <div
                      key={ot.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "14px 16px",
                        background: "var(--bg-card-subtle)",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border)",
                        flexWrap: "wrap",
                        gap: "12px",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, color: "var(--text-hi)", fontSize: "0.92rem" }}>
                            Penugasan #{index + 1}: {ot.dayName}, {ot.date}
                          </span>
                          <span
                            style={{
                              background: ot.isWeekend ? "var(--amber-dim)" : "var(--accent-dim)",
                              border: `1px solid ${ot.isWeekend ? "var(--amber-dim-border)" : "var(--accent-dim-border)"}`,
                              color: ot.isWeekend ? "var(--amber-text)" : "var(--accent)",
                              padding: "2px 7px",
                              borderRadius: "var(--radius-xs)",
                              fontWeight: 700,
                              fontSize: "0.72rem",
                            }}
                          >
                            {ot.isWeekend ? "Akhir Pekan" : "Hari Kerja"}
                          </span>
                          <span
                            style={{
                              background: "var(--amber-dim)",
                              border: "1px solid var(--amber-dim-border)",
                              color: "var(--amber-text)",
                              padding: "2px 7px",
                              borderRadius: "var(--radius-xs)",
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              fontFamily: "var(--font-mono, monospace)",
                            }}
                            title="Jam Lembur untuk formulir SPL"
                          >
                            SPL: {otStart} - {otEnd}
                          </span>
                          {!ot.isWeekend && (
                            <span style={{ fontSize: "0.75rem", color: "var(--text-lo)" }}>
                              (Hadir: {ot.startTime} - {ot.endTime})
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: "0.82rem",
                            color: "var(--text-mid)",
                            marginTop: "4px",
                            whiteSpace: "pre-line",
                            lineHeight: 1.45,
                          }}
                        >
                          {ot.activity || "Belum ada rincian tugas lembur..."}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedSPLRow(ot)}
                        >
                          <EditIcon size={12} />
                          <span>Edit Rincian</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleExportSingleSPL(ot)}
                          disabled={isExporting}
                        >
                          <DownloadIcon size={12} />
                          <span>Unduh SPL Excel</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
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
                  <div className="card-icon">
                    <DownloadIcon size={15} />
                  </div>
                  <span>Export & Unduh Dokumen</span>
                </div>
                <div className="card-subtitle">
                  Unduh formulir Timesheet Excel (.xlsx) resmi Adidata atau cetak format PDF.
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
              <div className="alert alert-warning" style={{ marginBottom: "1.25rem" }}>
                <AlertCircleIcon size={16} />
                <span>
                  Perhatian: Terdapat <strong>{emptyActivityCount} hari kerja</strong> tanpa deskripsi aktivitas. Anda tetap dapat mengunduh dokumen, namun disarankan melengkapinya terlebih dahulu.
                </span>
              </div>
            ) : (
              <div className="alert alert-success" style={{ marginBottom: "1.25rem" }}>
                <CheckCircleIcon size={16} />
                <span>
                  Timesheet <strong>{header.name}</strong> ({header.npp}) periode{" "}
                  <strong>
                    {MONTH_NAMES_TITLE[header.month - 1]} {header.year}
                  </strong>{" "}
                  lengkap dan siap diekspor.
                </span>
              </div>
            )}

            {/* Primary Action Buttons */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "1rem",
                marginBottom: "1.75rem",
              }}
            >
              <div
                style={{
                  background: "var(--bg-card-subtle)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--green-dim)",
                      border: "1px solid var(--green-dim-border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--green)",
                      flexShrink: 0,
                    }}
                  >
                    <DownloadIcon size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-hi)" }}>
                      Timesheet Excel (.xlsx)
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-mid)" }}>
                      Format resmi Adidata, kalkulasi jam kerja otomatis
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
                  <DownloadIcon size={15} />
                  <span>{isExporting ? "Memproses..." : "Unduh Excel (.xlsx)"}</span>
                </button>
              </div>

              <div
                style={{
                  background: "var(--bg-card-subtle)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--accent-dim)",
                      border: "1px solid var(--accent-dim-border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--accent)",
                      flexShrink: 0,
                    }}
                  >
                    <PrinterIcon size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-hi)" }}>
                      Cetak / PDF
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-mid)" }}>
                      Format landscape A4 resmi dengan kolom tanda tangan
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  onClick={handleExportPDF}
                  style={{ width: "100%", marginTop: "auto" }}
                >
                  <PrinterIcon size={15} />
                  <span>Cetak / Simpan PDF</span>
                </button>
              </div>

              <div
                style={{
                  background: "var(--bg-card-subtle)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--btn-secondary-bg)",
                      border: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--text-mid)",
                      flexShrink: 0,
                    }}
                  >
                    <CopyIcon size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-hi)" }}>
                      Salin Ringkasan Teks
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-mid)" }}>
                      Format pelaporan siap kirim via WhatsApp atau Slack
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-lg"
                  onClick={handleCopySummary}
                  style={{ width: "100%", marginTop: "auto" }}
                >
                  <CopyIcon size={15} />
                  <span>Salin Teks Ringkasan</span>
                </button>
              </div>
            </div>

            {/* Document Verification Overview */}
            <div
              style={{
                background: "var(--bg-card-subtle)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                padding: "1.25rem",
              }}
            >
              <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-mid)", marginBottom: "1rem" }}>
                Tanda tangan &amp; otorisasi
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-lo)" }}>Pemeriksa 1 — Officer</div>
                  <div style={{ fontWeight: 600, color: "var(--text-hi)", marginTop: "2px" }}>
                    {header.officerName || "—"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-lo)" }}>Pemeriksa 2 — Team Leader</div>
                  <div style={{ fontWeight: 600, color: "var(--text-hi)", marginTop: "2px" }}>
                    {header.managerName || "—"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-lo)" }}>Menyetujui — Dept Head</div>
                  <div style={{ fontWeight: 600, color: "var(--text-hi)", marginTop: "2px" }}>
                    {header.deptHeadName || "—"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-lo)" }}>Tanggal tanda tangan</div>
                  <div style={{ fontWeight: 600, color: "var(--text-hi)", marginTop: "2px" }}>
                    {header.dateStamp || "—"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            MODAL: EDIT SPL TASKS & HOURS
        ========================================================================= */}
        {selectedSPLRow && (() => {
          const otStart = selectedSPLRow.overtimeStartTime || (selectedSPLRow.isWeekend ? (selectedSPLRow.startTime || "09:00") : "17:00");
          const otEnd = selectedSPLRow.overtimeEndTime || (selectedSPLRow.endTime || "20:00");
          const otDiff = calcHours(otStart, otEnd);

          return (
            <div className="modal-backdrop animate-fade-in" onClick={() => setSelectedSPLRow(null)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "560px" }}>
                <div className="card-header" style={{ marginBottom: "1rem" }}>
                  <div className="card-title">
                    <div className="card-icon">
                      <FileTextIcon size={14} />
                    </div>
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

                {/* Day status badge & date */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    background: "var(--bg-card-subtle)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    marginBottom: "1.25rem",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--text-hi)", fontSize: "0.95rem" }}>
                      {selectedSPLRow.dayName}, {selectedSPLRow.date}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-mid)", marginTop: "2px" }}>
                      Jam Hadir Timesheet: <strong>{selectedSPLRow.startTime || "—"}</strong> s/d <strong>{selectedSPLRow.endTime || "—"}</strong> ({selectedSPLRow.totalHours} Jam)
                    </div>
                  </div>
                  <span
                    style={{
                      background: selectedSPLRow.isWeekend ? "var(--amber-dim)" : "var(--accent-dim)",
                      border: `1px solid ${selectedSPLRow.isWeekend ? "var(--amber-dim-border)" : "var(--accent-dim-border)"}`,
                      color: selectedSPLRow.isWeekend ? "var(--amber-text)" : "var(--accent)",
                      padding: "4px 8px",
                      borderRadius: "var(--radius-xs)",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    {selectedSPLRow.isWeekend ? "Akhir Pekan" : "Hari Kerja"}
                  </span>
                </div>

                {/* Overtime Hours Configuration */}
                <div style={{ marginBottom: "1.25rem" }}>
                  <label className="form-label" style={{ marginBottom: "6px" }}>
                    Rentang Waktu Pelaksanaan Lembur (Format SPL)
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                    <div>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-mid)", display: "block", marginBottom: "4px" }}>
                        Mulai Lembur
                      </span>
                      <input
                        type="time"
                        step="1"
                        className="form-input"
                        value={otStart}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateRow(selectedSPLRow.id, "overtimeStartTime", val);
                          setSelectedSPLRow((prev) => (prev ? { ...prev, overtimeStartTime: val } : null));
                        }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-mid)", display: "block", marginBottom: "4px" }}>
                        Selesai Lembur
                      </span>
                      <input
                        type="time"
                        step="1"
                        className="form-input"
                        value={otEnd}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateRow(selectedSPLRow.id, "overtimeEndTime", val);
                          // Sync timesheet endTime if overtime end is later
                          if (val > selectedSPLRow.endTime) {
                            updateRow(selectedSPLRow.id, "endTime", val);
                          }
                          setSelectedSPLRow((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  overtimeEndTime: val,
                                  endTime: val > prev.endTime ? val : prev.endTime,
                                }
                              : null
                          );
                        }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-mid)", display: "block", marginBottom: "4px" }}>
                        Durasi Lembur
                      </span>
                      <div
                        style={{
                          height: "38px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "var(--bg-input)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-xs)",
                          fontWeight: 700,
                          color: "var(--amber-text)",
                          fontSize: "0.85rem",
                          fontFamily: "var(--font-mono, monospace)",
                        }}
                      >
                        {otDiff > 0 ? `${otDiff} Jam` : "—"}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-lo)", marginTop: "6px" }}>
                    {selectedSPLRow.isWeekend
                      ? "Lembur akhir pekan dihitung berdasarkan durasi tugas di hari libur."
                      : "Pada hari kerja, jam lembur biasanya dimulai setelah jam pulang standar kantor (17:00)."}
                  </div>
                </div>

                {/* Overtime Task Details */}
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

                {/* Actions */}
                <div style={{ display: "flex", gap: "10px", justifyContent: "space-between", alignItems: "center" }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ color: "var(--accent-rose)", borderColor: "rgba(239, 68, 68, 0.3)" }}
                    onClick={() => handleRemoveOvertime(selectedSPLRow.id)}
                    title="Hapus status lembur dan kembalikan ke jam normal"
                  >
                    <TrashIcon size={13} />
                    <span>Batalkan Lembur</span>
                  </button>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setSelectedSPLRow(null)}
                    >
                      Tutup
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        handleExportSingleSPLPDF(selectedSPLRow);
                        setSelectedSPLRow(null);
                      }}
                    >
                      <PrinterIcon size={14} />
                      <span>Cetak / PDF SPL</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={async () => {
                        await handleExportSingleSPL(selectedSPLRow);
                        setSelectedSPLRow(null);
                      }}
                    >
                      <DownloadIcon size={14} />
                      <span>Unduh SPL Excel</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* =========================================================================
            MODAL: QUICK BULK FILL WORKING DAYS
        ========================================================================= */}
        {showQuickFillModal && (
          <div className="modal-backdrop animate-fade-in" onClick={() => setShowQuickFillModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="card-header">
                <div className="card-title">
                  <div className="card-icon">
                    <SparklesIcon size={14} />
                  </div>
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

              <p style={{ fontSize: "0.85rem", color: "var(--text-mid)", marginBottom: "1.25rem" }}>
                Terapkan jam kerja default ke seluruh hari kerja aktif (Senin - Jumat). Rumus akan otomatis memotong jam istirahat sesuai aturan Adidata (Jumat 1.5h, lainnya 1h).
              </p>

              <div className="form-grid" style={{ marginBottom: "1.25rem" }}>
                <div className="form-group">
                  <label className="form-label">Jam Mulai</label>
                  <input
                    type="time"
                    step="1"
                    className="form-input"
                    value={quickFillStart}
                    onChange={(e) => setQuickFillStart(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Jam Selesai</label>
                  <input
                    type="time"
                    step="1"
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
                  <SparklesIcon size={14} />
                  <span>Terapkan Sekarang</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

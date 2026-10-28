"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import type { SavedTimesheetRecord } from "@/lib/types";
import {
  loadTimesheetHistory,
  deleteTimesheetFromHistory,
  saveTimesheetDraft,
  MONTH_NAMES_TITLE,
} from "@/lib/types";
import { useAppStore, type HistoryRecord } from "@/lib/storage";
import { exportTimesheetExcel, exportSPLExcel, exportIzinExcel } from "@/lib/excel-export";
import { exportTimesheetPDF, exportSPLPDF, exportIzinPDF } from "@/lib/pdf-export";
import {
  ArchiveIcon,
  CalendarIcon,
  UserIcon,
  DownloadIcon,
  EditIcon,
  TrashIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  FileTextIcon,
  CopyIcon,
  PlusIcon,
} from "@/components/Icons";

export default function RiwayatPage() {
  const router = useRouter();
  const {
    history,
    duplicateHistoryRecord,
    deleteHistoryRecord,
    clearHistory,
    setTimesheetDraft,
    setSPLDraft,
    setIzinDraft,
    exportBackupJson,
    importBackupJson,
  } = useAppStore();

  const [legacyRecords, setLegacyRecords] = useState<SavedTimesheetRecord[]>([]);
  const [filterKind, setFilterKind] = useState<"all" | "timesheet" | "spl" | "izin">("all");
  const [isExportingId, setIsExportingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "info" | "warning" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLegacyRecords(loadTimesheetHistory());
  }, []);

  const showToast = (text: string, type: "success" | "info" | "warning" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Combine unified history + any legacy timesheet records not yet in unified history
  const unifiedIds = new Set(history.map((h) => h.id));
  const combinedList: HistoryRecord[] = [
    ...history,
    ...legacyRecords
      .filter((lr) => !unifiedIds.has(lr.id))
      .map(
        (lr): HistoryRecord => ({
          id: lr.id,
          kind: "timesheet",
          title: `Timesheet ${MONTH_NAMES_TITLE[lr.header.month - 1]} ${lr.header.year}`,
          periode: `${MONTH_NAMES_TITLE[lr.header.month - 1]} ${lr.header.year}`,
          employeeName: lr.header.name,
          employeeId: lr.header.npp,
          savedAt: lr.savedAt,
          summaryText: `${lr.totalHours.toFixed(1)} Jam • ${lr.presentDays} Hari Masuk • ${lr.overtimeDays} Lembur`,
          payload: { kind: "timesheet", header: lr.header, rows: lr.rows },
        })
      ),
  ];

  const filteredList = combinedList.filter((item) =>
    filterKind === "all" ? true : item.kind === filterKind
  );

  const handleOpenInEditor = (rec: HistoryRecord) => {
    if (rec.payload.kind === "timesheet") {
      saveTimesheetDraft(rec.payload.header, rec.payload.rows);
      setTimesheetDraft(rec.payload.header, rec.payload.rows);
      showToast(`Timesheet ${rec.periode} dimuat ke editor!`, "success");
      router.push("/timesheet");
    } else if (rec.payload.kind === "spl") {
      setSPLDraft(rec.payload.data);
      showToast(`SPL ${rec.periode} dimuat ke editor!`, "success");
      router.push("/spl");
    } else if (rec.payload.kind === "izin") {
      setIzinDraft(rec.payload.data);
      showToast(`Surat Izin ${rec.periode} dimuat ke editor!`, "success");
      router.push("/izin");
    }
  };

  const handleDuplicate = (rec: HistoryRecord) => {
    const dup = duplicateHistoryRecord(rec.id);
    if (dup) {
      showToast(`Dokumen "${rec.title}" berhasil diduplikasi!`, "success");
    } else if (rec.payload.kind === "timesheet") {
      // If it was a legacy record, add it to unified store as a copy
      useAppStore.getState().addHistoryRecord({
        kind: rec.kind,
        title: `${rec.title} (Salinan)`,
        periode: rec.periode,
        employeeName: rec.employeeName,
        employeeId: rec.employeeId,
        summaryText: rec.summaryText,
        payload: rec.payload,
      });
      showToast(`Dokumen "${rec.title}" berhasil diduplikasi!`, "success");
    }
  };

  const handleDownloadExcel = async (rec: HistoryRecord) => {
    setIsExportingId(rec.id);
    try {
      if (rec.payload.kind === "timesheet") {
        await exportTimesheetExcel({ header: rec.payload.header, rows: rec.payload.rows });
      } else if (rec.payload.kind === "spl") {
        await exportSPLExcel(rec.payload.data);
      } else if (rec.payload.kind === "izin") {
        await exportIzinExcel(rec.payload.data);
      }
      showToast("File Excel resmi Adidata berhasil diunduh!", "success");
    } catch (e: unknown) {
      console.error(e);
      showToast("Gagal mengunduh file Excel", "warning");
    } finally {
      setIsExportingId(null);
    }
  };

  const handleDownloadPDF = (rec: HistoryRecord) => {
    if (rec.payload.kind === "timesheet") {
      exportTimesheetPDF({ header: rec.payload.header, rows: rec.payload.rows });
    } else if (rec.payload.kind === "spl") {
      exportSPLPDF(rec.payload.data);
    } else if (rec.payload.kind === "izin") {
      exportIzinPDF(rec.payload.data);
    }
  };

  const handleDelete = (rec: HistoryRecord) => {
    deleteHistoryRecord(rec.id);
    deleteTimesheetFromHistory(rec.id);
    setLegacyRecords((prev) => prev.filter((r) => r.id !== rec.id));
    showToast("Dokumen dihapus dari riwayat", "info");
  };

  const handleClearAll = () => {
    if (combinedList.length === 0) return;
    if (confirm("Yakin ingin mengosongkan seluruh riwayat dokumen di browser ini?")) {
      clearHistory();
      localStorage.removeItem("timesheet_history_records_v1");
      setLegacyRecords([]);
      showToast("Seluruh riwayat berhasil dibersihkan", "info");
    }
  };

  const handleExportBackup = () => {
    const json = exportBackupJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `adidata-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Backup data JSON berhasil diunduh!", "success");
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importBackupJson(String(reader.result || ""));
      if (ok) {
        showToast("Backup JSON berhasil diimpor!", "success");
      } else {
        showToast("Format file JSON tidak valid", "warning");
      }
    };
    reader.readAsText(file);
  };

  const kindBadge = (kind: HistoryRecord["kind"]) => {
    if (kind === "timesheet") {
      return { label: "Timesheet", bg: "var(--accent-dim)", color: "var(--accent)" };
    }
    if (kind === "spl") {
      return { label: "SPL Lembur", bg: "var(--amber-dim)", color: "var(--amber-text)" };
    }
    return { label: "Surat Izin", bg: "var(--green-dim)", color: "var(--green-text)" };
  };

  return (
    <>
      <Navbar />

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
            padding: "10px 16px",
            borderRadius: "var(--radius-sm)",
            background: "var(--bg-card)",
            color: "var(--text-hi)",
            boxShadow: "var(--shadow-elevated)",
            border: `1px solid ${
              toastMsg.type === "success"
                ? "var(--green)"
                : toastMsg.type === "warning"
                  ? "var(--amber)"
                  : "var(--accent)"
            }`,
            fontWeight: 500,
            fontSize: "0.85rem",
            maxWidth: "460px",
          }}
        >
          <span
            style={{
              color:
                toastMsg.type === "success"
                  ? "var(--green)"
                  : toastMsg.type === "warning"
                    ? "var(--amber)"
                    : "var(--accent)",
            }}
          >
            {toastMsg.type === "success" ? <CheckCircleIcon size={16} /> : <AlertCircleIcon size={16} />}
          </span>
          <span style={{ flex: 1 }}>{toastMsg.text}</span>
          <button
            onClick={() => setToastMsg(null)}
            style={{ background: "none", border: "none", color: "var(--text-lo)", cursor: "pointer", padding: "2px 4px" }}
            aria-label="Tutup notifikasi"
          >
            ✕
          </button>
        </div>
      )}

      <div className="page-header">
        <h1 className="page-title">Riwayat Dokumen &amp; Backup JSON</h1>
        <p className="page-subtitle">
          Daftar dokumen Timesheet, SPL, dan Surat Permohonan Izin yang tersimpan di IndexedDB browser. Buka kembali, duplikat untuk periode berikutnya, atau cadangkan ke file JSON.
        </p>
      </div>

      <div className="main-content">
        {/* Toolbar */}
        <div
          className="card"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1.25rem",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div className="filter-pills">
            {[
              { k: "all", l: `Semua (${combinedList.length})` },
              { k: "timesheet", l: "Timesheet" },
              { k: "spl", l: "SPL Lembur" },
              { k: "izin", l: "Surat Izin" },
            ].map((tab) => (
              <button
                key={tab.k}
                type="button"
                className={`filter-pill ${filterKind === tab.k ? "active" : ""}`}
                onClick={() => setFilterKind(tab.k as typeof filterKind)}
              >
                {tab.l}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              onChange={handleImportBackup}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Impor JSON
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportBackup}>
              <DownloadIcon size={13} />
              <span>Ekspor Backup JSON</span>
            </button>
            {combinedList.length > 0 && (
              <button type="button" className="btn btn-danger btn-sm" onClick={handleClearAll}>
                <TrashIcon size={13} />
                <span>Hapus Semua</span>
              </button>
            )}
          </div>
        </div>

        {filteredList.length === 0 ? (
          <div
            className="card"
            style={{
              textAlign: "center",
              padding: "3.5rem 1.5rem",
              background: "var(--bg-card-subtle)",
            }}
          >
            <div style={{ color: "var(--text-lo)", marginBottom: "0.75rem", display: "flex", justifyContent: "center" }}>
              <ArchiveIcon size={34} />
            </div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-hi)", marginBottom: "0.4rem" }}>
              Belum Ada Dokumen Tersimpan
            </h3>
            <p style={{ color: "var(--text-mid)", fontSize: "0.85rem", maxWidth: "480px", margin: "0 auto 1.5rem" }}>
              Setiap kali Anda mengunduh Excel/PDF dari halaman Timesheet, SPL, atau Surat Izin, salinan arsip akan otomatis tersimpan di sini.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
              <button type="button" className="btn btn-primary" onClick={() => router.push("/timesheet")}>
                <PlusIcon size={14} />
                <span>Buat Timesheet</span>
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => router.push("/spl")}>
                <span>Buat SPL Lembur</span>
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => router.push("/izin")}>
                <span>Buat Surat Izin</span>
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" }}>
            {filteredList.map((rec) => {
              const badge = kindBadge(rec.kind);
              const formattedDate = new Date(rec.savedAt).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={rec.id}
                  className="card"
                  style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "1rem" }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "0.6rem" }}>
                      <div>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: "9999px",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            background: badge.bg,
                            color: badge.color,
                            marginBottom: "6px",
                          }}
                        >
                          {badge.label}
                        </span>
                        <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-hi)" }}>
                          {rec.title}
                        </div>
                        <div style={{ fontSize: "0.76rem", color: "var(--text-lo)", marginTop: "2px" }}>
                          Disimpan: {formattedDate}
                        </div>
                      </div>
                      <span
                        style={{
                          background: "var(--btn-secondary-bg)",
                          border: "1px solid var(--border)",
                          color: "var(--text-mid)",
                          padding: "2px 7px",
                          borderRadius: "var(--radius-xs)",
                          fontSize: "0.74rem",
                          fontWeight: 600,
                          fontFamily: "var(--font-mono, monospace)",
                        }}
                      >
                        NPP {rec.employeeId}
                      </span>
                    </div>

                    <div style={{ fontSize: "0.82rem", color: "var(--text-mid)", marginBottom: "0.75rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <UserIcon size={13} />
                        <strong>{rec.employeeName}</strong>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                        <CalendarIcon size={13} />
                        <span>Periode: {rec.periode}</span>
                      </div>
                    </div>

                    <div
                      style={{
                        background: "var(--bg-card-subtle)",
                        border: "1px solid var(--border)",
                        padding: "8px 10px",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "0.78rem",
                        color: "var(--text-mid)",
                      }}
                    >
                      {rec.summaryText}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingTop: "0.75rem",
                      borderTop: "1px solid var(--border)",
                      gap: "6px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", gap: "4px" }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDelete(rec)}
                        style={{ color: "var(--red)", padding: "4px 8px" }}
                        title="Hapus dari riwayat"
                      >
                        <TrashIcon size={12} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDuplicate(rec)}
                        style={{ padding: "4px 8px" }}
                        title="Duplikat dokumen"
                      >
                        <CopyIcon size={12} />
                        <span>Duplikat</span>
                      </button>
                    </div>

                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDownloadPDF(rec)}
                      >
                        <FileTextIcon size={12} />
                        <span>PDF</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDownloadExcel(rec)}
                        disabled={isExportingId === rec.id}
                      >
                        <DownloadIcon size={12} />
                        <span>{isExportingId === rec.id ? "..." : "Excel"}</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleOpenInEditor(rec)}
                      >
                        <EditIcon size={12} />
                        <span>Buka</span>
                      </button>
                    </div>
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


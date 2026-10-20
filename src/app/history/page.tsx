"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import type { SavedTimesheetRecord } from "@/lib/types";
import {
  loadTimesheetHistory,
  deleteTimesheetFromHistory,
  saveTimesheetDraft,
  MONTH_NAMES_TITLE,
} from "@/lib/types";
import { exportTimesheetExcel } from "@/lib/excel-export";
import {
  ArchiveIcon,
  CalendarIcon,
  UserIcon,
  BriefcaseIcon,
  DownloadIcon,
  EditIcon,
  TrashIcon,
  AlertCircleIcon,
  CheckCircleIcon,
} from "@/components/Icons";

export default function HistoryPage() {
  const router = useRouter();
  const [records, setRecords] = useState<SavedTimesheetRecord[]>([]);

  useEffect(() => {
    setRecords(loadTimesheetHistory());
  }, []);
  const [isExportingId, setIsExportingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "info" | "warning" } | null>(null);

  const showToast = (text: string, type: "success" | "info" | "warning" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleOpenInEditor = (record: SavedTimesheetRecord) => {
    saveTimesheetDraft(record.header, record.rows);
    showToast(`Timesheet periode ${record.header.periode} dimuat ke Editor!`, "success");
    setTimeout(() => {
      router.push("/");
    }, 400);
  };

  const handleDirectDownload = async (record: SavedTimesheetRecord) => {
    setIsExportingId(record.id);
    try {
      await exportTimesheetExcel({ header: record.header, rows: record.rows });
      showToast("File Excel resmi Adidata berhasil didownload!", "success");
    } catch (err: unknown) {
      console.error(err);
      showToast("Gagal mendownload file Excel", "warning");
    } finally {
      setIsExportingId(null);
    }
  };

  const handleDelete = (id: string, periode: string) => {
    if (confirm(`Yakin ingin menghapus arsip Timesheet ${periode}?`)) {
      deleteTimesheetFromHistory(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      showToast("Arsip berhasil dihapus", "info");
    }
  };

  const handleClearAll = () => {
    if (records.length === 0) return;
    if (confirm("Yakin ingin mengosongkan seluruh riwayat arsip di browser ini?")) {
      localStorage.removeItem("timesheet_history_records_v1");
      setRecords([]);
      showToast("Seluruh riwayat berhasil dibersihkan", "info");
    }
  };

  return (
    <>
      <Navbar />

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
          className="animate-fade-in"
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

      <div className="page-header animate-fade-in">
        <h1 className="page-title">
          Riwayat &amp; Arsip Timesheet
        </h1>
        <p className="page-subtitle">
          Daftar timesheet yang tersimpan di penyimpanan lokal browser. Anda dapat memuat kembali ke editor atau mendownload ulang Excel kapan saja.
        </p>
      </div>

      <div className="main-content">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1.25rem",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-hi)" }}>
            Tersimpan: {records.length} Dokumen
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => router.push("/")}
            >
              + Buka Editor Timesheet
            </button>
            {records.length > 0 && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleClearAll}
              >
                <TrashIcon size={13} />
                <span>Hapus Semua Riwayat</span>
              </button>
            )}
          </div>
        </div>

        {records.length === 0 ? (
          <div
            className="card"
            style={{
              textAlign: "center",
              padding: "3.5rem 1.5rem",
              background: "var(--bg-card-subtle)",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ color: "var(--text-lo)", marginBottom: "0.75rem", display: "flex", justifyContent: "center" }}>
              <ArchiveIcon size={34} />
            </div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-hi)", marginBottom: "0.4rem" }}>
              Belum Ada Riwayat Tersimpan
            </h3>
            <p style={{ color: "var(--text-mid)", fontSize: "0.85rem", maxWidth: "480px", margin: "0 auto 1.5rem" }}>
              Saat Anda mengunduh Timesheet Excel atau menekan tombol <strong>Simpan ke Riwayat</strong> di Editor, dokumen akan otomatis tersimpan di sini.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => router.push("/")}
            >
              Mulai Buat Timesheet Sekarang →
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" }}>
            {records.map((rec) => {
              const monthName = MONTH_NAMES_TITLE[rec.header.month - 1] || "";
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
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "1rem",
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        marginBottom: "0.75rem",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "1.05rem",
                            fontWeight: 700,
                            color: "var(--text-hi)",
                            display: "flex",
                            alignItems: "center",
                            gap: "7px",
                          }}
                        >
                          <CalendarIcon size={16} />
                          <span>
                            {monthName} {rec.header.year}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-lo)", marginTop: "2px" }}>
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
                        NPP {rec.header.npp || "-"}
                      </span>
                    </div>

                    <div style={{ fontSize: "0.82rem", color: "var(--text-mid)", marginBottom: "1rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <UserIcon size={13} />
                        <strong>{rec.header.name}</strong> • {rec.header.department}
                      </div>
                      <div style={{ marginTop: "4px", display: "flex", alignItems: "center", gap: "5px" }}>
                        <BriefcaseIcon size={13} />
                        <span>{rec.header.projectName} ({rec.header.projectId})</span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: "6px",
                        background: "var(--bg-card-subtle)",
                        padding: "8px",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border)",
                        textAlign: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-lo)", fontWeight: 600 }}>TOTAL JAM</div>
                        <div
                          style={{
                            fontWeight: 700,
                            color: "var(--accent)",
                            fontFamily: "var(--font-mono, monospace)",
                            fontSize: "0.95rem",
                          }}
                        >
                          {rec.totalHours.toFixed(1)}h
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-lo)", fontWeight: 600 }}>HARI MASUK</div>
                        <div style={{ fontWeight: 700, color: "var(--green)", fontSize: "0.95rem" }}>
                          {rec.presentDays}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-lo)", fontWeight: 600 }}>LEMBUR</div>
                        <div style={{ fontWeight: 700, color: rec.overtimeDays > 0 ? "var(--amber-text)" : "var(--text-lo)", fontSize: "0.95rem" }}>
                          {rec.overtimeDays}
                        </div>
                      </div>
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
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleDelete(rec.id, `${monthName} ${rec.header.year}`)}
                      style={{ color: "var(--red)", padding: "4px 8px" }}
                    >
                      <TrashIcon size={12} />
                      <span>Hapus</span>
                    </button>

                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDirectDownload(rec)}
                        disabled={isExportingId === rec.id}
                      >
                        <DownloadIcon size={12} />
                        <span>{isExportingId === rec.id ? "Memproses..." : "Excel"}</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleOpenInEditor(rec)}
                      >
                        <EditIcon size={12} />
                        <span>Buka di Editor</span>
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

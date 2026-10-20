"use client";

import { useState } from "react";
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

export default function HistoryPage() {
  const router = useRouter();
  const [records, setRecords] = useState<SavedTimesheetRecord[]>(() => {
    if (typeof window !== "undefined") {
      return loadTimesheetHistory();
    }
    return [];
  });
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

      <div className="page-header animate-fade-in">
        <div className="page-badge">
          <span>🗂️</span>
          <span>Penyimpanan Lokal Browser</span>
        </div>
        <h1 className="page-title">
          Riwayat & <span className="page-title-gradient">Arsip Timesheet</span>
        </h1>
        <p className="page-subtitle">
          Daftar timesheet yang telah disimpan atau diexport sebelumnya. Anda dapat memuat kembali ke editor atau mendownload ulang Excel kapan saja.
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
          <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)" }}>
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
                Hapus Semua Riwayat
              </button>
            )}
          </div>
        </div>

        {records.length === 0 ? (
          <div
            className="card"
            style={{
              textAlign: "center",
              padding: "4rem 1.5rem",
              border: "1px dashed var(--border-color)",
            }}
          >
            <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>📭</div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
              Belum Ada Riwayat Tersimpan
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", maxWidth: "480px", margin: "0 auto 1.5rem" }}>
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
                            fontSize: "1.1rem",
                            fontWeight: 800,
                            color: "var(--text-primary)",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <span>📅</span>
                          <span>
                            {monthName} {rec.header.year}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.825rem", color: "var(--text-muted)", marginTop: "2px" }}>
                          Disimpan: {formattedDate}
                        </div>
                      </div>
                      <span
                        style={{
                          background: "rgba(99, 102, 241, 0.15)",
                          color: "var(--accent-indigo)",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                        }}
                      >
                        {rec.header.npp || "-"}
                      </span>
                    </div>

                    <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                      <div>
                        👤 <strong>{rec.header.name}</strong> • {rec.header.department}
                      </div>
                      <div style={{ marginTop: "4px" }}>
                        💼 {rec.header.projectName} ({rec.header.projectId})
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: "6px",
                        background: "rgba(255, 255, 255, 0.02)",
                        padding: "8px",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-color)",
                        textAlign: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>TOTAL JAM</div>
                        <div
                          style={{
                            fontWeight: 800,
                            color: "var(--accent-cyan)",
                            fontFamily: "JetBrains Mono, monospace",
                          }}
                        >
                          {rec.totalHours.toFixed(1)}h
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>HARI MASUK</div>
                        <div style={{ fontWeight: 800, color: "var(--accent-emerald)" }}>
                          {rec.presentDays}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>LEMBUR</div>
                        <div style={{ fontWeight: 800, color: rec.overtimeDays > 0 ? "var(--accent-amber)" : "var(--text-muted)" }}>
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
                      borderTop: "1px solid var(--border-color)",
                      gap: "6px",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleDelete(rec.id, `${monthName} ${rec.header.year}`)}
                      style={{ color: "var(--accent-rose)", padding: "4px 8px" }}
                    >
                      Hapus
                    </button>

                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDirectDownload(rec)}
                        disabled={isExportingId === rec.id}
                      >
                        {isExportingId === rec.id ? "⏳..." : "⬇️ Excel"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleOpenInEditor(rec)}
                      >
                        📂 Buka Editor
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

"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import type { SPLData, SPLEntry } from "@/lib/types";
import { calcHours, loadTimesheetDraft, isOvertimeRow, formatTimeWithSeconds } from "@/lib/types";
import { exportSPLExcel } from "@/lib/excel-export";
import { getSampleSPLData } from "@/lib/sample-data";
import {
  FileTextIcon,
  SparklesIcon,
  RefreshIcon,
  UserIcon,
  EditIcon,
  PlusIcon,
  TrashIcon,
  DownloadIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  ClockIcon,
} from "@/components/Icons";

export default function SPLPage() {
  const [data, setData] = useState<SPLData>(getSampleSPLData());

  useEffect(() => {
    const draft = loadTimesheetDraft();
    if (draft && draft.header) {
      const h = draft.header;
      const overtimeRows = draft.rows.filter(isOvertimeRow);

      const entries: SPLEntry[] =
        overtimeRows.length > 0
          ? overtimeRows.map((r, idx) => {
              const splStart = r.overtimeStartTime
                ? (r.overtimeStartTime.length === 5 ? `${r.overtimeStartTime}:00` : r.overtimeStartTime)
                : (r.isWeekend ? (r.startTime ? `${r.startTime}:00` : "09:00:00") : "17:00:00");
              const splEnd = r.overtimeEndTime
                ? (r.overtimeEndTime.length === 5 ? `${r.overtimeEndTime}:00` : r.overtimeEndTime)
                : (r.endTime ? `${r.endTime}:00` : "20:00:00");
              const diffH = calcHours(splStart, splEnd);

              return {
                no: idx + 1,
                date: r.date,
                startTime: splStart,
                endTime: splEnd,
                totalHours: diffH > 0 ? diffH : (r.totalHours || 8),
                tasks: r.activity || "1. Support SIT & Testing\n2. Perbaikan Defect",
              };
            })
          : [
              {
                no: 1,
                date: new Date().toISOString().split("T")[0],
                startTime: "09:00:00",
                endTime: "18:00:00",
                totalHours: 8,
                tasks: "1. Support SIT\n2. Perbaikan Defect",
              },
            ];

      setData({
        npp: h.npp || "901513",
        name: h.name || "Mohamad Burhanudin",
        department: h.department || "EDV / ADV",
        position: h.employeeTitle || "Developer",
        teamLeaderName: h.managerName || "Gita Kartika",
        teamLeaderTitle: h.managerTitle || "Pgs. Team Leader",
        deptHeadName: h.deptHeadName || "Adhy Perdhana",
        deptHeadTitle: h.deptHeadTitle || "Department Head",
        entries,
      });
    }
  }, []);
  const [isExporting, setIsExporting] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "warning" | "info" } | null>(null);

  const showToast = (text: string, type: "success" | "warning" | "info" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const updateEntry = (index: number, field: keyof SPLEntry, value: string | number) => {
    setData((prev) => {
      const nextEntries = [...prev.entries];
      const current = { ...nextEntries[index], [field]: value };
      
      if (field === "startTime" || field === "endTime") {
        const s = field === "startTime" ? String(value) : current.startTime;
        const e = field === "endTime" ? String(value) : current.endTime;
        const d = new Date(current.date);
        current.totalHours = calcHours(s, e, d.getDay());
      }
      
      nextEntries[index] = current;
      return { ...prev, entries: nextEntries };
    });
  };

  const addEntry = () => {
    setData((prev) => {
      const nextNo = prev.entries.length + 1;
      return {
        ...prev,
        entries: [
          ...prev.entries,
          {
            no: nextNo,
            date: new Date().toISOString().split("T")[0],
            startTime: "09:00:00",
            endTime: "18:00:00",
            totalHours: 8,
            tasks: "",
          },
        ],
      };
    });
    showToast("Baris penugasan lembur baru berhasil ditambahkan", "info");
  };

  const removeEntry = (index: number) => {
    if (data.entries.length <= 1) return;
    setData((prev) => ({
      ...prev,
      entries: prev.entries.filter((_, i) => i !== index).map((e, idx) => ({ ...e, no: idx + 1 })),
    }));
    showToast("Baris penugasan lembur dihapus", "info");
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportSPLExcel(data);
      showToast("Surat Perintah Lembur (SPL) Excel resmi Adidata berhasil didownload!", "success");
    } catch (e: unknown) {
      console.error(e);
      showToast(`Gagal export SPL: ${e instanceof Error ? e.message : "Coba lagi"}`, "warning");
    } finally {
      setIsExporting(false);
    }
  };

  const handleLoadSample = () => {
    setData(getSampleSPLData());
    showToast("Data contoh SPL resmi tanggal 12 September 2026 berhasil dimuat!", "success");
  };

  const handleSyncFromTimesheet = () => {
    const draft = loadTimesheetDraft();
    if (!draft || !draft.header) {
      showToast("Belum ada draft Timesheet di browser. Buat Timesheet terlebih dahulu.", "warning");
      return;
    }
    const h = draft.header;
    const overtimeRows = draft.rows.filter(isOvertimeRow);

    const entries: SPLEntry[] =
      overtimeRows.length > 0
        ? overtimeRows.map((r, idx) => {
            const splStart = r.overtimeStartTime
              ? (r.overtimeStartTime.length === 5 ? `${r.overtimeStartTime}:00` : r.overtimeStartTime)
              : (r.isWeekend ? (r.startTime ? `${r.startTime}:00` : "09:00:00") : "17:00:00");
            const splEnd = r.overtimeEndTime
              ? (r.overtimeEndTime.length === 5 ? `${r.overtimeEndTime}:00` : r.overtimeEndTime)
              : (r.endTime ? `${r.endTime}:00` : "20:00:00");
            const diffH = calcHours(splStart.slice(0, 5), splEnd.slice(0, 5));

            return {
              no: idx + 1,
              date: r.date,
              startTime: splStart,
              endTime: splEnd,
              totalHours: diffH > 0 ? diffH : (r.totalHours || 8),
              tasks: r.activity || "1. Support SIT\n2. Perbaikan Defect",
            };
          })
        : [
            {
              no: 1,
              date: new Date().toISOString().split("T")[0],
              startTime: "09:00:00",
              endTime: "18:00:00",
              totalHours: 8,
              tasks: "1. Support SIT\n2. Perbaikan Defect",
            },
          ];

    setData({
      npp: h.npp || "",
      name: h.name || "",
      department: h.department || "",
      position: h.employeeTitle || "Developer",
      teamLeaderName: h.managerName || "",
      teamLeaderTitle: h.managerTitle || "Pgs. Team Leader",
      deptHeadName: h.deptHeadName || "",
      deptHeadTitle: h.deptHeadTitle || "Department Head",
      entries,
    });
    showToast(`Data berhasil disinkronkan dari Timesheet! Ditemukan ${overtimeRows.length} hari lembur.`, "success");
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
          Surat Perintah Lembur (SPL) Adidata
        </h1>
        <p className="page-subtitle">
          Formulir lembur resmi Adidata dengan format penomoran, rincian pekerjaan, durasi jam kerja lembur, dan verifikasi tanda tangan atasan.
        </p>
      </div>

      <div className="main-content">
        {/* Quick Sync & Load Bar */}
        <div
          className="card"
          style={{
            marginBottom: "1.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, color: "var(--text-hi)", fontSize: "0.95rem" }}>
              Sinkronisasi Data Lembur
            </div>
            <div style={{ fontSize: "0.82rem", color: "var(--text-mid)", marginTop: "2px" }}>
              Tarik otomatis data pegawai dan hari lembur langsung dari Timesheet tanpa input ulang.
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleSyncFromTimesheet}
            >
              <RefreshIcon size={13} />
              <span>Tarik dari Timesheet</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleLoadSample}
            >
              <SparklesIcon size={13} />
              <span>Muat Contoh Data</span>
            </button>
          </div>
        </div>

        {/* Pegawai Card */}
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <div className="card-header">
            <div className="card-title">
              <div className="card-icon">
                <UserIcon size={15} />
              </div>
              <span>Data Pegawai yang Ditugaskan</span>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">
                NPP Pegawai <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={data.npp}
                onChange={(e) => setData({ ...data, npp: e.target.value })}
                placeholder="901513"
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Nama Lengkap Pegawai <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={data.name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                placeholder="Mohamad Burhanudin"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Departemen / Divisi</label>
              <input
                type="text"
                className="form-input"
                value={data.department}
                onChange={(e) => setData({ ...data, department: e.target.value })}
                placeholder="EDV / ADV"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Jabatan / Posisi</label>
              <input
                type="text"
                className="form-input"
                value={data.position}
                onChange={(e) => setData({ ...data, position: e.target.value })}
                placeholder="Developer"
              />
            </div>
          </div>
        </div>

        {/* Entries Card */}
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <div className="card-header">
            <div>
              <div className="card-title">
                <div className="card-icon">
                  <FileTextIcon size={15} />
                </div>
                <span>Daftar Hari &amp; Tugas Lembur ({data.entries.length} Hari)</span>
              </div>
              <div className="card-subtitle">
                Isi tanggal lembur, rentang waktu, dan rincian pekerjaan yang dilakukan
              </div>
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={addEntry}>
              <PlusIcon size={13} />
              <span>Tambah Hari Lembur</span>
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {data.entries.map((entry, idx) => (
              <div
                key={idx}
                style={{
                  background: "var(--bg-card-subtle)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "1.2rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "1rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        background: "var(--accent-dim)",
                        border: "1px solid var(--accent-dim-border)",
                        color: "var(--accent)",
                        fontWeight: 700,
                        fontSize: "0.76rem",
                        padding: "2px 8px",
                        borderRadius: "var(--radius-xs)",
                      }}
                    >
                      Penugasan #{entry.no}
                    </span>
                    {entry.totalHours ? (
                      <span
                        style={{
                          fontFamily: "var(--font-mono, monospace)",
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          color: "var(--amber-text)",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <ClockIcon size={13} />
                        <span>{entry.totalHours} Jam Lembur</span>
                      </span>
                    ) : null}
                  </div>

                  {data.entries.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => removeEntry(idx)}
                      style={{ color: "var(--red)" }}
                    >
                      <TrashIcon size={13} />
                      <span>Hapus</span>
                    </button>
                  )}
                </div>

                <div className="form-grid" style={{ marginBottom: "1rem" }}>
                  <div className="form-group">
                    <label className="form-label">Tanggal Lembur</label>
                    <input
                      type="date"
                      className="form-input"
                      value={entry.date}
                      onChange={(e) => updateEntry(idx, "date", e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Jam Mulai</label>
                    <input
                      type="time"
                      step="1"
                      className="form-input"
                      value={formatTimeWithSeconds(entry.startTime || "09:00:00")}
                      onChange={(e) => updateEntry(idx, "startTime", e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Jam Selesai</label>
                    <input
                      type="time"
                      step="1"
                      className="form-input"
                      value={formatTimeWithSeconds(entry.endTime || "18:00:00")}
                      onChange={(e) => updateEntry(idx, "endTime", e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label className="form-label">
                      Rincian Pekerjaan yang Dilakukan
                      <span className="hint">Mendukung multi-baris / nomor poin</span>
                    </label>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: "0.72rem", padding: "2px 6px" }}
                      onClick={() =>
                        updateEntry(
                          idx,
                          "tasks",
                          "1. Support SIT & Testing Defect\n2. Perbaikan Defect CR60137 - [KRI] Input & Penugasan\n3. Verifikasi Hasil Patching Database"
                        )
                      }
                    >
                      Gunakan Template Contoh
                    </button>
                  </div>
                  <textarea
                    className="form-textarea"
                    rows={4}
                    value={entry.tasks}
                    onChange={(e) => updateEntry(idx, "tasks", e.target.value)}
                    placeholder="Contoh:&#10;1. Support SIT & Verifikasi Bug&#10;2. Perbaikan Defect CR60137 - [KRI] Pencatatan Input & Penugasan&#10;3. Tuning Performance Query ORMS"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Otorisasi Card */}
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <div className="card-header">
            <div className="card-title">
              <div className="card-icon">
                <EditIcon size={15} />
              </div>
              <span>Pejabat Otorisasi &amp; Tanda Tangan SPL</span>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Pemeriksa / Team Leader</label>
              <input
                type="text"
                className="form-input"
                value={data.teamLeaderName}
                onChange={(e) => setData({ ...data, teamLeaderName: e.target.value })}
                placeholder="Gita Kartika"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Jabatan Team Leader</label>
              <input
                type="text"
                className="form-input"
                value={data.teamLeaderTitle}
                onChange={(e) => setData({ ...data, teamLeaderTitle: e.target.value })}
                placeholder="Pgs. Team Leader"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Menyetujui / Dept Head</label>
              <input
                type="text"
                className="form-input"
                value={data.deptHeadName}
                onChange={(e) => setData({ ...data, deptHeadName: e.target.value })}
                placeholder="Adhy Perdhana"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Jabatan Dept Head</label>
              <input
                type="text"
                className="form-input"
                value={data.deptHeadTitle}
                onChange={(e) => setData({ ...data, deptHeadTitle: e.target.value })}
                placeholder="Department Head"
              />
            </div>
          </div>
        </div>

        {/* Export Card */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <div style={{ fontWeight: 700, color: "var(--text-hi)", fontSize: "1rem" }}>
                Generate Dokumen SPL Excel (.xlsx)
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-mid)", marginTop: "2px" }}>
                Format resmi Adidata lengkap dengan logo, rincian jam lembur, dan kolom tanda tangan.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-success btn-lg"
              onClick={handleExport}
              disabled={isExporting || !data.name || !data.npp}
            >
              <DownloadIcon size={16} />
              <span>{isExporting ? "Memproses Dokumen..." : "Download SPL Excel (.xlsx)"}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

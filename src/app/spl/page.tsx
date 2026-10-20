"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import type { SPLData, SPLEntry } from "@/lib/types";
import { calcHours, loadTimesheetDraft } from "@/lib/types";
import { exportSPLExcel } from "@/lib/excel-export";
import { getSampleSPLData } from "@/lib/sample-data";

export default function SPLPage() {
  const [data, setData] = useState<SPLData>(() => {
    if (typeof window !== "undefined") {
      const draft = loadTimesheetDraft();
      if (draft && draft.header) {
        const h = draft.header;
        const overtimeRows = draft.rows.filter(
          (r) => (r.isWeekend && r.status === "P" && r.totalHours > 0) || r.totalHours > 8.5
        );

        const entries: SPLEntry[] =
          overtimeRows.length > 0
            ? overtimeRows.map((r, idx) => ({
                no: idx + 1,
                date: r.date,
                startTime: r.startTime ? `${r.startTime}:00` : "09:00:00",
                endTime: r.endTime ? `${r.endTime}:00` : "18:00:00",
                totalHours: r.totalHours,
                tasks: r.activity || "1. Support SIT & Testing\n2. Perbaikan Defect",
              }))
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

        return {
          npp: h.npp || "901513",
          name: h.name || "Mohamad Burhanudin",
          department: h.department || "EDV / ADV",
          position: h.employeeTitle || "Developer",
          teamLeaderName: h.managerName || "Gita Kartika",
          teamLeaderTitle: h.managerTitle || "Pgs. Team Leader",
          deptHeadName: h.deptHeadName || "Adhy Perdhana",
          deptHeadTitle: h.deptHeadTitle || "Department Head",
          entries,
        };
      }
    }
    return getSampleSPLData();
  });
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
        current.totalHours = calcHours(s.slice(0, 5), e.slice(0, 5), d.getDay());
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
    const overtimeRows = draft.rows.filter(
      (r) => (r.isWeekend && r.status === "P" && r.totalHours > 0) || r.totalHours > 8.5
    );

    const entries: SPLEntry[] =
      overtimeRows.length > 0
        ? overtimeRows.map((r, idx) => ({
            no: idx + 1,
            date: r.date,
            startTime: r.startTime ? `${r.startTime}:00` : "09:00:00",
            endTime: r.endTime ? `${r.endTime}:00` : "18:00:00",
            totalHours: r.totalHours,
            tasks: r.activity || "1. Support SIT\n2. Perbaikan Defect",
          }))
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
          <span>🌙</span>
          <span>Surat Perintah Lembur Resmi</span>
        </div>
        <h1 className="page-title">
          Generator <span className="page-title-gradient">Surat Lembur (SPL)</span>
        </h1>
        <p className="page-subtitle">
          Format resmi Adidata lengkap dengan penomoran, rincian pekerjaan, durasi jam kerja lembur, dan verifikasi tanda tangan atasan.
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
            <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>
              Otomasi Data Surat Lembur
            </div>
            <div style={{ fontSize: "0.825rem", color: "var(--text-secondary)" }}>
              Sinkronkan pegawai dan hari kerja lembur langsung dari Timesheet tanpa ketik ulang.
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleSyncFromTimesheet}
            >
              🔄 Tarik Data dari Timesheet
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleLoadSample}
            >
              ⚡ Muat Contoh Template (Tgl 12)
            </button>
          </div>
        </div>

        {/* Pegawai Card */}
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <div className="card-header">
            <div className="card-title">
              <div className="card-icon">👤</div>
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
                <div className="card-icon">📝</div>
                <span>Daftar Hari & Tugas Lembur ({data.entries.length} Hari)</span>
              </div>
              <div className="card-subtitle">
                Isi tanggal lembur, rentang waktu, dan rincian pekerjaan yang dilakukan
              </div>
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={addEntry}>
              + Tambah Hari Lembur
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {data.entries.map((entry, idx) => (
              <div
                key={idx}
                style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-md)",
                  padding: "1.25rem",
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
                        background: "rgba(99, 102, 241, 0.2)",
                        color: "var(--accent-indigo)",
                        fontWeight: 700,
                        fontSize: "0.8rem",
                        padding: "2px 8px",
                        borderRadius: "6px",
                      }}
                    >
                      Penugasan #{entry.no}
                    </span>
                    {entry.totalHours ? (
                      <span
                        style={{
                          fontFamily: "JetBrains Mono, monospace",
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          color: "var(--accent-amber)",
                        }}
                      >
                        ⏱️ {entry.totalHours} Jam Lembur
                      </span>
                    ) : null}
                  </div>

                  {data.entries.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => removeEntry(idx)}
                      style={{ color: "var(--accent-rose)" }}
                    >
                      Hapus
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
                      className="form-input"
                      value={entry.startTime ? entry.startTime.slice(0, 5) : "09:00"}
                      onChange={(e) => updateEntry(idx, "startTime", `${e.target.value}:00`)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Jam Selesai</label>
                    <input
                      type="time"
                      className="form-input"
                      value={entry.endTime ? entry.endTime.slice(0, 5) : "18:00"}
                      onChange={(e) => updateEntry(idx, "endTime", `${e.target.value}:00`)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label className="form-label">
                      Rincian Pekerjaan yang Dilakukan
                      <span className="hint">Mendukung multi-baris / poin nomor</span>
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
              <div className="card-icon">✍️</div>
              <span>Pejabat Otorisasi & Tanda Tangan SPL</span>
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
              <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "1.05rem" }}>
                Generate File SPL Excel Resmi (.xlsx)
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                Template resmi Adidata dengan format penugasan, logo, dan tanda tangan lengkap.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-success btn-lg"
              onClick={handleExport}
              disabled={isExporting || !data.name || !data.npp}
            >
              {isExporting ? "⏳ Memproses Template..." : "⬇️ Download SPL Excel (.xlsx)"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

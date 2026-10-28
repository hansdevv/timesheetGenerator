"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import type { SPLData, SPLEntry } from "@/lib/types";
import { calcHours, loadTimesheetDraft, isOvertimeRow, formatTimeWithSeconds } from "@/lib/types";
import { formatDateId } from "@/lib/calc";
import { useAppStore } from "@/lib/storage";
import { exportSPLExcel } from "@/lib/excel-export";
import { exportSPLPDF } from "@/lib/pdf-export";
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
  const { profile, splDraft, setSPLDraft, addHistoryRecord } = useAppStore();
  const [data, setData] = useState<SPLData>(getSampleSPLData());
  const [isLoaded, setIsLoaded] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "warning" | "info" } | null>(null);

  useEffect(() => {
    if (splDraft && splDraft.entries?.length > 0) {
      setData(splDraft);
      setIsLoaded(true);
      return;
    }

    const draft = loadTimesheetDraft();
    if (draft && draft.header) {
      const h = draft.header;
      const overtimeRows = draft.rows.filter(isOvertimeRow);

      const entries: SPLEntry[] =
        overtimeRows.length > 0
          ? overtimeRows.map((r, idx) => {
              const splStart = r.overtimeStartTime
                ? formatTimeWithSeconds(r.overtimeStartTime)
                : r.isWeekend
                  ? formatTimeWithSeconds(r.startTime || "09:00:00")
                  : "17:00:00";
              const splEnd = r.overtimeEndTime
                ? formatTimeWithSeconds(r.overtimeEndTime)
                : formatTimeWithSeconds(r.endTime || "20:00:00");
              const diffH = calcHours(splStart, splEnd);

              return {
                no: idx + 1,
                date: r.date,
                startTime: splStart,
                endTime: splEnd,
                totalHours: diffH > 0 ? diffH : r.totalHours || 8,
                tasks: r.activity || "1. Support SIT & Testing\n2. Perbaikan Defect",
              };
            })
          : getSampleSPLData().entries;

      setData({
        npp: h.npp || profile.employeeId || "901513",
        name: h.name || profile.name || "Mohamad Burhanudin",
        department: h.department || profile.department || "EDV / ADV",
        position: h.employeeTitle || profile.position || "Developer",
        teamLeaderName: h.managerName || profile.supervisorName || "Gita Kartika",
        teamLeaderTitle: h.managerTitle || profile.supervisorPosition || "Pgs. Team Leader",
        deptHeadName: h.deptHeadName || profile.approverName || "Adhy Perdhana",
        deptHeadTitle: h.deptHeadTitle || profile.approverPosition || "Department Head",
        signatureDataUrl: h.signatureDataUrl || profile.signatureDataUrl,
        entries,
      });
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const t = setTimeout(() => {
      setSPLDraft(data);
    }, 500);
    return () => clearTimeout(t);
  }, [data, isLoaded, setSPLDraft]);

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
    showToast("Baris penugasan lembur baru ditambahkan", "info");
  };

  const removeEntry = (index: number) => {
    if (data.entries.length <= 1) return;
    setData((prev) => ({
      ...prev,
      entries: prev.entries.filter((_, i) => i !== index).map((e, idx) => ({ ...e, no: idx + 1 })),
    }));
    showToast("Baris penugasan lembur dihapus", "info");
  };

  const saveToHistory = (d: SPLData) => {
    const firstDate = d.entries?.[0]?.date || "";
    const periodeStr = firstDate ? formatDateId(firstDate) : "Lembur";
    addHistoryRecord({
      kind: "spl",
      title: `Surat Perintah Lembur (${d.entries.length} Hari)`,
      periode: periodeStr,
      employeeName: d.name,
      employeeId: d.npp,
      summaryText: `${d.entries.length} Baris Lembur • ${d.department}`,
      payload: { kind: "spl", data: d },
    });
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const payload: SPLData = {
        ...data,
        signatureDataUrl: data.signatureDataUrl || profile.signatureDataUrl,
      };
      await exportSPLExcel(payload);
      saveToHistory(payload);
      showToast("Surat Perintah Lembur (SPL) Excel resmi Adidata berhasil diunduh!", "success");
    } catch (e: unknown) {
      console.error(e);
      showToast(`Gagal export SPL: ${e instanceof Error ? e.message : "Coba lagi"}`, "warning");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = () => {
    try {
      const payload: SPLData = {
        ...data,
        signatureDataUrl: data.signatureDataUrl || profile.signatureDataUrl,
      };
      exportSPLPDF(payload);
      saveToHistory(payload);
      showToast("Pratinjau Surat Perintah Lembur (SPL) PDF resmi dibuka!", "info");
    } catch (e: unknown) {
      console.error(e);
      showToast("Gagal memproses cetak PDF SPL", "warning");
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
              ? formatTimeWithSeconds(r.overtimeStartTime)
              : r.isWeekend
                ? formatTimeWithSeconds(r.startTime || "09:00:00")
                : "17:00:00";
            const splEnd = r.overtimeEndTime
              ? formatTimeWithSeconds(r.overtimeEndTime)
              : formatTimeWithSeconds(r.endTime || "20:00:00");
            const diffH = calcHours(splStart, splEnd);

            return {
              no: idx + 1,
              date: r.date,
              startTime: splStart,
              endTime: splEnd,
              totalHours: diffH > 0 ? diffH : r.totalHours || 8,
              tasks: r.activity || "1. Support SIT\n2. Perbaikan Defect",
            };
          })
        : getSampleSPLData().entries;

    setData({
      npp: h.npp || profile.employeeId || "",
      name: h.name || profile.name || "",
      department: h.department || profile.department || "",
      position: h.employeeTitle || profile.position || "Developer",
      teamLeaderName: h.managerName || profile.supervisorName || "",
      teamLeaderTitle: h.managerTitle || profile.supervisorPosition || "Pgs. Team Leader",
      deptHeadName: h.deptHeadName || profile.approverName || "",
      deptHeadTitle: h.deptHeadTitle || profile.approverPosition || "Department Head",
      signatureDataUrl: h.signatureDataUrl || profile.signatureDataUrl,
      entries,
    });
    showToast(`Data berhasil disinkronkan dari Timesheet! Ditemukan ${overtimeRows.length} hari lembur.`, "success");
  };

  const baseAsset = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  return (
    <>
      <Navbar />

      {toastMsg && (
        <div
          className="app-toast"
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
            style={{ background: "none", border: "none", color: "var(--text-lo)", cursor: "pointer", padding: "2px 4px", fontSize: "14px" }}
            aria-label="Tutup notifikasi"
          >
            ✕
          </button>
        </div>
      )}

      <div className="page-header">
        <h1 className="page-title">Surat Perintah Lembur (SPL)</h1>
        <p className="page-subtitle">
          Formulir lembur resmi Adidata dengan format penomoran, rincian pekerjaan, durasi jam kerja lembur otomatis, dan blok tanda tangan otorisasi.
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
              Tarik otomatis data karyawan dan hari lembur langsung dari Timesheet tanpa input ulang.
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleSyncFromTimesheet}>
              <RefreshIcon size={13} />
              <span>Tarik dari Timesheet</span>
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleLoadSample}>
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
              <label className="form-label" htmlFor="spl-npp">
                NPP Pegawai <span className="required">*</span>
              </label>
              <input
                id="spl-npp"
                type="text"
                className="form-input"
                value={data.npp}
                onChange={(e) => setData({ ...data, npp: e.target.value })}
                placeholder="901513"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="spl-name">
                Nama Lengkap Pegawai <span className="required">*</span>
              </label>
              <input
                id="spl-name"
                type="text"
                className="form-input"
                value={data.name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                placeholder="Mohamad Burhanudin"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="spl-dept">Departemen / Divisi</label>
              <input
                id="spl-dept"
                type="text"
                className="form-input"
                value={data.department}
                onChange={(e) => setData({ ...data, department: e.target.value })}
                placeholder="EDV / ADV"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="spl-pos">Jabatan / Posisi</label>
              <input
                id="spl-pos"
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
                <span>Daftar Hari &amp; Tugas Lembur ({data.entries.length} Baris)</span>
              </div>
              <div className="card-subtitle">
                Isi tanggal lembur, rentang waktu, dan rincian pekerjaan yang dilakukan
              </div>
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={addEntry}>
              <PlusIcon size={13} />
              <span>Tambah Baris Lembur</span>
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
                          "1. Support SIT\n2. Perbaikan Defect CR60137 - [KRI] Pencatatan Input & Penugasan\n3. Perbaikan Defect CR60138 - [KRI] Monitoring & Tindak Lanjut"
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
                    placeholder="Contoh:&#10;1. Support SIT&#10;2. Perbaikan Defect CR60137 - [KRI] Pencatatan Input & Penugasan"
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
              <label className="form-label">Pemberi Perintah / Team Leader</label>
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
              <label className="form-label">Penyetuju / Dept Head</label>
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

        {/* Pratinjau Visual SPL */}
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <div className="card-header">
            <div className="card-title">
              <div className="card-icon">
                <FileTextIcon size={15} />
              </div>
              <span>Pratinjau Dokumen SPL</span>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? "Sembunyikan Pratinjau" : "Tampilkan Pratinjau"}
            </button>
          </div>

          {showPreview && (
            <div style={{ overflowX: "auto", padding: "8px 0" }}>
              <div className="mobile-scroll-hint" style={{ marginBottom: "8px" }}>
                <span>👈 Geser untuk melihat pratinjau dokumen penuh 👉</span>
              </div>
              <div
                style={{
                  minWidth: "660px",
                  maxWidth: "760px",
                  margin: "0 auto",
                  background: "#ffffff",
                  color: "#000000",
                  border: "1.5px solid #000000",
                  padding: "20px 24px",
                  fontFamily: "Calibri, Arial, sans-serif",
                  fontSize: "13px",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                }}
              >
                <div style={{ textAlign: "center", fontWeight: 700, fontSize: "17px", textDecoration: "underline", marginBottom: "18px" }}>
                  SURAT PERINTAH LEMBUR
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                  <div style={{ fontWeight: 700, lineHeight: 1.6 }}>
                    <div>NPP &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: {data.npp}</div>
                    <div>NAMA &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: {data.name}</div>
                    <div>DEPARTEMENT / DIVISI &nbsp;: {data.department}</div>
                    <div>POSISI &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: {data.position}</div>
                  </div>
                  <img
                    src={`${baseAsset}/images/adidata-logo.png`}
                    alt="ADIDATA"
                    style={{ width: "145px", height: "auto", objectFit: "contain" }}
                  />
                </div>

                <div style={{ textAlign: "center", fontWeight: 700, marginBottom: "8px" }}>
                  TUGAS YANG DIKERJAKAN
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "18px", fontSize: "12.5px" }}>
                  <thead>
                    <tr>
                      <th style={{ border: "1px solid #000", padding: "4px" }}>No</th>
                      <th style={{ border: "1px solid #000", padding: "4px" }}>Tanggal</th>
                      <th style={{ border: "1px solid #000", padding: "4px" }}>Mulai</th>
                      <th style={{ border: "1px solid #000", padding: "4px" }}>Akhir</th>
                      <th style={{ border: "1px solid #000", padding: "4px" }}>Total Jam</th>
                      <th style={{ border: "1px solid #000", padding: "4px" }}>Tugas yang di Kerjakan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.entries.map((e, i) => {
                      const dParts = e.date.split("-");
                      const dFmt = dParts.length === 3 ? `${dParts[2]}/${dParts[1]}/${dParts[0]}` : e.date;
                      return (
                        <tr key={i}>
                          <td style={{ border: "1px solid #000", padding: "6px", textAlign: "center" }}>{e.no || i + 1}</td>
                          <td style={{ border: "1px solid #000", padding: "6px", textAlign: "center" }}>{dFmt}</td>
                          <td style={{ border: "1px solid #000", padding: "6px", textAlign: "center" }}>{e.startTime}</td>
                          <td style={{ border: "1px solid #000", padding: "6px", textAlign: "center" }}>{e.endTime}</td>
                          <td style={{ border: "1px solid #000", padding: "6px", textAlign: "center", fontWeight: 700 }}>{e.totalHours ?? 8} jam</td>
                          <td style={{ border: "1px solid #000", padding: "6px", whiteSpace: "pre-wrap" }}>{e.tasks}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px", textAlign: "center", fontWeight: 700 }}>
                  <div>
                    <div style={{ border: "1px solid #000", height: "80px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "4px" }}>
                      <img
                        src={data.signatureDataUrl || profile.signatureDataUrl || `${baseAsset}/images/default-signature.png`}
                        alt="TTD"
                        style={{ maxHeight: "68px", maxWidth: "110px", objectFit: "contain" }}
                      />
                    </div>
                    <div>( {data.name} )</div>
                    <div>{data.position}</div>
                  </div>
                  <div>
                    <div style={{ border: "1px solid #000", height: "80px", marginBottom: "4px" }} />
                    <div>( {data.teamLeaderName} )</div>
                    <div>{data.teamLeaderTitle}</div>
                  </div>
                  <div>
                    <div style={{ border: "1px solid #000", height: "80px", marginBottom: "4px" }} />
                    <div>( {data.deptHeadName} )</div>
                    <div>{data.deptHeadTitle}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Export Card */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <div style={{ fontWeight: 700, color: "var(--text-hi)", fontSize: "1rem" }}>
                Unduh Surat Perintah Lembur (.xlsx &amp; PDF)
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-mid)", marginTop: "2px" }}>
                Nama file otomatis: <code>{`Surat Perintah Lembur_${data.entries[0]?.date ? formatDateId(data.entries[0].date) : "Lembur"}_${data.npp}_${data.name}.xlsx`}</code>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-secondary btn-lg"
                onClick={handleExportPDF}
                disabled={isExporting || !data.name || !data.npp}
              >
                <FileTextIcon size={16} />
                <span>Unduh / Cetak PDF</span>
              </button>
              <button
                type="button"
                className="btn btn-success btn-lg"
                onClick={handleExport}
                disabled={isExporting || !data.name || !data.npp}
              >
                <DownloadIcon size={16} />
                <span>{isExporting ? "Memproses..." : "Unduh Excel (.xlsx)"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

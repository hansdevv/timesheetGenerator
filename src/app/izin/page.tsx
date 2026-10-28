"use client";

import { useState, useEffect, useMemo } from "react";
import Navbar from "@/components/Navbar";
import type { IzinData, IzinType } from "@/lib/schemas";
import { IzinDataSchema } from "@/lib/schemas";
import { calcWorkingDays, formatDateId, formatIzinDateRange } from "@/lib/calc";
import { useAppStore } from "@/lib/storage";
import { exportIzinExcel } from "@/lib/excel-export";
import { exportIzinPDF } from "@/lib/pdf-export";
import { getSampleIzinData } from "@/lib/sample-data";
import {
  FileTextIcon,
  SparklesIcon,
  RefreshIcon,
  UserIcon,
  EditIcon,
  DownloadIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  CalendarIcon,
} from "@/components/Icons";

export default function IzinPage() {
  const { profile, holidays, izinDraft, setIzinDraft, addHistoryRecord } = useAppStore();
  const [data, setData] = useState<IzinData>(() => getSampleIzinData());
  const [isLoaded, setIsLoaded] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "warning" | "info" } | null>(null);

  const showToast = (text: string, type: "success" | "warning" | "info" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  useEffect(() => {
    if (izinDraft) {
      setData(izinDraft);
    } else if (profile?.name) {
      setData((prev) => ({
        ...prev,
        npp: profile.employeeId || prev.npp,
        name: profile.name || prev.name,
        department: profile.department || prev.department,
        position: profile.position || prev.position,
        city: profile.city || prev.city,
        supervisorName: profile.supervisorName || prev.supervisorName,
        supervisorTitle: profile.supervisorPosition || prev.supervisorTitle,
        approverName: profile.approverName || prev.approverName,
        approverTitle: profile.approverPosition || prev.approverTitle,
        signatureDataUrl: profile.signatureDataUrl || prev.signatureDataUrl,
      }));
    }
    setIsLoaded(true);
  }, []);

  // Auto-recalculate working days when startDate, endDate, or holidays change
  const calculatedWorkingDays = useMemo(() => {
    return calcWorkingDays(data.startDate, data.endDate, holidays);
  }, [data.startDate, data.endDate, holidays]);

  useEffect(() => {
    if (!isLoaded) return;
    const nextData = { ...data, workingDaysCount: Math.max(1, calculatedWorkingDays) };
    const timer = setTimeout(() => {
      setIzinDraft(nextData);
    }, 500);
    return () => clearTimeout(timer);
  }, [data, calculatedWorkingDays, isLoaded, setIzinDraft]);

  const handleSyncProfile = () => {
    setData((prev) => ({
      ...prev,
      npp: profile.employeeId || prev.npp,
      name: profile.name || prev.name,
      department: profile.department || prev.department,
      position: profile.position || prev.position,
      city: profile.city || prev.city,
      supervisorName: profile.supervisorName || prev.supervisorName,
      supervisorTitle: profile.supervisorPosition || prev.supervisorTitle,
      approverName: profile.approverName || prev.approverName,
      approverTitle: profile.approverPosition || prev.approverTitle,
      signatureDataUrl: profile.signatureDataUrl || prev.signatureDataUrl,
    }));
    showToast("Data pemohon dan atasan berhasil ditarik dari Profil!", "success");
  };

  const handleLoadSample = () => {
    const sample = getSampleIzinData();
    setData(sample);
    showToast("Data contoh Permohonan Izin resmi 06 November 2026 dimuat!", "success");
  };

  const handleTypeChange = (type: IzinType) => {
    let defaultTime = data.timeRange;
    if (type === "cuti") defaultTime = "-";
    else if (type === "pulang_awal" && defaultTime === "-") defaultTime = "14:00:00 - 17:00:00";
    else if (type === "datang_terlambat" && defaultTime === "-") defaultTime = "08:00:00 - 10:00:00";
    setData({ ...data, izinType: type, timeRange: defaultTime });
  };

  const saveToHistory = (d: IzinData) => {
    const periodeStr = formatDateId(d.startDate || d.submissionDate);
    addHistoryRecord({
      kind: "izin",
      title: `Permohonan Izin (${d.izinType === "cuti" ? "Cuti" : d.izinType === "pulang_awal" ? "Pulang Awal" : d.izinType === "datang_terlambat" ? "Datang Terlambat" : d.customIzinLabel || "Lainnya"})`,
      periode: periodeStr,
      employeeName: d.name,
      employeeId: d.npp,
      summaryText: `${calculatedWorkingDays || 1} Hari Kerja • ${d.reason}`,
      payload: { kind: "izin", data: d },
    });
  };

  const handleExportExcel = async () => {
    const payload = { ...data, workingDaysCount: Math.max(1, calculatedWorkingDays) };
    const parsed = IzinDataSchema.safeParse(payload);
    if (!parsed.success) {
      const firstErr = parsed.error.issues[0]?.message || "Periksa kembali isian form";
      showToast(firstErr, "warning");
      return;
    }

    setIsExporting(true);
    try {
      await exportIzinExcel(payload);
      saveToHistory(payload);
      showToast("File Permohonan Izin Excel (.xlsx) berhasil diunduh!", "success");
    } catch (e: unknown) {
      console.error(e);
      showToast(`Gagal ekspor Excel: ${e instanceof Error ? e.message : "Coba lagi"}`, "warning");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = () => {
    const payload = { ...data, workingDaysCount: Math.max(1, calculatedWorkingDays) };
    const parsed = IzinDataSchema.safeParse(payload);
    if (!parsed.success) {
      const firstErr = parsed.error.issues[0]?.message || "Periksa kembali isian form";
      showToast(firstErr, "warning");
      return;
    }

    try {
      exportIzinPDF(payload);
      saveToHistory(payload);
      showToast("Pratinjau PDF Permohonan Izin dibuka!", "info");
    } catch (e: unknown) {
      console.error(e);
      showToast("Gagal membuka cetak PDF Permohonan Izin", "warning");
    }
  };

  const { dayLabel, dateLabel } = formatIzinDateRange(data.startDate, data.endDate);
  const subDateFormatted = formatDateId(data.submissionDate);
  const baseAsset = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

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
        <h1 className="page-title">Surat Permohonan Izin &amp; Cuti</h1>
        <p className="page-subtitle">
          Formulir permohonan izin resmi Adidata (Cuti, Pulang Lebih Awal, Datang Terlambat, atau Izin Lainnya) dengan kalkulasi hari kerja otomatis.
        </p>
      </div>

      <div className="main-content">
        {/* Quick Sync Bar */}
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
              Sinkronisasi Profil &amp; Contoh Resmi
            </div>
            <div style={{ fontSize: "0.82rem", color: "var(--text-mid)", marginTop: "2px" }}>
              Gunakan data dari Profil tersimpan atau muat contoh dokumen resmi 06 November 2026.
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleSyncProfile}>
              <RefreshIcon size={13} />
              <span>Tarik dari Profil</span>
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleLoadSample}>
              <SparklesIcon size={13} />
              <span>Muat Contoh Data</span>
            </button>
          </div>
        </div>

        {/* Data Pemohon */}
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <div className="card-header">
            <div className="card-title">
              <div className="card-icon">
                <UserIcon size={15} />
              </div>
              <span>Identitas Pemohon &amp; Tempat Tanggal Surat</span>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="izin-name">
                Nama Lengkap <span className="required">*</span>
              </label>
              <input
                id="izin-name"
                type="text"
                className="form-input"
                value={data.name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                placeholder="Mohamad Burhanudin"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="izin-npp">
                NPP / ID Karyawan <span className="required">*</span>
              </label>
              <input
                id="izin-npp"
                type="text"
                className="form-input"
                value={data.npp}
                onChange={(e) => setData({ ...data, npp: e.target.value })}
                placeholder="901513"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="izin-dept">
                Bagian / Divisi <span className="required">*</span>
              </label>
              <input
                id="izin-dept"
                type="text"
                className="form-input"
                value={data.department}
                onChange={(e) => setData({ ...data, department: e.target.value })}
                placeholder="ADV / EDV"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="izin-city">
                Kota Penandatanganan <span className="required">*</span>
              </label>
              <input
                id="izin-city"
                type="text"
                className="form-input"
                value={data.city}
                onChange={(e) => setData({ ...data, city: e.target.value })}
                placeholder="Jakarta"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="izin-sub-date">
                Tanggal Pengajuan Surat <span className="required">*</span>
              </label>
              <input
                id="izin-sub-date"
                type="date"
                className="form-input"
                value={data.submissionDate}
                onChange={(e) => setData({ ...data, submissionDate: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Rincian Permohonan Izin */}
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <div className="card-header">
            <div className="card-title">
              <div className="card-icon">
                <CalendarIcon size={15} />
              </div>
              <span>Jenis &amp; Waktu Permohonan Izin</span>
            </div>
            <span
              style={{
                background: "var(--accent-dim)",
                border: "1px solid var(--accent-dim-border)",
                color: "var(--accent)",
                padding: "4px 10px",
                borderRadius: "9999px",
                fontSize: "0.78rem",
                fontWeight: 700,
              }}
            >
              Total Hari Kerja: {calculatedWorkingDays} Hari
            </span>
          </div>

          <div className="form-group" style={{ marginBottom: "1rem" }}>
            <label className="form-label">Pilih Jenis Permohonan Izin</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "8px", marginTop: "4px" }}>
              {[
                { val: "pulang_awal", label: "Pulang Lebih Awal" },
                { val: "datang_terlambat", label: "Datang Terlambat" },
                { val: "cuti", label: "Cuti" },
                { val: "lain_lain", label: "Lain - Lain" },
              ].map((opt) => {
                const active = data.izinType === opt.val;
                return (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => handleTypeChange(opt.val as IzinType)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px 12px",
                      borderRadius: "var(--radius-sm)",
                      border: `1.5px solid ${active ? "var(--accent)" : "var(--border-mid)"}`,
                      background: active ? "var(--accent-dim)" : "var(--bg-input)",
                      color: "var(--text-hi)",
                      fontWeight: active ? 700 : 500,
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: "0.86rem",
                    }}
                  >
                    <span
                      style={{
                        width: "20px",
                        height: "20px",
                        border: "1.5px solid currentColor",
                        borderRadius: "4px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                      }}
                    >
                      {active ? "√" : ""}
                    </span>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {data.izinType === "lain_lain" && (
            <div className="form-group" style={{ marginBottom: "1rem" }}>
              <label className="form-label" htmlFor="izin-custom-label">
                Keterangan Jenis Izin Lainnya (Opsional)
              </label>
              <input
                id="izin-custom-label"
                type="text"
                className="form-input"
                value={data.customIzinLabel || ""}
                onChange={(e) => setData({ ...data, customIzinLabel: e.target.value })}
                placeholder="Misal: Izin Sakit / Dinas Luar / Lain - Lain"
              />
            </div>
          )}

          <div className="form-grid" style={{ marginBottom: "1rem" }}>
            <div className="form-group">
              <label className="form-label" htmlFor="izin-start">
                Tanggal Mulai Izin <span className="required">*</span>
              </label>
              <input
                id="izin-start"
                type="date"
                className="form-input"
                value={data.startDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setData((prev) => ({
                    ...prev,
                    startDate: val,
                    endDate: prev.endDate < val ? val : prev.endDate,
                  }));
                }}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="izin-end">
                Tanggal Selesai Izin <span className="required">*</span>
              </label>
              <input
                id="izin-end"
                type="date"
                className="form-input"
                value={data.endDate}
                onChange={(e) => setData({ ...data, endDate: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="izin-time">
                Jam Izin <span className="hint">Isi &quot;-&quot; jika seharian</span>
              </label>
              <input
                id="izin-time"
                type="text"
                className="form-input"
                value={data.timeRange}
                onChange={(e) => setData({ ...data, timeRange: e.target.value })}
                placeholder="- atau 08:00:00 - 17:00:00"
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="izin-reason">
                Untuk Keperluan / Alasan <span className="required">*</span>
              </label>
              <input
                id="izin-reason"
                type="text"
                className="form-input"
                value={data.reason}
                onChange={(e) => setData({ ...data, reason: e.target.value })}
                placeholder="Pribadi / Keluarga / Kesehatan"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="izin-notes">
                Catatan Tambahan
              </label>
              <input
                id="izin-notes"
                type="text"
                className="form-input"
                value={data.notes}
                onChange={(e) => setData({ ...data, notes: e.target.value })}
                placeholder="Telah Disetujui via DigiHC"
              />
            </div>
          </div>
        </div>

        {/* Pejabat Penyetuju */}
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <div className="card-header">
            <div className="card-title">
              <div className="card-icon">
                <EditIcon size={15} />
              </div>
              <span>Pejabat Penyetuju (Blok Tanda Tangan)</span>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="izin-sup-name">Nama Atasan Langsung</label>
              <input
                id="izin-sup-name"
                type="text"
                className="form-input"
                value={data.supervisorName}
                onChange={(e) => setData({ ...data, supervisorName: e.target.value })}
                placeholder="Gita Kartika"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="izin-sup-title">Jabatan Atasan Langsung</label>
              <input
                id="izin-sup-title"
                type="text"
                className="form-input"
                value={data.supervisorTitle}
                onChange={(e) => setData({ ...data, supervisorTitle: e.target.value })}
                placeholder="Pgs. Team Leader"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="izin-app-name">Nama Penyetuju (Dept Head / HRD)</label>
              <input
                id="izin-app-name"
                type="text"
                className="form-input"
                value={data.approverName}
                onChange={(e) => setData({ ...data, approverName: e.target.value })}
                placeholder="Adhy Perdhana"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="izin-app-title">Jabatan Penyetuju</label>
              <input
                id="izin-app-title"
                type="text"
                className="form-input"
                value={data.approverTitle}
                onChange={(e) => setData({ ...data, approverTitle: e.target.value })}
                placeholder="Department Head"
              />
            </div>
          </div>
        </div>

        {/* Pratinjau Visual */}
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <div className="card-header">
            <div className="card-title">
              <div className="card-icon">
                <FileTextIcon size={15} />
              </div>
              <span>Pratinjau Dokumen Permohonan Izin</span>
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
              <div
                style={{
                  minWidth: "680px",
                  maxWidth: "780px",
                  margin: "0 auto",
                  background: "#ffffff",
                  color: "#000000",
                  border: "2px solid #000000",
                  padding: "18px 22px",
                  fontFamily: "Arial, Helvetica, sans-serif",
                  fontSize: "13px",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <img
                    src={`${baseAsset}/images/adidata-logo-izin.png`}
                    alt="ADIDATA"
                    style={{ height: "32px", width: "auto", objectFit: "contain" }}
                  />
                  <div>
                    {data.city || "Jakarta"}, {subDateFormatted}
                  </div>
                </div>

                <div style={{ textAlign: "center", fontSize: "20px", fontWeight: 700, margin: "10px 0 16px" }}>
                  PERMOHONAN IZIN
                </div>

                <div style={{ display: "flex", gap: "20px", marginBottom: "18px" }}>
                  <div style={{ flex: 1.15, display: "flex", border: "2px solid #000", height: "38px" }}>
                    <div style={{ width: "85px", borderRight: "2px solid #000", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                      NAMA
                    </div>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                      {data.name}
                    </div>
                  </div>
                  <div style={{ flex: 1, display: "flex", border: "2px solid #000", height: "38px" }}>
                    <div style={{ width: "85px", borderRight: "2px solid #000", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                      BAGIAN
                    </div>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                      {data.department}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: "center", fontSize: "16px", marginBottom: "12px" }}>
                  JENIS PERMOHONAN IZIN
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "18px", padding: "0 6px" }}>
                  {[
                    { k: "pulang_awal", l: "Pulang Lebih Awal" },
                    { k: "datang_terlambat", l: "Datang Terlambat" },
                    { k: "cuti", l: "Cuti" },
                    { k: "lain_lain", l: data.izinType === "lain_lain" && data.customIzinLabel ? data.customIzinLabel : "Lain - Lain" },
                  ].map((item) => (
                    <div key={item.k} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          width: "26px",
                          height: "20px",
                          border: "2px solid #000",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                        }}
                      >
                        {data.izinType === item.k ? "√" : ""}
                      </span>
                      <span>{item.l}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.4fr 0.9fr", gap: "8px" }}>
                    <div>Hari : {dayLabel}</div>
                    <div>Tanggal : {dateLabel}</div>
                    <div>Jam : {data.timeRange || "-"}</div>
                  </div>
                  <div>Untuk Keperluan : {data.reason}</div>
                  <div>Catatan : {data.notes}</div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr", gap: "18px" }}>
                  <div style={{ border: "2px solid #000", textAlign: "center" }}>
                    <div style={{ borderBottom: "2px solid #000", padding: "4px", fontWeight: 700 }}>PEMOHON</div>
                    <div style={{ height: "72px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <img
                        src={data.signatureDataUrl || `${baseAsset}/images/default-signature.png`}
                        alt="TTD"
                        style={{ maxHeight: "60px", maxWidth: "100px", objectFit: "contain" }}
                      />
                    </div>
                    <div style={{ borderTop: "2px solid #000", padding: "4px" }}>{data.name}</div>
                  </div>
                  <div style={{ border: "2px solid #000", textAlign: "center" }}>
                    <div style={{ borderBottom: "2px solid #000", padding: "4px", fontWeight: 700 }}>DISETUJUI</div>
                    <div style={{ height: "72px", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: "6px", fontSize: "12px" }}>
                      {data.supervisorTitle}
                    </div>
                    <div style={{ borderTop: "2px solid #000", padding: "4px" }}>{data.supervisorName}</div>
                  </div>
                  <div style={{ border: "2px solid #000", textAlign: "center" }}>
                    <div style={{ borderBottom: "2px solid #000", padding: "4px", fontWeight: 700 }}>DISETUJUI</div>
                    <div style={{ height: "72px", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: "6px", fontSize: "12px" }}>
                      {data.approverTitle}
                    </div>
                    <div style={{ borderTop: "2px solid #000", padding: "4px" }}>{data.approverName}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Export Actions */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <div style={{ fontWeight: 700, color: "var(--text-hi)", fontSize: "1rem" }}>
                Unduh Surat Permohonan Izin (.xlsx &amp; PDF)
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-mid)", marginTop: "2px" }}>
                Nama file otomatis: <code>{`Permohonan Izin_${formatDateId(data.startDate || data.submissionDate)}_${data.npp}_${data.name}.xlsx`}</code>
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
                onClick={handleExportExcel}
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


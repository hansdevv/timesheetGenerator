"use client";

import { useState, useEffect, useRef } from "react";
import Navbar from "@/components/Navbar";
import type { Profile, HolidayItem } from "@/lib/schemas";
import { ProfileSchema } from "@/lib/schemas";
import { useAppStore, DEFAULT_PROFILE } from "@/lib/storage";
import { useTheme, type Theme } from "@/lib/theme-context";
import {
  UserIcon,
  BriefcaseIcon,
  CalendarIcon,
  EditIcon,
  PlusIcon,
  TrashIcon,
  RefreshIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  DownloadIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
} from "@/components/Icons";

export default function ProfilPage() {
  const {
    profile,
    holidays,
    setProfile,
    addHoliday,
    removeHoliday,
    resetHolidays,
    exportBackupJson,
    importBackupJson,
  } = useAppStore();

  const { theme, resolvedTheme, setTheme, mounted } = useTheme();

  const [form, setForm] = useState<Profile>(DEFAULT_PROFILE);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayType, setNewHolidayType] = useState<"nasional" | "cuti_bersama">("nasional");
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "warning" | "info" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setForm(profile);
    }
  }, [profile]);

  const showToast = (text: string, type: "success" | "warning" | "info" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = ProfileSchema.safeParse(form);
    if (!parsed.success) {
      const firstErr = parsed.error.issues[0]?.message || "Periksa kembali data profil";
      showToast(firstErr, "warning");
      return;
    }
    setProfile(form);
    showToast("Profil & pengaturan berhasil disimpan ke penyimpanan lokal!", "success");
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      showToast("Ukuran gambar tanda tangan maksimal 1 MB", "warning");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      setForm((prev) => ({ ...prev, signatureDataUrl: result }));
      setProfile({ signatureDataUrl: result });
      showToast("Gambar tanda tangan berhasil diunggah & disimpan!", "success");
    };
    reader.readAsDataURL(file);
  };

  const handleAddHoliday = () => {
    if (!newHolidayDate || !newHolidayName.trim()) {
      showToast("Isi tanggal dan nama hari libur terlebih dahulu", "warning");
      return;
    }
    addHoliday({
      date: newHolidayDate,
      name: newHolidayName.trim(),
      type: newHolidayType,
    });
    setNewHolidayDate("");
    setNewHolidayName("");
    showToast("Hari libur baru berhasil ditambahkan!", "success");
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
        showToast("Seluruh data berhasil dipulihkan dari file JSON!", "success");
      } else {
        showToast("File JSON tidak valid", "warning");
      }
    };
    reader.readAsText(file);
  };

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
        <h1 className="page-title">Profil Karyawan &amp; Pengaturan</h1>
        <p className="page-subtitle">
          Simpan identitas karyawan, proyek default, pejabat penandatangan, tanda tangan digital (PNG), serta daftar hari libur nasional sekali saja untuk digunakan di seluruh dokumen.
        </p>
      </div>

      <div className="main-content">
        <form onSubmit={handleSaveProfile}>
          {/* Data Karyawan & Proyek */}
          <div className="card" style={{ marginBottom: "1.25rem" }}>
            <div className="card-header">
              <div className="card-title">
                <div className="card-icon">
                  <UserIcon size={15} />
                </div>
                <span>Identitas Karyawan &amp; Proyek Default</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setForm(DEFAULT_PROFILE);
                  setProfile(DEFAULT_PROFILE);
                  showToast("Profil dikembalikan ke default contoh Adidata", "info");
                }}
              >
                <RefreshIcon size={13} />
                <span>Reset Default</span>
              </button>
            </div>

            <div className="form-grid" style={{ marginBottom: "1rem" }}>
              <div className="form-group">
                <label className="form-label" htmlFor="prof-name">
                  Nama Lengkap <span className="required">*</span>
                </label>
                <input
                  id="prof-name"
                  type="text"
                  className="form-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="prof-npp">
                  NPP / ID Karyawan <span className="required">*</span>
                </label>
                <input
                  id="prof-npp"
                  type="text"
                  className="form-input"
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="prof-pos">
                  Jabatan / Posisi <span className="required">*</span>
                </label>
                <input
                  id="prof-pos"
                  type="text"
                  className="form-input"
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="prof-dept">
                  Departemen / Divisi <span className="required">*</span>
                </label>
                <input
                  id="prof-dept"
                  type="text"
                  className="form-input"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="prof-proj">Nama Proyek / Klien Default</label>
                <input
                  id="prof-proj"
                  type="text"
                  className="form-input"
                  value={form.project || ""}
                  onChange={(e) => setForm({ ...form, project: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="prof-pid">Project ID</label>
                <input
                  id="prof-pid"
                  type="text"
                  className="form-input"
                  value={form.projectId || ""}
                  onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="prof-app">Aplikasi Berdampak</label>
                <input
                  id="prof-app"
                  type="text"
                  className="form-input"
                  value={form.aplikasiBerdampak || ""}
                  onChange={(e) => setForm({ ...form, aplikasiBerdampak: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="prof-aip">AIP Fitur</label>
                <input
                  id="prof-aip"
                  type="text"
                  className="form-input"
                  value={form.aipFitur || ""}
                  onChange={(e) => setForm({ ...form, aipFitur: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="prof-city">
                  Kota Penandatanganan Default <span className="required">*</span>
                </label>
                <input
                  id="prof-city"
                  type="text"
                  className="form-input"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Atasan & Pejabat Penandatangan */}
          <div className="card" style={{ marginBottom: "1.25rem" }}>
            <div className="card-header">
              <div className="card-title">
                <div className="card-icon">
                  <BriefcaseIcon size={15} />
                </div>
                <span>Atasan &amp; Pejabat Penyetuju Default</span>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="prof-off-name">Nama Pemeriksa (Officer)</label>
                <input
                  id="prof-off-name"
                  type="text"
                  className="form-input"
                  value={form.officerName || ""}
                  onChange={(e) => setForm({ ...form, officerName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="prof-off-pos">Jabatan Pemeriksa</label>
                <input
                  id="prof-off-pos"
                  type="text"
                  className="form-input"
                  value={form.officerPosition || ""}
                  onChange={(e) => setForm({ ...form, officerPosition: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="prof-sup-name">
                  Nama Atasan Langsung (Team Leader) <span className="required">*</span>
                </label>
                <input
                  id="prof-sup-name"
                  type="text"
                  className="form-input"
                  value={form.supervisorName}
                  onChange={(e) => setForm({ ...form, supervisorName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="prof-sup-pos">
                  Jabatan Atasan Langsung <span className="required">*</span>
                </label>
                <input
                  id="prof-sup-pos"
                  type="text"
                  className="form-input"
                  value={form.supervisorPosition}
                  onChange={(e) => setForm({ ...form, supervisorPosition: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="prof-app-name">Nama Penyetuju (Department Head / HRD)</label>
                <input
                  id="prof-app-name"
                  type="text"
                  className="form-input"
                  value={form.approverName || ""}
                  onChange={(e) => setForm({ ...form, approverName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="prof-app-pos">Jabatan Penyetuju</label>
                <input
                  id="prof-app-pos"
                  type="text"
                  className="form-input"
                  value={form.approverPosition || ""}
                  onChange={(e) => setForm({ ...form, approverPosition: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Tanda Tangan Gambar (PNG) */}
          <div className="card" style={{ marginBottom: "1.25rem" }}>
            <div className="card-header">
              <div className="card-title">
                <div className="card-icon">
                  <EditIcon size={15} />
                </div>
                <span>Gambar Tanda Tangan Digital (PNG)</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
              <div
                style={{
                  width: "180px",
                  height: "100px",
                  background: "#ffffff",
                  border: "1px dashed var(--border-mid)",
                  borderRadius: "var(--radius-sm)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "8px",
                }}
              >
                <img
                  src={form.signatureDataUrl || `${baseAsset}/images/default-signature.png`}
                  alt="Pratinjau Tanda Tangan"
                  style={{ maxHeight: "82px", maxWidth: "160px", objectFit: "contain" }}
                />
              </div>

              <div style={{ flex: 1, minWidth: "240px" }}>
                <p style={{ fontSize: "0.84rem", color: "var(--text-mid)", marginBottom: "0.75rem" }}>
                  Unggah gambar tanda tangan transparan (PNG) untuk disematkan secara otomatis ke dokumen Excel dan PDF (Timesheet, SPL, dan Surat Izin). Disimpan lokal di browser Anda.
                </p>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    style={{ display: "none" }}
                    onChange={handleSignatureUpload}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Unggah Tanda Tangan (PNG)
                  </button>
                  {form.signatureDataUrl && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ color: "var(--red)" }}
                      onClick={() => {
                        setForm((prev) => ({ ...prev, signatureDataUrl: "" }));
                        setProfile({ signatureDataUrl: "" });
                        showToast("Menggunakan tanda tangan bawaan template", "info");
                      }}
                    >
                      Gunakan TTD Bawaan Template
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className="btn btn-primary btn-lg">
                <CheckCircleIcon size={16} />
                <span>Simpan Profil &amp; Pengaturan</span>
              </button>
            </div>
          </div>
        </form>

        {/* Pengaturan Tema Tampilan */}
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <div className="card-header">
            <div>
              <div className="card-title">
                <div className="card-icon">
                  <SunIcon size={15} />
                </div>
                <span>Tema &amp; Tampilan Aplikasi</span>
              </div>
              <div className="card-subtitle">
                Pilih tema tampilan yang paling nyaman untuk Anda. Pengaturan tersimpan otomatis di browser lokal.
              </div>
            </div>
            {mounted && (
              <span
                style={{
                  fontSize: "0.78rem",
                  color: "var(--text-mid)",
                  background: "var(--stat-bg)",
                  border: "1px solid var(--border)",
                  padding: "4px 10px",
                  borderRadius: "9999px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>Tema aktif:</span>
                <strong style={{ color: "var(--text-hi)", textTransform: "capitalize" }}>
                  {resolvedTheme === "dark" ? "Mode Gelap" : "Mode Terang"}
                  {theme === "system" && " (Sistem)"}
                </strong>
              </span>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "12px",
            }}
          >
            {[
              {
                id: "light" as Theme,
                title: "Mode Terang",
                desc: "Latar putih bersih dengan kontras tinggi, cocok di pencahayaan terang.",
                icon: <SunIcon size={20} />,
              },
              {
                id: "dark" as Theme,
                title: "Mode Gelap",
                desc: "Nuansa obsidian slate yang nyaman di mata untuk bekerja lama.",
                icon: <MoonIcon size={20} />,
              },
              {
                id: "system" as Theme,
                title: "Ikuti Sistem (Otomatis)",
                desc: "Menyesuaikan otomatis dengan mode terang/gelap pada perangkat Anda.",
                icon: <MonitorIcon size={20} />,
              },
            ].map((opt) => {
              const isSelected = mounted && theme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setTheme(opt.id);
                    showToast(`Tema diubah ke ${opt.title}`, "info");
                  }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: "8px",
                    padding: "1rem",
                    borderRadius: "var(--radius-sm)",
                    background: isSelected ? "var(--accent-dim)" : "var(--bg-card-subtle)",
                    border: `1.5px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                    color: "inherit",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                    <div
                      style={{
                        color: isSelected ? "var(--accent-bright)" : "var(--text-mid)",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {opt.icon}
                    </div>
                    {isSelected && (
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: "var(--accent-bright)",
                          background: "var(--accent-dim-border)",
                          padding: "2px 7px",
                          borderRadius: "9999px",
                        }}
                      >
                        Dipilih
                      </span>
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text-hi)" }}>
                      {opt.title}
                    </div>
                    <div style={{ fontSize: "0.77rem", color: "var(--text-mid)", marginTop: "2px", lineHeight: 1.4 }}>
                      {opt.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Daftar Hari Libur Nasional & Cuti Bersama */}
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <div className="card-header">
            <div>
              <div className="card-title">
                <div className="card-icon">
                  <CalendarIcon size={15} />
                </div>
                <span>Daftar Hari Libur Nasional &amp; Cuti Bersama ({holidays.length} Hari)</span>
              </div>
              <div className="card-subtitle">
                Digunakan untuk menandai hari libur otomatis di Timesheet dan menghitung hari kerja efektif pada Surat Izin.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                resetHolidays();
                showToast("Daftar libur nasional 2026 dikembalikan ke default", "info");
              }}
            >
              <RefreshIcon size={13} />
              <span>Reset Libur 2026</span>
            </button>
          </div>

          <div className="form-grid" style={{ marginBottom: "1rem", alignItems: "flex-end" }}>
            <div className="form-group">
              <label className="form-label" htmlFor="hol-date">Tanggal Libur</label>
              <input
                id="hol-date"
                type="date"
                className="form-input"
                value={newHolidayDate}
                onChange={(e) => setNewHolidayDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="hol-name">Keterangan Hari Libur</label>
              <input
                id="hol-name"
                type="text"
                className="form-input"
                placeholder="Contoh: Cuti Bersama Tahun Baru"
                value={newHolidayName}
                onChange={(e) => setNewHolidayName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="hol-type">Jenis</label>
              <select
                id="hol-type"
                className="form-select"
                value={newHolidayType}
                onChange={(e) => setNewHolidayType(e.target.value as "nasional" | "cuti_bersama")}
              >
                <option value="nasional">Libur Nasional</option>
                <option value="cuti_bersama">Cuti Bersama</option>
              </select>
            </div>
            <div>
              <button type="button" className="btn btn-primary" onClick={handleAddHoliday}>
                <PlusIcon size={14} />
                <span>Tambah Hari Libur</span>
              </button>
            </div>
          </div>

          <div
            style={{
              maxHeight: "280px",
              overflowY: "auto",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <table className="timesheet-table" style={{ minWidth: "100%" }}>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Nama Hari Libur</th>
                  <th>Jenis</th>
                  <th style={{ width: "80px", textAlign: "center" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {holidays.map((h: HolidayItem) => (
                  <tr key={h.date}>
                    <td style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 600 }}>{h.date}</td>
                    <td>{h.name}</td>
                    <td>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "9999px",
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          background: h.type === "nasional" ? "var(--red-dim)" : "var(--amber-dim)",
                          color: h.type === "nasional" ? "var(--red-text)" : "var(--amber-text)",
                        }}
                      >
                        {h.type === "nasional" ? "Libur Nasional" : "Cuti Bersama"}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: "var(--red)" }}
                        onClick={() => removeHoliday(h.date)}
                      >
                        <TrashIcon size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Backup & Restore JSON */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <div style={{ fontWeight: 700, color: "var(--text-hi)", fontSize: "0.95rem" }}>
                Cadangkan &amp; Pulihkan Seluruh Data (JSON Backup)
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-mid)", marginTop: "2px" }}>
                Ekspor seluruh profil, draft dokumen, daftar hari libur, dan riwayat sebagai file JSON untuk backup atau pindah perangkat.
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input
                ref={backupInputRef}
                type="file"
                accept="application/json"
                style={{ display: "none" }}
                onChange={handleImportBackup}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => backupInputRef.current?.click()}
              >
                Impor JSON
              </button>
              <button type="button" className="btn btn-primary" onClick={handleExportBackup}>
                <DownloadIcon size={15} />
                <span>Ekspor Backup JSON</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


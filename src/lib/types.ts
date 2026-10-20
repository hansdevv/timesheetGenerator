// Types for the Timesheet Generator

export type AttendanceStatus = "P" | "S" | "V" | "BT" | "PM" | "X" | "H";

export interface TimesheetRow {
  id: string;
  date: string; // YYYY-MM-DD
  dayName: string; // Senin, Selasa, etc.
  startTime: string; // HH:MM or HH:MM:SS
  endTime: string; // HH:MM or HH:MM:SS
  totalHours: number;
  status: AttendanceStatus;
  activity: string;
  projectName: string;
  projectId: string;
  aplikasiBerdampak?: string;
  aipFitur?: string;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
}

export interface TimesheetHeader {
  projectName: string;
  department: string;
  name: string;
  npp: string;
  periode: string; // "September 2026"
  month: number; // 1-12
  year: number;
  employeeTitle: string; // "Pegawai" / "Developer"
  officerName: string; // "Valentino Tarigan"
  officerTitle: string; // "Officer"
  managerName: string; // "Gita Kartika"
  managerTitle: string; // "Pgs. Team Leader"
  deptHeadName: string; // "Adhy Perdhana"
  deptHeadTitle: string; // "Department Head"
  projectId: string; // "P25068"
  aplikasiBerdampak: string; // "ORMS"
  aipFitur: string; // "Implementasi ORMS"
  dateStamp: string; // "01 Oktober 2026"
}

export interface SPLEntry {
  no: number;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM or HH:MM:SS
  endTime: string; // HH:MM or HH:MM:SS
  totalHours?: number;
  tasks: string; // multiline
}

export interface SPLData {
  npp: string;
  name: string;
  department: string;
  position: string;
  entries: SPLEntry[];
  teamLeaderName: string;
  teamLeaderTitle: string;
  deptHeadName: string;
  deptHeadTitle: string;
}

export type TimesheetData = {
  header: TimesheetHeader;
  rows: TimesheetRow[];
};

export const STATUS_OPTIONS: { value: AttendanceStatus; label: string; description: string }[] = [
  { value: "P", label: "P", description: "Present" },
  { value: "S", label: "S", description: "Sick" },
  { value: "V", label: "V", description: "Vacation" },
  { value: "BT", label: "BT", description: "Business Trip" },
  { value: "PM", label: "PM", description: "Permit" },
  { value: "X", label: "X", description: "Not Working" },
  { value: "H", label: "H", description: "Holiday" },
];

export const MONTH_NAMES = [
  "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI",
  "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"
];

export const MONTH_NAMES_TITLE = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

export const MONTH_NAMES_EN = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
];

export const DAY_NAMES_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/**
 * Generate all dates for a given month/year as TimesheetRow[]
 */
/**
 * Generate all dates for a given month/year as TimesheetRow[]
 */
export function generateMonthRows(
  month: number,
  year: number,
  defaults?: {
    projectName?: string;
    projectId?: string;
    aplikasiBerdampak?: string;
    aipFitur?: string;
  }
): TimesheetRow[] {
  const rows: TimesheetRow[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat, 5=Fri
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const defaultHours = isWeekend ? 0 : dayOfWeek === 5 ? 7.5 : 8.0;

    rows.push({
      id: dateStr,
      date: dateStr,
      dayName: DAY_NAMES_ID[dayOfWeek],
      startTime: isWeekend ? "" : "08:00",
      endTime: isWeekend ? "" : "17:00",
      totalHours: defaultHours,
      status: isWeekend ? "X" : "P",
      activity: isWeekend ? "Weekend" : "",
      projectName: isWeekend ? "" : (defaults?.projectName || ""),
      projectId: isWeekend ? "" : (defaults?.projectId || ""),
      aplikasiBerdampak: isWeekend ? "" : (defaults?.aplikasiBerdampak || ""),
      aipFitur: isWeekend ? "" : (defaults?.aipFitur || ""),
      isWeekend,
      isHoliday: false,
    });
  }

  return rows;
}

/**
 * Calculate total hours from start/end time strings with lunch break deduction
 */
export function calcHours(start: string, end: string, dayOfWeek?: number): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMin = sh * 60 + (sm || 0);
  const endMin = eh * 60 + (em || 0);
  const diffHours = (endMin - startMin) / 60;
  if (diffHours <= 0) return 0;
  
  // Deduct lunch break (1.5h for Friday, 1.0h for others) if duration >= 5h
  const breakHours = diffHours >= 5 ? (dayOfWeek === 5 ? 1.5 : 1.0) : 0;
  return Math.max(0, Math.round((diffHours - breakHours) * 100) / 100);
}

/**
 * Summarize timesheet statistics
 */
export function summarizeTimesheet(rows: TimesheetRow[]) {
  const summary = {
    present: 0,
    sick: 0,
    vacation: 0,
    businessTrip: 0,
    permit: 0,
    notWorking: 0,
    holiday: 0,
    totalWorkingDays: 0,
    totalHours: 0,
  };

  for (const row of rows) {
    // Weekend non-working days should NOT be counted as notWorking (X)
    if (row.isWeekend && row.status !== "P") {
      continue;
    }
    // Holiday non-working days
    if (row.isHoliday || row.status === "H") {
      summary.holiday++;
      continue;
    }
    switch (row.status) {
      case "P": summary.present++; break;
      case "S": summary.sick++; break;
      case "V": summary.vacation++; break;
      case "BT": summary.businessTrip++; break;
      case "PM": summary.permit++; break;
      case "X": summary.notWorking++; break;
    }
    summary.totalHours += row.totalHours;
    if (["P", "BT"].includes(row.status)) {
      summary.totalWorkingDays++;
    }
  }

  return summary;
}

export interface SavedTimesheetRecord {
  id: string;
  savedAt: string; // ISO string
  header: TimesheetHeader;
  rows: TimesheetRow[];
  totalHours: number;
  presentDays: number;
  overtimeDays: number;
}

export const TASK_PRESETS = [
  "Daily Standup & Sprint Backlog Refinement",
  "Perbaikan Defect & Bug Fixing CR",
  "Support SIT & UAT Testing",
  "Pengembangan Fitur & Integrasi API",
  "Code Review & Refactoring Kode",
  "Migrasi Database & Data Patching",
  "Deployment & Monitoring Production",
  "Penyusunan Dokumentasi Teknis & Release Notes",
  "Meeting Koordinasi Tim Teknis & User",
  "Investigasi Issue & Performance Tuning",
];

export function formatTimesheetSummaryText(header: TimesheetHeader, rows: TimesheetRow[]): string {
  const summary = summarizeTimesheet(rows);
  const overtimeCount = rows.filter((r) => (r.isWeekend && r.status === "P" && r.totalHours > 0) || r.totalHours > 8.5).length;
  const monthName = MONTH_NAMES_TITLE[header.month - 1] || "";

  return `📋 *LAPORAN TIMESHEET BULANAN*
────────────────────────
👤 *Nama*: ${header.name || "-"} (${header.npp || "-"})
🏢 *Departemen*: ${header.department || "-"}
💼 *Proyek*: ${header.projectName || "-"} [${header.projectId || "-"}]
📅 *Periode*: ${monthName} ${header.year}
────────────────────────
📊 *Ringkasan Kehadiran*:
• Total Jam Kerja : ${summary.totalHours.toFixed(1)} Jam
• Hari Masuk (P) : ${summary.present} Hari
• Hari Lembur (SPL) : ${overtimeCount} Hari
• Sakit / Izin / Cuti : ${summary.sick + summary.permit + summary.vacation} Hari
────────────────────────
Generated via TimesheetGen Adidata`;
}

// LocalStorage Keys
export const STORAGE_KEY_DRAFT = "timesheet_current_draft_v1";
export const STORAGE_KEY_HISTORY = "timesheet_history_records_v1";

export function saveTimesheetDraft(header: TimesheetHeader, rows: TimesheetRow[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload = { header, rows, updatedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY_DRAFT, JSON.stringify(payload));
  } catch (err) {
    console.error("Gagal simpan draft ke localStorage", err);
  }
}

export function loadTimesheetDraft(): { header: TimesheetHeader; rows: TimesheetRow[] } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DRAFT);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error("Gagal baca draft dari localStorage", err);
    return null;
  }
}

export function saveTimesheetToHistory(header: TimesheetHeader, rows: TimesheetRow[]): SavedTimesheetRecord {
  const summary = summarizeTimesheet(rows);
  const overtimeCount = rows.filter((r) => (r.isWeekend && r.status === "P" && r.totalHours > 0) || r.totalHours > 8.5).length;
  const record: SavedTimesheetRecord = {
    id: `ts_${header.year}_${header.month}_${Date.now()}`,
    savedAt: new Date().toISOString(),
    header: { ...header },
    rows: [...rows],
    totalHours: summary.totalHours,
    presentDays: summary.present,
    overtimeDays: overtimeCount,
  };

  if (typeof window !== "undefined") {
    try {
      const existing = loadTimesheetHistory();
      // Replace existing with same month/year or prepend
      const filtered = existing.filter((item) => !(item.header.month === header.month && item.header.year === header.year && item.header.npp === header.npp));
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify([record, ...filtered]));
    } catch (err) {
      console.error("Gagal simpan riwayat ke localStorage", err);
    }
  }
  return record;
}

export function loadTimesheetHistory(): SavedTimesheetRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error("Gagal baca riwayat dari localStorage", err);
    return [];
  }
}

export function deleteTimesheetFromHistory(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const existing = loadTimesheetHistory();
    const updated = existing.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated));
  } catch (err) {
    console.error("Gagal hapus riwayat dari localStorage", err);
  }
}

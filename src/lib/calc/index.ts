import type { HolidayItem } from "@/lib/schemas";

export const DAY_NAMES_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export const MONTH_NAMES_TITLE = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

export const ROMAN_MONTHS = [
  "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"
];

/**
 * Convert month number (1-12) to Roman numeral (I-XII)
 */
export function toRomanMonth(month: number): string {
  return ROMAN_MONTHS[month - 1] || "I";
}

/**
 * Format time string to HH:MM:SS
 */
export function formatTimeWithSeconds(timeStr?: string): string {
  if (!timeStr) return "";
  const trimmed = timeStr.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(":");
  const hh = String(Number(parts[0]) || 0).padStart(2, "0");
  const mm = String(Number(parts[1]) || 0).padStart(2, "0");
  const ss = String(Number(parts[2]) || 0).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/**
 * Calculate work hours from start/end time strings (HH:MM or HH:MM:SS).
 * Supports cross-midnight shifts and lunch break deduction (1.5h on Friday, 1.0h on other days if duration >= 5h).
 */
export function calcWorkHours(
  start: string,
  end: string,
  dayOfWeek?: number,
  deductBreak = true
): number {
  if (!start || !end) return 0;
  const [sh, sm, ss] = start.split(":").map(Number);
  const [eh, em, es] = end.split(":").map(Number);
  if (isNaN(sh) || isNaN(eh)) return 0;

  const startSec = (sh || 0) * 3600 + (sm || 0) * 60 + (ss || 0);
  let endSec = (eh || 0) * 3600 + (em || 0) * 60 + (es || 0);

  // Support cross-midnight when explicitly overnight (e.g. 22:00 to 02:00)
  if (endSec < startSec) {
    endSec += 24 * 3600;
  }

  const diffHours = (endSec - startSec) / 3600;
  if (diffHours <= 0) return 0;

  const breakHours = deductBreak && diffHours >= 5 ? (dayOfWeek === 5 ? 1.5 : 1.0) : 0;
  return Math.max(0, Math.round((diffHours - breakHours) * 100) / 100);
}

/**
 * Format date YYYY-MM-DD to Indonesian date string (e.g., "06 November 2026")
 */
export function formatDateId(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  return `${String(d).padStart(2, "0")} ${MONTH_NAMES_TITLE[m - 1] || ""} ${y}`;
}

/**
 * Get Indonesian day name (e.g., "Jumat") from YYYY-MM-DD
 */
export function getDayNameId(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return "";
  const dt = new Date(y, m - 1, d);
  return DAY_NAMES_ID[dt.getDay()] || "";
}

/**
 * Calculate working days between startDate and endDate inclusive,
 * excluding weekends (Saturday & Sunday) and holidays in the holiday list.
 */
export function calcWorkingDays(
  startDate: string,
  endDate: string,
  holidays: HolidayItem[] = []
): number {
  if (!startDate || !endDate) return 0;
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const start = new Date(sy, (sm || 1) - 1, sd || 1);
  const end = new Date(ey, (em || 1) - 1, ed || 1);
  if (end < start) return 0;

  const holidaySet = new Set(holidays.map((h) => h.date));
  let count = 0;
  const cur = new Date(start);

  while (cur <= end) {
    const dow = cur.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const yyyy = cur.getFullYear();
    const mm = String(cur.getMonth() + 1).padStart(2, "0");
    const dd = String(cur.getDate()).padStart(2, "0");
    const ds = `${yyyy}-${mm}-${dd}`;

    if (!isWeekend && !holidaySet.has(ds)) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/**
 * Format day range and date range for Surat Permohonan Izin
 * e.g., Single day -> Hari: "Jumat", Tanggal: "06 November 2026"
 * Multi-day -> Hari: "Senin - Rabu", Tanggal: "02 - 04 November 2026 (3 Hari Kerja)"
 */
export function formatIzinDateRange(
  startDate: string,
  endDate: string
): { dayLabel: string; dateLabel: string } {
  if (!startDate) return { dayLabel: "-", dateLabel: "-" };
  if (!endDate || startDate === endDate) {
    return {
      dayLabel: getDayNameId(startDate),
      dateLabel: formatDateId(startDate),
    };
  }

  const startDay = getDayNameId(startDate);
  const endDay = getDayNameId(endDate);
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);

  if (sy === ey && sm === em) {
    return {
      dayLabel: `${startDay} - ${endDay}`,
      dateLabel: `${String(sd).padStart(2, "0")} - ${String(ed).padStart(2, "0")} ${MONTH_NAMES_TITLE[sm - 1]} ${sy}`,
    };
  }

  return {
    dayLabel: `${startDay} - ${endDay}`,
    dateLabel: `${formatDateId(startDate)} s/d ${formatDateId(endDate)}`,
  };
}


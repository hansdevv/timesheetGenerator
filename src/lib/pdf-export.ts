"use client";

import type { TimesheetData } from "./types";
import { MONTH_NAMES_TITLE } from "./types";

/**
 * Format a time fraction (Excel-style 0..1) to HH:MM:SS string.
 * Used to mirror how Excel displays hh:mm:ss cell values.
 */
function fracToHMS(frac: number): string {
  const totalSec = Math.round(frac * 86400);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function parseTimeToFrac(timeStr: string): number | null {
  if (!timeStr) return null;
  const parts = timeStr.trim().split(":").map(Number);
  if (isNaN(parts[0])) return null;
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  const s = parts[2] || 0;
  return (h * 3600 + m * 60 + s) / 86400;
}

/**
 * Export Timesheet as PDF via browser print dialog.
 * Layout mirrors the official Adidata Excel template exactly:
 * – Same column order: No | Date | Start | End | Total | P | S | BT | PM | V | X | Activity | Project Name | Project ID | Aplikasi | AIP Fitur
 * – Same header info block order: NAME OF PROJECT / DEPARTMENT / NAME / NPP / PERIODE
 * – Same footer: TTD Pegawai | Di Periksa Oleh | (Di Periksa Oleh cont.) | Disetujui Oleh
 * – Weekend = gray fill, Holiday = gray fill, Present = white, others = white
 * – Status value shown in its dedicated column (P→col F, S→col G, BT→col H, PM→col I, V→col J, X→col K)
 */
export function exportTimesheetPDF(data: TimesheetData): void {
  const { header, rows } = data;
  const monthName = MONTH_NAMES_TITLE[header.month - 1] || "";
  const periodeLabel = `${monthName} ${header.year}`;

  // Build summary counts (mirrors Excel row 41)
  let countP = 0, countS = 0, countBT = 0, countPM = 0, countV = 0, countX = 0;

  const rowsHtml = rows.map((row, idx) => {
    const dateObj = new Date(`${row.date}T00:00:00Z`);
    const dayOfWeek = dateObj.getUTCDay(); // 0=Sun,5=Fri,6=Sat
    const dateFormatted = dateObj.toLocaleDateString("id-ID", {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).replace(/ /g, "-"); // "1-Sep-2026"

    const isWeekend = row.isWeekend;
    const isHoliday = row.isHoliday || row.status === "H";
    const isPresent = row.status === "P";

    const isWeekendDayOff = isWeekend && !isPresent;
    const isHolidayDayOff = isHoliday && !isPresent;
    const isNonWorking = isWeekendDayOff || isHolidayDayOff;

    // Row background: gray for non-working, white for working
    const GRAY = "#bfbfbf";
    const WHITE = "#ffffff";
    const rowBg = isNonWorking ? GRAY : WHITE;
    const cellStyle = (extra = "") =>
      `background:${rowBg}; padding:3px 5px; border:1px solid #000; font-size:7.5pt; vertical-align:middle;${extra}`;

    // Cell values
    let startHMS = "";
    let endHMS = "";
    let totalHMS = "";
    let colP = "", colS = "", colBT = "", colPM = "", colV = "", colX = "";
    let activity = "";

    if (isWeekendDayOff) {
      activity = "Weekend";
    } else if (isHolidayDayOff) {
      activity = row.activity || row.holidayName || "Hari Libur Nasional";
    } else if (isPresent) {
      countP++;
      const fracStart = parseTimeToFrac(row.startTime);
      const fracEnd = parseTimeToFrac(row.endTime);
      const breakFrac = dayOfWeek === 5 ? 1.5 / 24 : 1.0 / 24;
      const netFrac = fracStart != null && fracEnd != null ? Math.max(0, fracEnd - fracStart - breakFrac) : 0;
      startHMS = fracStart != null ? fracToHMS(fracStart) : "";
      endHMS = fracEnd != null ? fracToHMS(fracEnd) : "";
      totalHMS = fracToHMS(netFrac);
      colP = "P";
      activity = row.activity || "";
    } else {
      // S / BT / PM / V / X
      if (row.status === "S") { countS++; colS = "S"; }
      else if (row.status === "BT") { countBT++; colBT = "BT"; }
      else if (row.status === "PM") { countPM++; colPM = "PM"; }
      else if (row.status === "V") { countV++; colV = "V"; }
      else { countX++; colX = "x"; }
      activity = row.activity || (
        row.status === "S" ? "Sakit" :
        row.status === "V" ? "Cuti / Vacation" :
        row.status === "BT" ? "Business Trip" :
        row.status === "PM" ? "Permit / Izin" : ""
      );
    }

    const centerBold = `text-align:center; font-weight:700;`;
    const center = `text-align:center;`;
    const mono = `font-family:Calibri,Arial,sans-serif;`;

    return `<tr>
      <td style="${cellStyle(center)}">${idx + 1}</td>
      <td style="${cellStyle(center + mono)}">${isNonWorking ? dateFormatted : dateFormatted}</td>
      <td style="${cellStyle(center + mono + (isPresent ? "font-weight:700;" : ""))}">${startHMS}</td>
      <td style="${cellStyle(center + mono + (isPresent ? "font-weight:700;" : ""))}">${endHMS}</td>
      <td style="${cellStyle(center + mono + (isPresent ? "font-weight:700;" : ""))}">${totalHMS}</td>
      <td style="${cellStyle(centerBold)}">${colP}</td>
      <td style="${cellStyle(centerBold)}">${colS}</td>
      <td style="${cellStyle(centerBold)}">${colBT}</td>
      <td style="${cellStyle(centerBold)}">${colPM}</td>
      <td style="${cellStyle(centerBold)}">${colV}</td>
      <td style="${cellStyle(centerBold)}">${colX}</td>
      <td style="${cellStyle("font-size:7pt;")} background:${rowBg};" colspan="3">${activity}</td>
      <td style="${cellStyle("font-size:7pt;")}">${isNonWorking ? "" : (row.projectName || header.projectName || "")}</td>
      <td style="${cellStyle(center + "font-size:7pt;")}">${isNonWorking ? "" : (row.projectId || header.projectId || "")}</td>
      <td style="${cellStyle(center + "font-size:7pt;")}">${isNonWorking ? "" : (row.aplikasiBerdampak || header.aplikasiBerdampak || "")}</td>
      <td style="${cellStyle("font-size:7pt;")}">${isNonWorking ? "" : (row.aipFitur || header.aipFitur || "")}</td>
    </tr>`;
  }).join("\n");

  // Summary row (mirrors row 41 in Excel)
  const summaryRow = `<tr style="background:#f0f0f0;">
    <td colspan="5" style="padding:4px 6px; border:1px solid #000; font-size:7.5pt; text-align:right; font-weight:700;">TOTAL</td>
    <td style="padding:4px 6px; border:1px solid #000; font-size:7.5pt; text-align:center; font-weight:700;">${countP}</td>
    <td style="padding:4px 6px; border:1px solid #000; font-size:7.5pt; text-align:center; font-weight:700;">${countS}</td>
    <td style="padding:4px 6px; border:1px solid #000; font-size:7.5pt; text-align:center; font-weight:700;">${countBT}</td>
    <td style="padding:4px 6px; border:1px solid #000; font-size:7.5pt; text-align:center; font-weight:700;">${countPM}</td>
    <td style="padding:4px 6px; border:1px solid #000; font-size:7.5pt; text-align:center; font-weight:700;">${countV}</td>
    <td style="padding:4px 6px; border:1px solid #000; font-size:7.5pt; text-align:center; font-weight:700;">${countX}</td>
    <td colspan="7" style="padding:4px 6px; border:1px solid #000;"></td>
  </tr>`;

  // Date stamp (mirrors row 50 in Excel: "DATE : 01 Oktober 2026")
  const nextMonth = header.month === 12 ? 1 : header.month + 1;
  const nextYear = header.month === 12 ? header.year + 1 : header.year;
  const dateStamp = header.dateStamp || `01 ${MONTH_NAMES_TITLE[nextMonth - 1]} ${nextYear}`;
  const dateStampText = `DATE : ${dateStamp}`;

  // Signature names
  const empName = header.name || "_______________";
  const officerName = header.officerName || "Valentino Tarigan";
  const officerTitle = header.officerTitle || "Officer";
  const managerName = header.managerName || "Gita Kartika";
  const managerTitle = header.managerTitle || "Pgs. Team Leader";
  const deptHeadName = header.deptHeadName || "Adhy Perdhana";
  const deptHeadTitle = header.deptHeadTitle || "Department Head";
  const employeeTitle = header.employeeTitle || "Pegawai";

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Time Sheet ${periodeLabel} - ${header.name}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm 10mm 10mm 10mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Calibri, Arial, Helvetica, sans-serif;
      font-size: 9pt;
      color: #000;
      background: #fff;
    }

    /* ── Title ─────────────────────────────────────── */
    .doc-title {
      text-align: center;
      font-size: 14pt;
      font-weight: 700;
      letter-spacing: 1px;
      margin-bottom: 8px;
      text-transform: uppercase;
    }

    /* ── Header info block (mirrors D2:D6) ─────────── */
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 6px;
      font-size: 8.5pt;
    }
    .header-table td {
      padding: 1px 4px;
    }
    .header-label {
      width: 160px;
      font-weight: 400;
      color: #000;
    }
    .header-value {
      font-weight: 400;
      color: #000;
    }

    /* ── Data table ─────────────────────────────────── */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 6px;
      table-layout: fixed;
    }
    .data-table thead th {
      background: #bfbfbf;
      border: 1px solid #000;
      padding: 3px 4px;
      font-size: 7pt;
      font-weight: 700;
      text-align: center;
      vertical-align: middle;
    }

    /* ── Column widths (mirrors Excel column widths) ── */
    .col-no   { width: 22px; }
    .col-date { width: 62px; }
    .col-time { width: 46px; }
    .col-stat { width: 20px; }
    .col-act  { width: auto; } /* flex-fill across 3 merged */
    .col-proj { width: 90px; }
    .col-pid  { width: 52px; }
    .col-app  { width: 52px; }
    .col-aip  { width: 80px; }

    /* ── Signatures (mirrors rows 43-50) ───────────── */
    .sig-section {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 6px;
      margin-top: 10px;
    }
    .sig-box {
      border: 1px solid #ccc;
      padding: 6px 8px;
    }
    .sig-header {
      font-size: 8pt;
      font-weight: 400;
      margin-bottom: 36px;
    }
    .sig-name {
      font-size: 8.5pt;
      font-weight: 700;
      text-align: center;
      border-top: 1px solid #000;
      padding-top: 4px;
    }
    .sig-title {
      font-size: 8pt;
      text-align: center;
    }
    .sig-date {
      font-size: 7.5pt;
      color: #555;
      margin-top: 4px;
    }
  </style>
</head>
<body>
  <div class="doc-title">TIME SHEET</div>

  <!-- Header Info Block (mirrors D2:D6 in Excel) -->
  <table class="header-table">
    <tr>
      <td class="header-label">NAME OF PROJECT</td>
      <td class="header-value">:  ${header.projectName || ""}</td>
      <td width="20"></td>
      <td class="header-label">NPP</td>
      <td class="header-value">:  ${header.npp || ""}</td>
    </tr>
    <tr>
      <td class="header-label">DEPARTMENT / DIVISION</td>
      <td class="header-value">:  ${header.department || ""}</td>
      <td></td>
      <td class="header-label">PERIODE</td>
      <td class="header-value">:  ${periodeLabel}</td>
    </tr>
    <tr>
      <td class="header-label">NAME</td>
      <td class="header-value">:  ${header.name || ""}</td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
  </table>

  <!-- Data Table (mirrors cols B–R, rows 9–41) -->
  <table class="data-table">
    <thead>
      <tr>
        <th class="col-no" rowspan="2">No</th>
        <th class="col-date" rowspan="2">Date</th>
        <th class="col-time" rowspan="2">Start Time</th>
        <th class="col-time" rowspan="2">End Time</th>
        <th class="col-time" rowspan="2">Total Hours</th>
        <th colspan="6">Keterangan</th>
        <th colspan="3" rowspan="2">Activity / Remark</th>
        <th class="col-proj" rowspan="2">Project Name</th>
        <th class="col-pid" rowspan="2">Project ID</th>
        <th class="col-app" rowspan="2">Aplikasi Berdampak</th>
        <th class="col-aip" rowspan="2">AIP / Fitur</th>
      </tr>
      <tr>
        <th class="col-stat">P</th>
        <th class="col-stat">S</th>
        <th class="col-stat">BT</th>
        <th class="col-stat">PM</th>
        <th class="col-stat">V</th>
        <th class="col-stat">X</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      ${summaryRow}
    </tbody>
  </table>

  <!-- Signature Section (mirrors rows 43-50 in Excel) -->
  <div class="sig-section">
    <!-- Col B: TTD PEGAWAI -->
    <div class="sig-box">
      <div class="sig-header">TTD PEGAWAI,</div>
      <div class="sig-name">( ${empName} )</div>
      <div class="sig-title">${employeeTitle}</div>
      <div class="sig-date">${dateStampText}</div>
    </div>
    <!-- Col E: DI PERIKSA OLEH (Officer) -->
    <div class="sig-box">
      <div class="sig-header">DI PERIKSA OLEH,</div>
      <div class="sig-name">( ${officerName} )</div>
      <div class="sig-title">${officerTitle}</div>
      <div class="sig-date">${dateStampText}</div>
    </div>
    <!-- Col I: DI PERIKSA OLEH (Manager/Team Leader) -->
    <div class="sig-box">
      <div class="sig-header">DI PERIKSA OLEH,</div>
      <div class="sig-name">( ${managerName} )</div>
      <div class="sig-title">${managerTitle}</div>
      <div class="sig-date">${dateStampText}</div>
    </div>
    <!-- Col N: DISETUJUI OLEH -->
    <div class="sig-box">
      <div class="sig-header">DISETUJUI OLEH,</div>
      <div class="sig-name">( ${deptHeadName} )</div>
      <div class="sig-title">${deptHeadTitle}</div>
      <div class="sig-date">${dateStampText}</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 300);
    };
  </script>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Mohon izinkan popup untuk mencetak PDF.");
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
}

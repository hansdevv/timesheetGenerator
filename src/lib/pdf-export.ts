"use client";

import type { TimesheetData, SPLData } from "./types";
import { MONTH_NAMES_TITLE } from "./types";

/**
 * Escape HTML special characters for secure rendering in generated print documents.
 */
function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Format a time fraction (Excel-style 0..1) to HH:MM:SS string.
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

const ID_MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function openPrintDocument(html: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Mohon izinkan pop-up pada peramban untuk mencetak atau menyimpan dokumen PDF.");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Export Timesheet as PDF via browser print dialog.
 * 100% mirrors the official Adidata Timesheet template:
 * - Exact column headers: WORKING HOUR (Start, End), STATUS ATTENDANCE (Present, Sick, Business Trip, Permit, Vacation, Not Working), etc.
 * - Column B (Date) ALWAYS filled with gray (#bfbfbf) background!
 * - Weekend / Holiday non-working days completely filled with gray (#bfbfbf) with centered bold label.
 * - Working days: white data cells with bold centered 24h times and status P.
 * - Top header info block mirrors template D2:D6 + holiday legend + status abbreviations legend.
 * - Contiguous 4-party authorization signature block matching Excel layout and column spans.
 * - Full cross-browser print-color-adjust and A4 landscape fit.
 */
export function exportTimesheetPDF(data: TimesheetData): void {
  const { header, rows } = data;
  const monthName = MONTH_NAMES_TITLE[header.month - 1] || "";
  const periodeLabel = `${monthName} ${header.year}`;

  let countP = 0;
  let countS = 0;
  let countBT = 0;
  let countPM = 0;
  let countV = 0;
  let countX = 0;

  const rowsHtml = rows
    .map((row, idx) => {
      const parts = row.date.trim().split("-").map(Number);
      const year = parts[0];
      const monthIdx = (parts[1] || 1) - 1;
      const day = parts[2] || 1;
      const dateObj = new Date(Date.UTC(year, monthIdx, day));
      const dayOfWeek = dateObj.getUTCDay(); // 0=Sun, 5=Fri, 6=Sat

      const dateFormatted = `${day}-${ID_MONTH_ABBR[monthIdx] || "Sep"}-${year}`;

      const isWeekend = row.isWeekend;
      const isHoliday = row.isHoliday || row.status === "H";
      const isPresent = row.status === "P";

      const isWeekendDayOff = isWeekend && !isPresent;
      const isHolidayDayOff = isHoliday && !isPresent;
      const isNonWorking = isWeekendDayOff || isHolidayDayOff;

      const GRAY = "#bfbfbf";
      const WHITE = "#ffffff";
      const rowBg = isNonWorking ? GRAY : WHITE;

      let startHMS = "";
      let endHMS = "";
      let totalHMS = "";
      let colP = "",
        colS = "",
        colBT = "",
        colPM = "",
        colV = "",
        colX = "";
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
        if (row.status === "S") {
          countS++;
          colS = "S";
        } else if (row.status === "BT") {
          countBT++;
          colBT = "BT";
        } else if (row.status === "PM") {
          countPM++;
          colPM = "PM";
        } else if (row.status === "V") {
          countV++;
          colV = "V";
        } else {
          countX++;
          colX = "x";
        }

        activity =
          row.activity ||
          (row.status === "S"
            ? "Sakit"
            : row.status === "V"
              ? "Cuti / Vacation"
              : row.status === "BT"
                ? "Business Trip"
                : row.status === "PM"
                  ? "Permit / Izin"
                  : "");
      }

      const showProjectInfo = isPresent || row.status === "BT";
      const projName = showProjectInfo ? row.projectName || header.projectName || "" : "";
      const projId = showProjectInfo ? row.projectId || header.projectId || "" : "";
      const appBerdampak = showProjectInfo ? row.aplikasiBerdampak || header.aplikasiBerdampak || "" : "";
      const aipFitur = showProjectInfo ? row.aipFitur || header.aipFitur || "" : "";

      const actAlign = isNonWorking ? "text-align:center; font-weight:bold;" : "text-align:left;";

      return `<tr>
        <td class="cell-center" style="background:${rowBg};">${dateFormatted}</td>
        <td class="cell-center ${isPresent ? "bold" : ""}" style="background:${rowBg};">${startHMS}</td>
        <td class="cell-center ${isPresent ? "bold" : ""}" style="background:${rowBg};">${endHMS}</td>
        <td class="cell-center ${isPresent ? "bold" : ""}" style="background:${rowBg};">${totalHMS}</td>
        <td class="cell-center bold" style="background:${rowBg};">${colP}</td>
        <td class="cell-center bold" style="background:${rowBg};">${colS}</td>
        <td class="cell-center bold" style="background:${rowBg};">${colBT}</td>
        <td class="cell-center bold" style="background:${rowBg};">${colPM}</td>
        <td class="cell-center bold" style="background:${rowBg};">${colV}</td>
        <td class="cell-center bold" style="background:${rowBg};">${colX}</td>
        <td colspan="3" class="cell-act" style="background:${rowBg}; ${actAlign}">${escapeHtml(activity)}</td>
        <td class="cell-center cell-ellipsis" style="background:${rowBg};">${escapeHtml(projName)}</td>
        <td class="cell-center" style="background:${rowBg};">${escapeHtml(projId)}</td>
        <td class="cell-center cell-ellipsis" style="background:${rowBg};">${escapeHtml(appBerdampak)}</td>
        <td class="cell-center cell-ellipsis" style="background:${rowBg};">${escapeHtml(aipFitur)}</td>
      </tr>`;
    })
    .join("\n");

  const nextMonth = header.month === 12 ? 1 : header.month + 1;
  const nextYear = header.month === 12 ? header.year + 1 : header.year;
  const defaultDateStamp = `01 ${MONTH_NAMES_TITLE[nextMonth - 1]} ${nextYear}`;
  const dateStampText = `DATE : ${header.dateStamp || defaultDateStamp}`;

  const empName = header.name || "";
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
  <title>Time Sheet ${escapeHtml(periodeLabel)} - ${escapeHtml(header.name || "")}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 5mm 6mm 5mm 6mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: Calibri, "Segoe UI", Arial, Helvetica, sans-serif;
      font-size: 7.2pt;
      line-height: 1.15;
      color: #000;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .no-print {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #1e293b;
      color: #fff;
      padding: 8px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 9999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      font-family: sans-serif;
      font-size: 12px;
    }
    .no-print button {
      border: none;
      padding: 5px 12px;
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
      font-size: 12px;
    }
    .btn-print {
      background: #2563eb;
      color: #fff;
    }
    .btn-close {
      background: #475569;
      color: #fff;
    }

    @media print {
      .no-print {
        display: none !important;
      }
      body {
        margin: 0;
        padding: 0;
      }
    }

    @media screen {
      body {
        padding-top: 48px;
        background: #e2e8f0;
      }
      .sheet-container {
        background: #fff;
        max-width: 297mm;
        margin: 10px auto;
        padding: 6mm 8mm;
        box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      }
    }

    .doc-title {
      text-align: center;
      font-size: 12pt;
      font-weight: 700;
      letter-spacing: 0.8px;
      margin-bottom: 4px;
      text-transform: uppercase;
    }

    /* ── Header Information Block (mirrors D2:D6 + H6:J6 + H7) ── */
    .header-block {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 4px;
    }
    .header-info-table {
      border-collapse: collapse;
      font-size: 7.5pt;
    }
    .header-info-table td {
      padding: 0.5px 2px;
    }
    .hdr-label {
      width: 175px;
      font-weight: 400;
      color: #000;
    }
    .hdr-val {
      font-weight: 700;
      color: #000;
    }
    .header-legend-box {
      text-align: right;
    }
    .holiday-indicator {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 7.5pt;
      font-weight: 400;
      margin-bottom: 2px;
    }
    .holiday-color-box {
      display: inline-block;
      width: 13px;
      height: 10px;
      background: #bfbfbf;
      border: 1px solid #000;
    }
    .legend-text {
      font-size: 6.5pt;
      font-family: Verdana, Calibri, sans-serif;
      color: #000;
    }

    /* ── Data Table (mirrors Cols B–R, Rows 8–41) ── */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .data-table thead th {
      background: #bfbfbf;
      border: 1px solid #000;
      padding: 2px 2px;
      font-size: 6.8pt;
      font-weight: 700;
      text-align: center;
      vertical-align: middle;
      line-height: 1.1;
    }
    .data-table tbody td {
      border: 1px solid #000;
      padding: 1.5px 3px;
      font-size: 6.8pt;
      vertical-align: middle;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .cell-center { text-align: center; }
    .bold { font-weight: 700; }
    .cell-act {
      white-space: normal !important;
      word-break: break-word;
      line-height: 1.15;
      font-size: 6.6pt;
    }
    .cell-ellipsis {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* ── Column Widths (matching template proportions) ── */
    .col-date { width: 56px; }
    .col-time { width: 41px; }
    .col-tot  { width: 43px; }
    .col-stat { width: 20px; }
    .col-proj { width: 115px; }
    .col-pid  { width: 46px; }
    .col-app  { width: 46px; }
    .col-aip  { width: 92px; }

    /* ── Summary & Separator Rows ── */
    .summary-row td {
      font-size: 7.5pt;
      font-weight: 700;
      padding: 2.5px 3px;
      background: #fff;
    }
    .sep-row td {
      height: 4px;
      border: none !important;
      padding: 0;
    }

    /* ── Signature Table (mirrors Rows 42–49) ── */
    .sig-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 2px;
      table-layout: fixed;
    }
    .sig-table td {
      border: 1px solid #000;
      padding: 2px 4px;
      vertical-align: middle;
    }
    .sig-hdr {
      font-size: 7.5pt;
      font-weight: 700;
      text-align: left;
      height: 15px;
    }
    .sig-box-cell {
      height: 52px;
      text-align: center;
      vertical-align: bottom;
      padding-bottom: 3px;
      font-weight: 700;
      font-size: 7.5pt;
    }
    .sig-role-cell {
      text-align: center;
      font-weight: 700;
      font-size: 7.8pt;
      height: 16px;
    }
    .sig-date-cell {
      text-align: center;
      font-size: 6.8pt;
      height: 14px;
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div class="no-print">
    <div>
      <strong>Pratinjau Cetak / PDF Resmi Adidata</strong> &bull; Pastikan ukuran kertas <strong>A4 Landscape</strong> dan opsi <strong>Background graphics</strong> aktif.
    </div>
    <div style="display:flex; gap:8px;">
      <button class="btn-print" onclick="window.print()">Cetak / Simpan PDF</button>
      <button class="btn-close" onclick="window.close()">Tutup</button>
    </div>
  </div>

  <div class="sheet-container">
    <div class="doc-title">TIME SHEET</div>

    <!-- Header info block -->
    <div class="header-block">
      <table class="header-info-table">
        <tr>
          <td class="hdr-label">NAME of PROJECT</td>
          <td class="hdr-val">:  ${escapeHtml(header.projectName || "")}</td>
        </tr>
        <tr>
          <td class="hdr-label">DEPARTMENT / DIVISION</td>
          <td class="hdr-val">:  ${escapeHtml(header.department || "")}</td>
        </tr>
        <tr>
          <td class="hdr-label">NAME</td>
          <td class="hdr-val">:  ${escapeHtml(header.name || "")}</td>
        </tr>
        <tr>
          <td class="hdr-label">NPP</td>
          <td class="hdr-val">:  ${escapeHtml(header.npp || "")}</td>
        </tr>
        <tr>
          <td class="hdr-label">PERIODE</td>
          <td class="hdr-val">:  ${escapeHtml(periodeLabel)}</td>
        </tr>
      </table>

      <div class="header-legend-box">
        <div class="holiday-indicator">
          <span class="holiday-color-box"></span>
          <span>: Holiday</span>
        </div>
        <div class="legend-text">
          P = Present; S = Sick; &nbsp;V = Vacation; BT = Business Trip; PM = Permit; X = Not Working Anymore
        </div>
      </div>
    </div>

    <!-- Timesheet Table -->
    <table class="data-table">
      <thead>
        <tr>
          <th class="col-date" rowspan="2">Date</th>
          <th colspan="2">WORKING HOUR</th>
          <th class="col-tot" rowspan="2">TOTAL HOUR</th>
          <th colspan="6">STATUS  ATTENDANCE </th>
          <th colspan="3" rowspan="2">ACTIVITY / REMARK</th>
          <th class="col-proj" rowspan="2">Project Name</th>
          <th class="col-pid" rowspan="2">Project ID</th>
          <th class="col-app" rowspan="2">Aplikasi Berdampak</th>
          <th class="col-aip" rowspan="2">AIP Fitur</th>
        </tr>
        <tr>
          <th class="col-time">START</th>
          <th class="col-time">END</th>
          <th class="col-stat">Present</th>
          <th class="col-stat">Sick</th>
          <th class="col-stat">Business Trip</th>
          <th class="col-stat">Permit</th>
          <th class="col-stat">Vacation</th>
          <th class="col-stat">Not Working</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <!-- Summary Row (mirrors Row 40 of sample) -->
        <tr class="summary-row">
          <td colspan="4" style="border:1px solid #000;"></td>
          <td class="cell-center bold">${countP}</td>
          <td class="cell-center bold">${countS || ""}</td>
          <td class="cell-center bold">${countBT || ""}</td>
          <td class="cell-center bold">${countPM || ""}</td>
          <td class="cell-center bold">${countV || ""}</td>
          <td class="cell-center bold">${countX || ""}</td>
          <td colspan="3" style="border:1px solid #000;"></td>
          <td style="border:1px solid #000;"></td>
          <td style="border:1px solid #000;"></td>
          <td style="border:1px solid #000;"></td>
          <td style="border:1px solid #000;"></td>
        </tr>
        <!-- Separator Row (mirrors Row 41 of sample) -->
        <tr class="sep-row">
          <td colspan="17"></td>
        </tr>
      </tbody>
    </table>

    <!-- Signature Table (mirrors Rows 42–49) -->
    <table class="sig-table">
      <tr>
        <td class="sig-hdr" style="width: 23%;">TTD PEGAWAI,</td>
        <td class="sig-hdr" colspan="2" style="width: 55%;">DI PERIKSA OLEH,</td>
        <td class="sig-hdr" style="width: 22%;">DISETUJUI OLEH,</td>
      </tr>
      <tr>
        <td class="sig-box-cell" style="width: 23%;"> (   ${escapeHtml(empName)}   )</td>
        <td class="sig-box-cell" style="width: 27%;">(   ${escapeHtml(officerName)}   )</td>
        <td class="sig-box-cell" style="width: 28%;">(   ${escapeHtml(managerName)}   )</td>
        <td class="sig-box-cell" style="width: 22%;">(  ${escapeHtml(deptHeadName)}  )</td>
      </tr>
      <tr>
        <td class="sig-role-cell">${escapeHtml(employeeTitle)}</td>
        <td class="sig-role-cell">${escapeHtml(officerTitle)}</td>
        <td class="sig-role-cell">${escapeHtml(managerTitle)}</td>
        <td class="sig-role-cell">${escapeHtml(deptHeadTitle)}</td>
      </tr>
      <tr>
        <td class="sig-date-cell">${escapeHtml(dateStampText)}</td>
        <td class="sig-date-cell">${escapeHtml(dateStampText)}</td>
        <td class="sig-date-cell">${escapeHtml(dateStampText)}</td>
        <td class="sig-date-cell">${escapeHtml(dateStampText)}</td>
      </tr>
    </table>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 350);
    };
  </script>
</body>
</html>`;

  openPrintDocument(html);
}

/**
 * Export Surat Perintah Lembur (SPL) as PDF via browser print dialog.
 * 100% mirrors the official Adidata SPL template:
 * - A4 Portrait layout
 * - Exact headers: No | Tanggal | Mulai | Akhir | Total Jam | Tugas yang di Kerjakan
 * - Total Keseluruhan Jam Lembur summary row
 * - 3-party authorization signature block matching sample_Surat_Perintah_Lembur_Mohamad Burhanudin_tgl_12.xlsx
 */
export function exportSPLPDF(data: SPLData): void {
  const entries = data.entries && data.entries.length > 0 ? data.entries : [];

  let totalSecSum = 0;

  const rowsHtml = entries
    .map((entry, idx) => {
      const fracStart = parseTimeToFrac(entry.startTime);
      const fracEnd = parseTimeToFrac(entry.endTime);
      const netFrac = fracStart != null && fracEnd != null ? Math.max(0, fracEnd - fracStart - 1 / 24) : 0;
      totalSecSum += Math.round(netFrac * 86400);

      const startHMS = fracStart != null ? fracToHMS(fracStart) : entry.startTime || "";
      const endHMS = fracEnd != null ? fracToHMS(fracEnd) : entry.endTime || "";
      const totalHMS = fracToHMS(netFrac);

      // Date formatted mm/dd/yyyy
      let dateFormatted = entry.date;
      if (entry.date && entry.date.includes("-")) {
        const parts = entry.date.split("-");
        if (parts.length === 3) {
          dateFormatted = `${parts[1]}/${parts[2]}/${parts[0]}`;
        }
      }

      return `<tr>
        <td class="cell-center" style="width:36px;">${entry.no || idx + 1}</td>
        <td class="cell-center" style="width:84px;">${dateFormatted}</td>
        <td class="cell-center" style="width:70px;">${startHMS}</td>
        <td class="cell-center" style="width:70px;">${endHMS}</td>
        <td class="cell-center bold" style="width:76px;">${totalHMS}</td>
        <td class="cell-task">${escapeHtml(entry.tasks || "")}</td>
      </tr>`;
    })
    .join("\n");

  const totH = Math.floor(totalSecSum / 3600);
  const totM = Math.floor((totalSecSum % 3600) / 60);
  const totS = totalSecSum % 60;
  const grandTotalHMS = `${String(totH).padStart(2, "0")}:${String(totM).padStart(2, "0")}:${String(totS).padStart(2, "0")}`;

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Surat Perintah Lembur - ${escapeHtml(data.name || "")}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: Calibri, "Segoe UI", Arial, Helvetica, sans-serif;
      font-size: 10pt;
      line-height: 1.25;
      color: #000;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .no-print {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #1e293b;
      color: #fff;
      padding: 8px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 9999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      font-family: sans-serif;
      font-size: 12px;
    }
    .no-print button {
      border: none;
      padding: 5px 12px;
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
      font-size: 12px;
    }
    .btn-print { background: #2563eb; color: #fff; }
    .btn-close { background: #475569; color: #fff; }

    @media print {
      .no-print { display: none !important; }
      body { margin: 0; padding: 0; }
    }

    @media screen {
      body {
        padding-top: 48px;
        background: #e2e8f0;
      }
      .sheet-container {
        background: #fff;
        max-width: 210mm;
        margin: 15px auto;
        padding: 14mm 16mm;
        box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      }
    }

    .doc-title {
      text-align: center;
      font-size: 14pt;
      font-weight: 700;
      letter-spacing: 1px;
      margin-bottom: 24px;
      text-transform: uppercase;
    }

    /* ── Header information block (mirrors C7:C10) ── */
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
      font-size: 10pt;
      font-weight: 700;
    }
    .info-table td {
      padding: 2.5px 0;
    }
    .info-label {
      width: 230px;
    }

    .section-title {
      font-size: 10pt;
      font-weight: 700;
      margin-bottom: 6px;
    }

    /* ── SPL Table (mirrors rows 14–16) ── */
    .spl-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 40px;
      font-size: 9.5pt;
    }
    .spl-table thead th {
      border: 1px solid #000;
      padding: 5px 4px;
      font-weight: 700;
      text-align: center;
      background: #f8fafc;
    }
    .spl-table tbody td {
      border: 1px solid #000;
      padding: 5px 6px;
      vertical-align: middle;
    }
    .cell-center { text-align: center; }
    .bold { font-weight: 700; }
    .cell-task {
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 9pt;
      line-height: 1.3;
    }

    /* ── Signatures Table (mirrors rows 24–25) ── */
    .sig-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 9.5pt;
      font-weight: 700;
    }
    .sig-table td {
      text-align: center;
      padding: 4px;
    }
    .sig-space {
      height: 70px;
      vertical-align: bottom;
      padding-bottom: 4px;
    }
    .sig-role {
      vertical-align: top;
      font-size: 9.5pt;
    }
  </style>
</head>
<body>
  <div class="no-print">
    <div>
      <strong>Pratinjau Surat Perintah Lembur (SPL)</strong> &bull; Pastikan ukuran kertas <strong>A4 Portrait</strong>.
    </div>
    <div style="display:flex; gap:8px;">
      <button class="btn-print" onclick="window.print()">Cetak / Simpan PDF</button>
      <button class="btn-close" onclick="window.close()">Tutup</button>
    </div>
  </div>

  <div class="sheet-container">
    <div class="doc-title">SURAT PERINTAH LEMBUR</div>

    <table class="info-table">
      <tr>
        <td class="info-label">NPP</td>
        <td>:  ${escapeHtml(data.npp || "")}</td>
      </tr>
      <tr>
        <td class="info-label">NAMA</td>
        <td>:  ${escapeHtml(data.name || "")}</td>
      </tr>
      <tr>
        <td class="info-label">DEPARTEMENT / DIVISI</td>
        <td>:  ${escapeHtml(data.department || "")}</td>
      </tr>
      <tr>
        <td class="info-label">POSISI</td>
        <td>:  ${escapeHtml(data.position || "Developer")}</td>
      </tr>
    </table>

    <div class="section-title">TUGAS YANG DIKERJAKAN</div>

    <table class="spl-table">
      <thead>
        <tr>
          <th>No</th>
          <th>Tanggal</th>
          <th>Mulai</th>
          <th>Akhir</th>
          <th>Total Jam</th>
          <th>Tugas yang di Kerjakan</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr>
          <td colspan="4" class="cell-center bold" style="padding:6px;">Total Keseluruhan Jam Lembur</td>
          <td class="cell-center bold">${grandTotalHMS}</td>
          <td></td>
        </tr>
      </tbody>
    </table>

    <table class="sig-table">
      <tr>
        <td class="sig-space" style="width: 33.3%;">(  ${escapeHtml(data.name || "")}  )</td>
        <td class="sig-space" style="width: 33.3%;">(  ${escapeHtml(data.teamLeaderName || "Gita Kartika")}  )</td>
        <td class="sig-space" style="width: 33.4%;">(  ${escapeHtml(data.deptHeadName || "Adhy Perdhana")}  )</td>
      </tr>
      <tr>
        <td class="sig-role">${escapeHtml(data.position || "Developer")}</td>
        <td class="sig-role">${escapeHtml(data.teamLeaderTitle || "Pgs. Team Leader")}</td>
        <td class="sig-role">${escapeHtml(data.deptHeadTitle || "Department Head")}</td>
      </tr>
    </table>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 350);
    };
  </script>
</body>
</html>`;

  openPrintDocument(html);
}

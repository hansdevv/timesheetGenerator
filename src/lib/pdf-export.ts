"use client";

import type { TimesheetData, SPLData } from "./types";
import type { IzinData } from "./schemas";
import { MONTH_NAMES_TITLE } from "./types";
import { formatDateId, formatIzinDateRange } from "./calc";

function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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

function getAssetUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${base}${path}`;
}

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

export function exportTimesheetPDF(data: TimesheetData): void {
  const { header, rows } = data;
  const monthName = MONTH_NAMES_TITLE[header.month - 1] || "";
  const periodeLabel = `${monthName} ${header.year}`;
  const logoUrl = getAssetUrl("/images/adidata-logo.png");
  const sigUrl = header.signatureDataUrl || getAssetUrl("/images/default-signature.png");

  let countP = 0;
  let countS = 0;
  let countBT = 0;
  let countPM = 0;
  let countV = 0;
  let countX = 0;

  const rowsHtml = rows
    .map((row) => {
      const parts = row.date.trim().split("-").map(Number);
      const year = parts[0];
      const monthIdx = (parts[1] || 1) - 1;
      const day = parts[2] || 1;
      const dateObj = new Date(Date.UTC(year, monthIdx, day));
      const dayOfWeek = dateObj.getUTCDay();

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
  const safeName = (header.name || "Pegawai").replace(/\s+/g, " ");
  const pdfTitle = `Time Sheet ${periodeLabel}_${header.npp || "NPP"}_${safeName}`;

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(pdfTitle)}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 5mm 6mm 5mm 6mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
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
      position: fixed; top: 0; left: 0; right: 0;
      background: #0f172a; color: #fff; padding: 8px 16px;
      display: flex; justify-content: space-between; align-items: center;
      z-index: 9999; box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      font-family: sans-serif; font-size: 12px;
    }
    .no-print button {
      border: none; padding: 5px 12px; border-radius: 4px;
      font-weight: 600; cursor: pointer; font-size: 12px;
    }
    .btn-print { background: #dc2626; color: #fff; }
    .btn-close { background: #475569; color: #fff; }
    @media print {
      .no-print { display: none !important; }
      body { margin: 0; padding: 0; }
    }
    @media screen {
      body { padding-top: 48px; background: #e2e8f0; }
      .sheet-container {
        background: #fff; max-width: 297mm; margin: 10px auto;
        padding: 6mm 8mm; box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      }
    }
    .header-block {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 4px; position: relative;
    }
    .header-info-table { border-collapse: collapse; font-size: 7.5pt; }
    .header-info-table td { padding: 1px 2px; }
    .hdr-label { width: 145px; font-weight: 400; color: #000; }
    .hdr-val { font-weight: 700; color: #000; }
    .header-right-col { display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; }
    .logo-img { height: 36px; width: auto; object-fit: contain; margin-bottom: 4px; }
    .legend-row { display: flex; align-items: center; justify-content: space-between; width: 100%; margin-bottom: 3px; }
    .holiday-indicator { display: inline-flex; align-items: center; gap: 5px; font-size: 7.5pt; }
    .holiday-color-box { display: inline-block; width: 28px; height: 12px; background: #bfbfbf; border: 1px solid #888; }
    .legend-text { font-size: 6.8pt; font-family: Verdana, Calibri, sans-serif; color: #000; }
    .data-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .data-table thead th {
      background: #d9d9d9; border: 1px solid #000; padding: 2px 2px;
      font-size: 6.8pt; font-weight: 700; text-align: center; vertical-align: middle; line-height: 1.1;
    }
    .data-table tbody td {
      border: 1px solid #000; padding: 1.5px 3px; font-size: 6.8pt;
      vertical-align: middle; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .cell-center { text-align: center; }
    .bold { font-weight: 700; }
    .cell-act { white-space: normal !important; word-break: break-word; line-height: 1.15; font-size: 6.6pt; }
    .cell-ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .col-date { width: 56px; }
    .col-time { width: 41px; }
    .col-tot  { width: 43px; }
    .col-stat { width: 22px; }
    .col-proj { width: 135px; }
    .col-pid  { width: 46px; }
    .col-app  { width: 48px; }
    .col-aip  { width: 92px; }
    .summary-row td { font-size: 8pt; font-weight: 700; padding: 2.5px 3px; background: #fff; }
    .sep-row td { height: 4px; border: none !important; padding: 0; }
    .sig-table { width: 65%; border-collapse: collapse; margin-top: 2px; table-layout: fixed; }
    .sig-table td { border: 1px solid #000; padding: 2px 4px; vertical-align: middle; }
    .sig-hdr { font-size: 7pt; font-weight: 700; text-align: center; height: 14px; }
    .sig-box-cell {
      height: 54px; text-align: center; vertical-align: bottom;
      padding-bottom: 3px; font-weight: 700; font-size: 7.5pt; position: relative;
    }
    .sig-img { max-height: 38px; max-width: 90px; object-fit: contain; display: block; margin: 0 auto 2px; }
    .sig-role-cell { text-align: center; font-weight: 700; font-size: 7.8pt; height: 15px; }
    .sig-date-cell { text-align: center; font-size: 6.8pt; height: 14px; white-space: nowrap; }
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

      <div class="header-right-col">
        <img src="${logoUrl}" alt="ADIDATA" class="logo-img" />
      </div>
    </div>

    <div class="legend-row">
      <div style="margin-left: 240px;" class="holiday-indicator">
        <span class="holiday-color-box"></span>
        <span>: Holiday</span>
      </div>
      <div class="legend-text" style="margin-right: 180px;">
        P = Present; S = Sick; &nbsp;V = Vacation; BT = Business Trip; PM = Permit; X = Not Working Anymore
      </div>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th class="col-date" rowspan="2">DATE</th>
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
        <tr class="summary-row">
          <td colspan="4" style="border:1px solid #000;"></td>
          <td class="cell-center bold">${countP}</td>
          <td class="cell-center bold">${countS || 0}</td>
          <td class="cell-center bold">${countBT || 0}</td>
          <td class="cell-center bold">${countPM || 0}</td>
          <td class="cell-center bold">${countV || 0}</td>
          <td class="cell-center bold">${countX || 0}</td>
          <td colspan="3" style="border:1px solid #000;"></td>
          <td style="border:1px solid #000;"></td>
          <td style="border:1px solid #000;"></td>
          <td style="border:1px solid #000;"></td>
          <td style="border:1px solid #000;"></td>
        </tr>
        <tr class="sep-row">
          <td colspan="17"></td>
        </tr>
      </tbody>
    </table>

    <table class="sig-table">
      <tr>
        <td class="sig-hdr" style="width: 24%;">TTD PEGAWAI,</td>
        <td class="sig-hdr" colspan="2" style="width: 48%;">DI PERIKSA OLEH,</td>
        <td class="sig-hdr" style="width: 28%;">DISETUJUI OLEH,</td>
      </tr>
      <tr>
        <td class="sig-box-cell">
          <img src="${sigUrl}" alt="TTD" class="sig-img" />
          (   ${escapeHtml(empName)}   )
        </td>
        <td class="sig-box-cell">(   ${escapeHtml(officerName)}   )</td>
        <td class="sig-box-cell">(   ${escapeHtml(managerName)}   )</td>
        <td class="sig-box-cell">(  ${escapeHtml(deptHeadName)}  )</td>
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

export function exportSPLPDF(data: SPLData): void {
  const entries = data.entries && data.entries.length > 0 ? data.entries : [];
  const logoUrl = getAssetUrl("/images/adidata-logo.png");
  const sigUrl = data.signatureDataUrl || getAssetUrl("/images/default-signature.png");

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

      let dateFormatted = entry.date;
      if (entry.date && entry.date.includes("-")) {
        const parts = entry.date.split("-");
        if (parts.length === 3) {
          dateFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }

      return `<tr>
        <td class="cell-center" style="width:36px;">${entry.no || idx + 1}</td>
        <td class="cell-center" style="width:95px;">${dateFormatted}</td>
        <td class="cell-center" style="width:76px;">${startHMS}</td>
        <td class="cell-center" style="width:76px;">${endHMS}</td>
        <td class="cell-center" style="width:76px;">${totalHMS}</td>
        <td class="cell-task">${escapeHtml(entry.tasks || "")}</td>
      </tr>`;
    })
    .join("\n");

  const totH = Math.floor(totalSecSum / 3600);
  const totM = Math.floor((totalSecSum % 3600) / 60);
  const totS = totalSecSum % 60;
  const grandTotalHMS = `${totH}:${String(totM).padStart(2, "0")}:${String(totS).padStart(2, "0")}`;

  const firstEntryDate = entries[0]?.date || "";
  const formattedPeriod = firstEntryDate ? formatDateId(firstEntryDate) : "Lembur";
  const safeName = (data.name || "Pegawai").replace(/\s+/g, " ");
  const pdfTitle = `Surat Perintah Lembur_${formattedPeriod}_${data.npp || "NPP"}_${safeName}`;

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(pdfTitle)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 14mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Calibri, "Segoe UI", Arial, Helvetica, sans-serif;
      font-size: 10pt; line-height: 1.25; color: #000; background: #fff;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .no-print {
      position: fixed; top: 0; left: 0; right: 0;
      background: #0f172a; color: #fff; padding: 8px 16px;
      display: flex; justify-content: space-between; align-items: center;
      z-index: 9999; box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      font-family: sans-serif; font-size: 12px;
    }
    .no-print button {
      border: none; padding: 5px 12px; border-radius: 4px;
      font-weight: 600; cursor: pointer; font-size: 12px;
    }
    .btn-print { background: #dc2626; color: #fff; }
    .btn-close { background: #475569; color: #fff; }
    @media print { .no-print { display: none !important; } body { margin: 0; padding: 0; } }
    @media screen {
      body { padding-top: 48px; background: #e2e8f0; }
      .sheet-container {
        background: #fff; max-width: 210mm; margin: 15px auto;
        padding: 12mm 14mm; box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      }
    }
    .outer-frame {
      border: 1.5px solid #000;
      padding: 18px 20px 16px;
      position: relative;
    }
    .doc-title {
      text-align: center; font-size: 13pt; font-weight: 700;
      text-decoration: underline; margin-bottom: 22px; text-transform: uppercase;
    }
    .top-row {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 16px;
    }
    .info-table { border-collapse: collapse; font-size: 10pt; font-weight: 700; }
    .info-table td { padding: 2px 0; }
    .info-label { width: 165px; }
    .logo-img { width: 150px; height: auto; object-fit: contain; margin-top: -4px; }
    .section-title {
      text-align: center; font-size: 10.5pt; font-weight: 700;
      margin-bottom: 10px; text-transform: uppercase;
    }
    .spl-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 9.5pt; }
    .spl-table thead th {
      border: 1px solid #000; padding: 4px 4px; font-weight: 700; text-align: center;
    }
    .spl-table tbody td {
      border: 1px solid #000; padding: 6px 6px; vertical-align: middle;
    }
    .cell-center { text-align: center; }
    .bold { font-weight: 700; }
    .cell-task { white-space: pre-wrap; word-break: break-word; font-size: 9.5pt; line-height: 1.3; }
    .sig-grid {
      display: flex; justify-content: space-between; align-items: flex-start; gap: 22px;
      margin-top: 6px;
    }
    .sig-col { flex: 1; text-align: center; }
    .sig-box {
      border: 1px solid #000; height: 92px;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 4px;
    }
    .sig-img { max-height: 76px; max-width: 130px; object-fit: contain; }
    .sig-name { font-weight: 700; font-size: 10pt; line-height: 1.25; }
    .sig-role { font-weight: 700; font-size: 10pt; line-height: 1.25; }
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
    <div class="outer-frame">
      <div class="doc-title">SURAT PERINTAH LEMBUR</div>

      <div class="top-row">
        <table class="info-table">
          <tr>
            <td class="info-label">NPP</td>
            <td>: ${escapeHtml(data.npp || "")}</td>
          </tr>
          <tr>
            <td class="info-label">NAMA</td>
            <td>: ${escapeHtml(data.name || "")}</td>
          </tr>
          <tr>
            <td class="info-label">DEPARTEMENT / DIVISI</td>
            <td>: ${escapeHtml(data.department || "")}</td>
          </tr>
          <tr>
            <td class="info-label">POSISI</td>
            <td>: ${escapeHtml(data.position || "Developer")}</td>
          </tr>
        </table>
        <img src="${logoUrl}" alt="ADIDATA" class="logo-img" />
      </div>

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
            <td colspan="4" style="padding:4px 6px;">Total Keseluruhan Jam Lembur</td>
            <td class="cell-center">${grandTotalHMS}</td>
            <td style="border:none;"></td>
          </tr>
        </tbody>
      </table>

      <div class="sig-grid">
        <div class="sig-col">
          <div class="sig-box">
            <img src="${sigUrl}" alt="TTD" class="sig-img" />
          </div>
          <div class="sig-name">( ${escapeHtml(data.name || "")} )</div>
          <div class="sig-role">${escapeHtml(data.position || "Developer")}</div>
        </div>
        <div class="sig-col">
          <div class="sig-box"></div>
          <div class="sig-name">( ${escapeHtml(data.teamLeaderName || "Gita Kartika")} )</div>
          <div class="sig-role">${escapeHtml(data.teamLeaderTitle || "Pgs. Team Leader")}</div>
        </div>
        <div class="sig-col">
          <div class="sig-box"></div>
          <div class="sig-name">( ${escapeHtml(data.deptHeadName || "Adhy Perdhana")} )</div>
          <div class="sig-role">${escapeHtml(data.deptHeadTitle || "Department Head")}</div>
        </div>
      </div>
    </div>
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
 * Export Surat Permohonan Izin as PDF via browser print dialog.
 * Mirrors `sample Permohonan Izin_06 November 2026_901513_Mohamad Burhanudin.xlsx` 100%.
 */
export function exportIzinPDF(data: IzinData): void {
  const logoUrl = getAssetUrl("/images/adidata-logo-izin.png");
  const sigUrl = data.signatureDataUrl || getAssetUrl("/images/default-signature.png");
  const subDateFormatted = formatDateId(data.submissionDate);
  const { dayLabel, dateLabel } = formatIzinDateRange(data.startDate, data.endDate);
  const safeName = (data.name || "Pegawai").replace(/\s+/g, " ");
  const periodeStr = formatDateId(data.startDate || data.submissionDate);
  const pdfTitle = `Permohonan Izin_${periodeStr}_${data.npp || "NPP"}_${safeName}`;

  const chkPulang = data.izinType === "pulang_awal" ? "√" : "";
  const chkTerlambat = data.izinType === "datang_terlambat" ? "√" : "";
  const chkCuti = data.izinType === "cuti" ? "√" : "";
  const chkLain = data.izinType === "lain_lain" ? "√" : "";
  const lainLabel = data.izinType === "lain_lain" && data.customIzinLabel ? data.customIzinLabel : "Lain - Lain";

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(pdfTitle)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 14mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10.5pt; line-height: 1.3; color: #000; background: #fff;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .no-print {
      position: fixed; top: 0; left: 0; right: 0;
      background: #0f172a; color: #fff; padding: 8px 16px;
      display: flex; justify-content: space-between; align-items: center;
      z-index: 9999; box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      font-family: sans-serif; font-size: 12px;
    }
    .no-print button {
      border: none; padding: 5px 12px; border-radius: 4px;
      font-weight: 600; cursor: pointer; font-size: 12px;
    }
    .btn-print { background: #dc2626; color: #fff; }
    .btn-close { background: #475569; color: #fff; }
    @media print { .no-print { display: none !important; } body { margin: 0; padding: 0; } }
    @media screen {
      body { padding-top: 48px; background: #e2e8f0; }
      .sheet-container {
        background: #fff; max-width: 210mm; margin: 15px auto;
        padding: 12mm 14mm; box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      }
    }
    .izin-frame {
      border: 2px solid #000;
      padding: 14px 18px 16px;
    }
    .top-bar {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 12px;
    }
    .logo-img { width: 190px; height: auto; object-fit: contain; }
    .place-date { font-size: 10.5pt; padding-right: 16px; }
    .main-title {
      text-align: center; font-size: 16pt; font-weight: 700;
      margin: 10px 0 14px; letter-spacing: 0.5px;
    }
    .ident-row {
      display: flex; justify-content: space-between; gap: 24px;
      margin-bottom: 16px;
    }
    .ident-box {
      display: flex; border: 2px solid #000; height: 38px;
    }
    .ident-label {
      width: 95px; border-right: 2px solid #000;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 10.5pt;
    }
    .ident-val {
      min-width: 215px; padding: 0 12px;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 10.5pt;
    }
    .sub-title {
      text-align: center; font-size: 13pt; font-weight: 400;
      margin-bottom: 12px;
    }
    .type-row {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 18px; padding: 0 4px;
    }
    .type-item {
      display: flex; align-items: center; gap: 8px; font-size: 10.5pt;
    }
    .chk-box {
      width: 28px; height: 22px; border: 2px solid #000;
      display: inline-flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 12pt;
    }
    .detail-lines {
      display: flex; flex-direction: column; gap: 12px;
      margin-bottom: 22px; padding: 0 4px; font-size: 10.5pt;
    }
    .line-split {
      display: grid; grid-template-columns: 1.1fr 1.4fr 0.9fr; gap: 10px;
    }
    .sig-row {
      display: grid; grid-template-columns: 1fr 1.2fr 1fr; gap: 22px;
      margin-top: 8px;
    }
    .sig-box { border: 2px solid #000; text-align: center; }
    .sig-hdr {
      border-bottom: 2px solid #000; padding: 4px;
      font-weight: 700; font-size: 10.5pt;
    }
    .sig-body {
      height: 82px; display: flex; flex-direction: column;
      align-items: center; justify-content: flex-end; padding-bottom: 6px;
      position: relative; font-size: 9.5pt;
    }
    .sig-img { max-height: 68px; max-width: 110px; object-fit: contain; margin: auto; }
    .sig-ftr {
      border-top: 2px solid #000; padding: 4px;
      font-size: 10.5pt; min-height: 26px;
    }
    .bottom-strip {
      display: grid; grid-template-columns: 1fr 1fr;
      border-left: 2px solid #000; border-right: 2px solid #000; border-bottom: 2px solid #000;
      height: 20px; margin-top: 4px;
    }
    .bottom-strip div:first-child { border-right: 2px solid #000; }
  </style>
</head>
<body>
  <div class="no-print">
    <div>
      <strong>Pratinjau Surat Permohonan Izin Resmi Adidata</strong> &bull; Pastikan ukuran kertas <strong>A4 Portrait</strong>.
    </div>
    <div style="display:flex; gap:8px;">
      <button class="btn-print" onclick="window.print()">Cetak / Simpan PDF</button>
      <button class="btn-close" onclick="window.close()">Tutup</button>
    </div>
  </div>

  <div class="sheet-container">
    <div class="izin-frame">
      <div class="top-bar">
        <img src="${logoUrl}" alt="ADIDATA" class="logo-img" />
        <div class="place-date">${escapeHtml(data.city || "Jakarta")}, ${escapeHtml(subDateFormatted)}</div>
      </div>

      <div class="main-title">PERMOHONAN IZIN</div>

      <div class="ident-row">
        <div class="ident-box" style="flex: 1.15;">
          <div class="ident-label">NAMA</div>
          <div class="ident-val" style="flex:1;">${escapeHtml(data.name || "")}</div>
        </div>
        <div class="ident-box" style="flex: 1;">
          <div class="ident-label">BAGIAN</div>
          <div class="ident-val" style="flex:1;">${escapeHtml(data.department || "")}</div>
        </div>
      </div>

      <div class="sub-title">JENIS PERMOHONAN IZIN</div>

      <div class="type-row">
        <div class="type-item">
          <span class="chk-box">${chkPulang}</span>
          <span>Pulang Lebih Awal</span>
        </div>
        <div class="type-item">
          <span class="chk-box">${chkTerlambat}</span>
          <span>Datang Terlambat</span>
        </div>
        <div class="type-item">
          <span class="chk-box">${chkCuti}</span>
          <span>Cuti</span>
        </div>
        <div class="type-item">
          <span class="chk-box">${chkLain}</span>
          <span>${escapeHtml(lainLabel)}</span>
        </div>
      </div>

      <div class="detail-lines">
        <div class="line-split">
          <div>Hari &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: &nbsp;${escapeHtml(dayLabel)}</div>
          <div>Tanggal : &nbsp;${escapeHtml(dateLabel)}</div>
          <div>Jam : ${escapeHtml(data.timeRange || "-")}</div>
        </div>
        <div>Untuk Keperluan &nbsp;: ${escapeHtml(data.reason || "")}</div>
        <div>Catatan &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: &nbsp;${escapeHtml(data.notes || "")}</div>
      </div>

      <div class="sig-row">
        <div class="sig-box">
          <div class="sig-hdr">PEMOHON</div>
          <div class="sig-body">
            <img src="${sigUrl}" alt="TTD Pemohon" class="sig-img" />
          </div>
          <div class="sig-ftr">${escapeHtml(data.name || "")}</div>
        </div>

        <div class="sig-box">
          <div class="sig-hdr">DISETUJUI</div>
          <div class="sig-body">
            <span>${escapeHtml(data.supervisorTitle || "Pgs. Team Leader")}</span>
          </div>
          <div class="sig-ftr">${escapeHtml(data.supervisorName || "Gita Kartika")}</div>
        </div>

        <div class="sig-box">
          <div class="sig-hdr">DISETUJUI</div>
          <div class="sig-body">
            <span>${escapeHtml(data.approverTitle || "Department Head")}</span>
          </div>
          <div class="sig-ftr">${escapeHtml(data.approverName || "Adhy Perdhana")}</div>
        </div>
      </div>
    </div>
    <div class="bottom-strip">
      <div></div>
      <div></div>
    </div>
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

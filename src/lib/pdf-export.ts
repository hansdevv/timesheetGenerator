"use client";

import type { TimesheetData } from "./types";
import { MONTH_NAMES_EN } from "./types";

/**
 * Export timesheet as PDF via browser print dialog.
 * Renders a full HTML document with a clean printable layout.
 */
export function exportTimesheetPDF(data: TimesheetData): void {
  const { header, rows } = data;
  const periodeLabel = `${MONTH_NAMES_EN[header.month - 1]} ${header.year}`;

  const statusColors: Record<string, string> = {
    P: "#10b981",
    S: "#ef4444",
    V: "#06b6d4",
    BT: "#f59e0b",
    PM: "#a855f7",
    X: "#64748b",
    H: "#ec4899",
  };

  const statusBg: Record<string, string> = {
    P: "#d1fae5",
    S: "#fee2e2",
    V: "#cffafe",
    BT: "#fef3c7",
    PM: "#ede9fe",
    X: "#f1f5f9",
    H: "#fce7f3",
  };

  const rowsHtml = rows
    .map((row, idx) => {
      const isWeekend = row.isWeekend;
      const isHoliday = row.isHoliday || row.status === "H";
      const rowBg = isHoliday ? "#f5f3ff" : isWeekend ? "#f8fafc" : "#ffffff";
      const textColor = isWeekend ? "#94a3b8" : "#1e293b";
      const d = new Date(row.date);
      const dayNum = d.getDate();

      return `<tr style="background:${rowBg}; color:${textColor};">
        <td style="text-align:center; color:#94a3b8; font-size:9pt;">${idx + 1}</td>
        <td style="text-align:center; font-weight:600; font-family:monospace;">${String(dayNum).padStart(2, "0")}</td>
        <td style="color:${isWeekend ? "#94a3b8" : "#475569"};">${row.dayName}</td>
        <td style="text-align:center; font-family:monospace;">${row.startTime || "-"}</td>
        <td style="text-align:center; font-family:monospace;">${row.endTime || "-"}</td>
        <td style="text-align:center; font-weight:700; font-family:monospace;">${row.totalHours > 0 ? row.totalHours : "-"}</td>
        <td style="text-align:center;">
          <span style="background:${statusBg[row.status] || "#f1f5f9"}; color:${statusColors[row.status] || "#64748b"}; padding:2px 8px; border-radius:100px; font-size:8pt; font-weight:700; white-space:nowrap;">
            ${row.status}
          </span>
        </td>
        <td style="font-size:8.5pt; color:${isWeekend ? "#94a3b8" : "#334155"};">${row.activity || (isWeekend ? "Weekend" : "")}</td>
        <td style="font-size:8.5pt; color:#475569;">${row.projectName || "-"}</td>
        <td style="font-size:8.5pt; color:#475569; font-family:monospace;">${row.projectId || "-"}</td>
      </tr>`;
    })
    .join("\n");

  const totalHours = rows.reduce((s, r) => s + (r.totalHours || 0), 0);
  const presentDays = rows.filter((r) => r.status === "P").length;

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Timesheet - ${header.name} - ${periodeLabel}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 12mm 15mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9pt;
      color: #1e293b;
      background: #fff;
    }
    .header-wrapper {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 12px;
      gap: 16px;
    }
    .title-block h1 {
      font-size: 20pt;
      font-weight: 800;
      color: #4f46e5;
      letter-spacing: -0.5px;
      margin-bottom: 4px;
    }
    .title-block .subtitle {
      font-size: 9pt;
      color: #64748b;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 24px;
      font-size: 9pt;
    }
    .info-row { display: flex; gap: 6px; }
    .info-label { font-weight: 600; color: #64748b; min-width: 120px; }
    .info-value { color: #1e293b; font-weight: 500; }
    .legend {
      margin-bottom: 8px;
      font-size: 7.5pt;
      color: #64748b;
      padding: 5px 10px;
      background: #f8fafc;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    thead th {
      background: #4f46e5;
      color: #fff;
      padding: 7px 8px;
      font-size: 7.5pt;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      border: 1px solid #4338ca;
      text-align: center;
    }
    tbody td {
      padding: 5px 8px;
      border-bottom: 1px solid #f1f5f9;
      border-right: 1px solid #f1f5f9;
    }
    tbody tr:last-child td { border-bottom: 2px solid #4f46e5; }
    .total-row td {
      background: #4f46e5;
      color: #fff;
      font-weight: 700;
      padding: 7px 8px;
      border: none;
    }
    .sig-section {
      margin-top: 16px;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 24px;
    }
    .sig-box {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
    }
    .sig-label {
      font-size: 8pt;
      font-weight: 700;
      color: #64748b;
      margin-bottom: 40px;
    }
    .sig-name {
      font-size: 9pt;
      font-weight: 700;
      color: #1e293b;
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
      text-align: center;
    }
    .sig-title {
      font-size: 8pt;
      color: #64748b;
      text-align: center;
    }
    .date-stamp {
      font-size: 8pt;
      color: #94a3b8;
      text-align: right;
      margin-top: 8px;
    }
    .summary-bar {
      display: flex;
      gap: 12px;
      margin-bottom: 10px;
      flex-wrap: wrap;
    }
    .sum-item {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 5px 12px;
      font-size: 8.5pt;
    }
    .sum-item strong { color: #4f46e5; }
  </style>
</head>
<body>
  <div class="header-wrapper">
    <div class="title-block">
      <h1>TIME SHEET</h1>
      <div class="subtitle">Periode: ${periodeLabel}</div>
    </div>
    <div class="info-grid">
      <div class="info-row"><span class="info-label">NAME of PROJECT</span><span class="info-value">: ${header.projectName}</span></div>
      <div class="info-row"><span class="info-label">NPP</span><span class="info-value">: ${header.npp}</span></div>
      <div class="info-row"><span class="info-label">DEPARTMENT / DIVISION</span><span class="info-value">: ${header.department}</span></div>
      <div class="info-row"><span class="info-label">PERIODE</span><span class="info-value">: ${periodeLabel}</span></div>
      <div class="info-row"><span class="info-label">NAME</span><span class="info-value">: ${header.name}</span></div>
    </div>
  </div>

  <div class="summary-bar">
    <div class="sum-item">Present: <strong>${presentDays}</strong> days</div>
    <div class="sum-item">Total Hours: <strong>${totalHours}</strong> hrs</div>
    <div class="sum-item">Sick: <strong>${rows.filter((r) => r.status === "S").length}</strong></div>
    <div class="sum-item">Vacation: <strong>${rows.filter((r) => r.status === "V").length}</strong></div>
    <div class="sum-item">Business Trip: <strong>${rows.filter((r) => r.status === "BT").length}</strong></div>
    <div class="sum-item">Permit: <strong>${rows.filter((r) => r.status === "PM").length}</strong></div>
  </div>

  <div class="legend">
    P = Present &nbsp;|&nbsp; S = Sick &nbsp;|&nbsp; V = Vacation &nbsp;|&nbsp; BT = Business Trip &nbsp;|&nbsp; PM = Permit &nbsp;|&nbsp; X = Not Working &nbsp;|&nbsp; H = Holiday
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:28px;">No</th>
        <th style="width:36px;">Date</th>
        <th style="width:60px;">Day</th>
        <th style="width:50px;">Start</th>
        <th style="width:50px;">End</th>
        <th style="width:55px;">Total Hr</th>
        <th style="width:55px;">Status</th>
        <th>Activity / Remark</th>
        <th style="width:120px;">Project Name</th>
        <th style="width:80px;">Project ID</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="5" style="text-align:right;">TOTAL WORKING HOURS</td>
        <td style="text-align:center;">${totalHours} hrs</td>
        <td colspan="4" style="text-align:center;">Present: ${presentDays} days</td>
      </tr>
    </tfoot>
  </table>

  <div class="sig-section">
    <div class="sig-box">
      <div class="sig-label">TTD PEGAWAI,</div>
      <div class="sig-name">( ${header.name || "___________________"} )</div>
      <div class="sig-title">${header.employeeTitle || "EMPLOYEE"}</div>
    </div>
    <div class="sig-box">
      <div class="sig-label">DI PERIKSA OLEH,</div>
      <div class="sig-name">( ${header.managerName || "___________________"} )</div>
      <div class="sig-title">MANAGER</div>
    </div>
    <div class="sig-box">
      <div class="sig-label">DISETUJUI OLEH,</div>
      <div class="sig-name">( ${header.deptHeadName || "___________________"} )</div>
      <div class="sig-title">DEPARTMENT HEAD</div>
    </div>
  </div>

  <div class="date-stamp">
    DATE : ${new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}
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

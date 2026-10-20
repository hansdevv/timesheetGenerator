"use client";

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { TimesheetData, SPLData } from "./types";
import { MONTH_NAMES_TITLE } from "./types";

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF000000" } },
  bottom: { style: "thin", color: { argb: "FF000000" } },
  left: { style: "thin", color: { argb: "FF000000" } },
  right: { style: "thin", color: { argb: "FF000000" } },
};

const GRAY_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFBFBFBF" },
  bgColor: { argb: "FFBFBFBF" },
};

const WHITE_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFFFFF" },
  bgColor: { argb: "FFFFFFFF" },
};

/**
 * Converts a time string "HH:MM" or "HH:MM:SS" into a decimal day fraction (0 to 1).
 * In Excel, numeric fractions formatted with "hh:mm:ss" display in 24-hour format
 * (e.g. 08:52:48), completely immune to timezone conversions and without AM/PM.
 */
function parseTimeToExcelFraction(timeStr: string): number | null {
  if (!timeStr) return null;
  const parts = timeStr.trim().split(":").map(Number);
  if (isNaN(parts[0])) return null;
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  const s = parts[2] || 0;
  return (h * 3600 + m * 60 + s) / 86400;
}

/**
 * Converts "YYYY-MM-DD" into a UTC Date object so that local timezone shifts
 * (e.g. UTC+7) do not shift day 1 backwards into the previous month.
 */
function parseDateToExcelDate(dateStr: string): Date {
  const parts = dateStr.trim().split("-").map(Number);
  const year = parts[0];
  const monthIndex = (parts[1] || 1) - 1;
  const day = parts[2] || 1;
  return new Date(Date.UTC(year, monthIndex, day));
}

async function loadTemplateBuffer(path: string): Promise<ArrayBuffer | Uint8Array> {
  if (typeof window !== "undefined") {
    const res = await fetch(path);
    if (!res.ok) {
      throw new Error(`Gagal memuat template Excel (${path}): ${res.statusText}`);
    }
    return await res.arrayBuffer();
  } else {
    const fs = await import("fs");
    const pathMod = await import("path");
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    const localPath = pathMod.resolve(process.cwd(), "public", cleanPath);
    const buf = fs.readFileSync(localPath);
    return new Uint8Array(buf);
  }
}

/**
 * Export Timesheet Excel using the official Adidata Excel template.
 * Matches: template_Time Sheet September 2026_901513_Mohamad Burhanudin.xlsx
 */
export async function exportTimesheetExcel(data: TimesheetData): Promise<void> {
  const { header, rows } = data;
  const templateBuffer = await loadTemplateBuffer("/templates/template_timesheet.xlsx");

  const workbook = new ExcelJS.Workbook();
  await (workbook.xlsx as unknown as { load: (buf: ArrayBuffer | Uint8Array) => Promise<ExcelJS.Workbook> }).load(templateBuffer);

  const ws = workbook.worksheets[0];
  if (!ws) {
    throw new Error("Worksheet tidak ditemukan dalam template.");
  }

  // 1. Fill Header Information (Rows 2 - 6)
  const monthName = MONTH_NAMES_TITLE[header.month - 1] || "September";
  ws.getCell("D2").value = `:  ${header.projectName || ""}`;
  ws.getCell("D3").value = `:  ${header.department || ""}`;
  ws.getCell("D4").value = `:  ${header.name || ""}`;
  ws.getCell("D5").value = `:  ${header.npp || ""}`;
  ws.getCell("D6").value = `:  ${monthName} ${header.year}`;

  const numDays = rows.length;

  // 2. Fill Daily Timesheet Rows (Rows 10 to 10 + numDays - 1)
  // Master template has 31 rows (10 to 40), avoiding destructive spliceRows.
  let countP = 0;
  let countS = 0;
  let countBT = 0;
  let countPM = 0;
  let countV = 0;
  let countX = 0;

  for (let i = 0; i < numDays; i++) {
    const r = 10 + i;
    const row = rows[i];
    const isWeekend = row.isWeekend;
    const isHoliday = row.isHoliday || row.status === "H";
    const isPresent = row.status === "P";
    const dateObj = parseDateToExcelDate(row.date);
    const dayOfWeek = dateObj.getUTCDay(); // 0=Sun, 5=Fri, 6=Sat (UTC safe)

    // Unhide row
    ws.getRow(r).hidden = false;

    // Col B: Date
    const cellB = ws.getCell(`B${r}`);
    cellB.value = dateObj;
    cellB.numFmt = 'd"-"mmm"-"yyyy';
    cellB.font = { name: "Calibri", size: 9, bold: false, color: { argb: "FF000000" } };
    cellB.alignment = { horizontal: "center", vertical: "middle" };
    // Present row date has pure WHITE background; non-working has gray
    cellB.fill = isPresent ? WHITE_FILL : GRAY_FILL;
    cellB.border = THIN_BORDER;

    // Apply borders for all data cells in this row
    const cols = ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R"];
    cols.forEach((colLetter) => {
      ws.getCell(`${colLetter}${r}`).border = THIN_BORDER;
    });

    const isWeekendDayOff = isWeekend && row.status !== "P";
    const isHolidayDayOff = (isHoliday || row.status === "H") && row.status !== "P";

    if (isWeekendDayOff) {
      // Weekend non-working day: DO NOT increment countX (X is "Not Working Anymore")
      cols.forEach((colLetter) => {
        ws.getCell(`${colLetter}${r}`).fill = GRAY_FILL;
        ws.getCell(`${colLetter}${r}`).value = null;
      });
      const cellL = ws.getCell(`L${r}`);
      cellL.value = "Weekend";
      cellL.font = { name: "Calibri", size: 9, bold: false, color: { argb: "FF000000" } };
      cellL.alignment = { horizontal: "left", vertical: "middle" };
    } else if (isHolidayDayOff) {
      // Holiday non-working day: DO NOT increment countX
      cols.forEach((colLetter) => {
        ws.getCell(`${colLetter}${r}`).fill = GRAY_FILL;
        ws.getCell(`${colLetter}${r}`).value = null;
      });
      const cellL = ws.getCell(`L${r}`);
      cellL.value = row.activity || row.holidayName || "Hari Libur Nasional";
      cellL.font = { name: "Calibri", size: 9, bold: false, color: { argb: "FF000000" } };
      cellL.alignment = { horizontal: "left", vertical: "middle" };
    } else if (isPresent) {
      countP++;
      // Working day (Present / Hadir) - Background murni PUTIH untuk seluruh kolom
      cols.forEach((colLetter) => {
        ws.getCell(`${colLetter}${r}`).fill = WHITE_FILL;
      });

      // Start Time (24h format tanpa AM/PM, e.g. 08:52:48)
      const fracStart = parseTimeToExcelFraction(row.startTime);
      const cellC = ws.getCell(`C${r}`);
      cellC.value = fracStart;
      cellC.numFmt = "hh:mm:ss";
      cellC.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF000000" } };
      cellC.alignment = { horizontal: "center", vertical: "middle" };

      // End Time (24h format tanpa AM/PM, e.g. 17:09:17)
      const fracEnd = parseTimeToExcelFraction(row.endTime);
      const cellD = ws.getCell(`D${r}`);
      cellD.value = fracEnd;
      cellD.numFmt = "hh:mm:ss";
      cellD.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF000000" } };
      cellD.alignment = { horizontal: "center", vertical: "middle" };

      // Total Hours formula & precalculated result
      // Friday has 1.5h lunch break deduction; other days 1h
      const breakFrac = dayOfWeek === 5 ? 1.5 / 24 : 1.0 / 24;
      const netFrac = fracStart !== null && fracEnd !== null ? Math.max(0, fracEnd - fracStart - breakFrac) : 0;
      const formulaStr = dayOfWeek === 5 ? `(D${r}-C${r})-(1.5/24)` : `(D${r}-C${r})-(1/24)`;

      const cellE = ws.getCell(`E${r}`);
      cellE.value = {
        formula: formulaStr,
        result: netFrac,
      };
      cellE.numFmt = "hh:mm:ss";
      cellE.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF000000" } };
      cellE.alignment = { horizontal: "center", vertical: "middle" };

      // Status P
      const cellF = ws.getCell(`F${r}`);
      cellF.value = "P";
      cellF.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF000000" } };
      cellF.alignment = { horizontal: "center", vertical: "middle" };

      // Clear G - K
      ["G", "H", "I", "J", "K"].forEach((colLetter) => {
        ws.getCell(`${colLetter}${r}`).value = null;
      });

      // Activity / Remark (L:N merged)
      const cellL = ws.getCell(`L${r}`);
      cellL.value = row.activity || "";
      cellL.font = { name: "Calibri", size: 9, bold: false, color: { argb: "FF000000" } };
      cellL.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

      // Project Name (O)
      const cellO = ws.getCell(`O${r}`);
      cellO.value = row.projectName || header.projectName || "";
      cellO.font = { name: "Calibri", size: 9, bold: false, color: { argb: "FF000000" } };
      cellO.alignment = { horizontal: "left", vertical: "middle" };

      // Project ID (P)
      const cellP = ws.getCell(`P${r}`);
      cellP.value = row.projectId || header.projectId || "";
      cellP.font = { name: "Calibri", size: 9, bold: false, color: { argb: "FF000000" } };
      cellP.alignment = { horizontal: "center", vertical: "middle" };

      // Aplikasi Berdampak (Q)
      const cellQ = ws.getCell(`Q${r}`);
      cellQ.value = row.aplikasiBerdampak || header.aplikasiBerdampak || "";
      cellQ.font = { name: "Calibri", size: 9, bold: false, color: { argb: "FF000000" } };
      cellQ.alignment = { horizontal: "center", vertical: "middle" };

      // AIP Fitur (R)
      const cellR = ws.getCell(`R${r}`);
      cellR.value = row.aipFitur || header.aipFitur || "";
      cellR.font = { name: "Calibri", size: 9, bold: false, color: { argb: "FF000000" } };
      cellR.alignment = { horizontal: "left", vertical: "middle" };
    } else {
      // Other statuses (S, BT, PM, V, X)
      if (row.status === "S") countS++;
      else if (row.status === "BT") countBT++;
      else if (row.status === "PM") countPM++;
      else if (row.status === "V") countV++;
      else countX++;

      cols.forEach((colLetter) => {
        ws.getCell(`${colLetter}${r}`).fill = WHITE_FILL;
        ws.getCell(`${colLetter}${r}`).value = null;
      });

      const statusColMap: Record<string, string> = {
        S: "G",
        BT: "H",
        PM: "I",
        V: "J",
        X: "K",
      };

      const targetCol = statusColMap[row.status] || "K";
      const statusCell = ws.getCell(`${targetCol}${r}`);
      statusCell.value = row.status === "X" ? "x" : row.status;
      statusCell.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF000000" } };
      statusCell.alignment = { horizontal: "center", vertical: "middle" };

      const cellL = ws.getCell(`L${r}`);
      cellL.value =
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
      cellL.font = { name: "Calibri", size: 9, bold: false, color: { argb: "FF000000" } };
      cellL.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

      if (row.status === "BT") {
        ws.getCell(`O${r}`).value = row.projectName || header.projectName || "";
        ws.getCell(`P${r}`).value = row.projectId || header.projectId || "";
      }
    }
  }

  // 3. Hide extra rows if month has less than 31 days (e.g. 30 days hides row 40; 28 days hides 38-40)
  for (let r = 10 + numDays; r <= 40; r++) {
    ws.getRow(r).hidden = true;
    for (let c = 1; c <= 18; c++) {
      ws.getRow(r).getCell(c).value = null;
    }
  }

  // 4. Fill Summary Row (Row 41)
  const lastDataRow = 9 + numDays;
  // Ensure Summary Row has NO background fill across all columns B to R
  const summaryCols = ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R"];
  summaryCols.forEach((colLetter) => {
    ws.getCell(`${colLetter}41`).fill = { type: "pattern", pattern: "none" };
  });

  ws.getCell("F41").value = { formula: `COUNTIF(F10:F${lastDataRow},"P")`, result: countP };
  ws.getCell("G41").value = { formula: `COUNTIF(G10:G${lastDataRow},"S")`, result: countS };
  ws.getCell("H41").value = { formula: `COUNTIF(H10:H${lastDataRow},"BT")`, result: countBT };
  ws.getCell("I41").value = { formula: `COUNTIF(I10:I${lastDataRow},"PM")`, result: countPM };
  ws.getCell("J41").value = { formula: `COUNTIF(J10:J${lastDataRow},"V")`, result: countV };
  ws.getCell("K41").value = { formula: `COUNTIF(K10:K${lastDataRow},"x")`, result: countX };

  // 5. Fill Signatures & Footer (Rows 43 - 50) with pristine merges preserved
  // Row 43: Headers (E43:M43 is merged as a single header "DI PERIKSA OLEH,")
  ws.getCell("B43").value = "TTD PEGAWAI,";
  ws.getCell("E43").value = "DI PERIKSA OLEH,";
  ws.getCell("N43").value = "DISETUJUI OLEH,";

  // Row 44: Names in Signature Box
  ws.getCell("B44").value = `( ${header.name || ""} )`;
  ws.getCell("E44").value = `( ${header.officerName || "Valentino Tarigan"} )`;
  ws.getCell("I44").value = `( ${header.managerName || "Gita Kartika"} )`;
  ws.getCell("N44").value = `( ${header.deptHeadName || "Adhy Perdhana"} )`;

  // Row 49: Titles / Roles
  ws.getCell("B49").value = header.employeeTitle || "Pegawai";
  ws.getCell("E49").value = header.officerTitle || "Officer";
  ws.getCell("I49").value = header.managerTitle || "Pgs. Team Leader";
  ws.getCell("N49").value = header.deptHeadTitle || "Department Head";

  // Row 50: Date Stamp (Defaults to 1st of next month)
  const nextMonth = header.month === 12 ? 1 : header.month + 1;
  const nextYear = header.month === 12 ? header.year + 1 : header.year;
  const defaultDateStamp = `01 ${MONTH_NAMES_TITLE[nextMonth - 1]} ${nextYear}`;
  const dateStampText = `DATE : ${header.dateStamp || defaultDateStamp}`;

  ws.getCell("B50").value = dateStampText;
  ws.getCell("E50").value = dateStampText;
  ws.getCell("I50").value = dateStampText;
  ws.getCell("N50").value = dateStampText;

  // 6. Generate and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const safeName = (header.name || "Pegawai").replace(/\s+/g, " ");
  const fileName = `Time Sheet ${monthName} ${header.year}_${header.npp || "NPP"}_${safeName}.xlsx`;
  saveAs(blob, fileName);
}

/**
 * Export Surat Perintah Lembur (SPL) Excel using the official Adidata Excel template.
 * Matches: sample_Surat_Perintah_Lembur_Mohamad Burhanudin_tgl_12.xlsx
 */
export async function exportSPLExcel(data: SPLData): Promise<void> {
  const templateBuffer = await loadTemplateBuffer("/templates/template_spl.xlsx");

  const workbook = new ExcelJS.Workbook();
  await (workbook.xlsx as unknown as { load: (buf: ArrayBuffer | Uint8Array) => Promise<ExcelJS.Workbook> }).load(templateBuffer);

  const ws = workbook.worksheets[0];
  if (!ws) {
    throw new Error("Worksheet tidak ditemukan dalam template SPL.");
  }

  // Header info
  ws.getCell("C7").value = `NPP                                         : ${data.npp || ""}`;
  ws.getCell("C8").value = `NAMA                                    : ${data.name || ""}`;
  ws.getCell("C9").value = `DEPARTEMENT / DIVISI      : ${data.department || ""}`;
  ws.getCell("C10").value = `POSISI                                     : ${data.position || "Developer"}`;

  const entries = data.entries && data.entries.length > 0 ? data.entries : [];
  const entriesCount = Math.max(1, entries.length);

  // If more than 1 entry, insert rows starting after row 15
  for (let i = 1; i < entries.length; i++) {
    const insertRowIdx = 15 + i;
    ws.spliceRows(insertRowIdx, 0, [null]);
    try {
      ws.mergeCells(`D${insertRowIdx}:E${insertRowIdx}`);
      ws.mergeCells(`F${insertRowIdx}:G${insertRowIdx}`);
      ws.mergeCells(`J${insertRowIdx}:M${insertRowIdx}`);
    } catch {
      // ignore merge issues
    }

    const r15 = ws.getRow(15);
    const newRow = ws.getRow(insertRowIdx);
    for (let c = 1; c <= 15; c++) {
      newRow.getCell(c).style = JSON.parse(JSON.stringify(r15.getCell(c).style));
    }
  }

  // Fill entries
  entries.forEach((entry, i) => {
    const r = 15 + i;
    ws.getCell(`C${r}`).value = entry.no || i + 1;
    ws.getCell(`C${r}`).border = THIN_BORDER;

    const dateObj = parseDateToExcelDate(entry.date);
    const cellD = ws.getCell(`D${r}`);
    cellD.value = dateObj;
    cellD.numFmt = "mm/dd/yyyy";
    cellD.border = THIN_BORDER;

    const fracStart = parseTimeToExcelFraction(entry.startTime);
    const cellF = ws.getCell(`F${r}`);
    cellF.value = fracStart;
    cellF.numFmt = "hh:mm:ss";
    cellF.border = THIN_BORDER;

    const fracEnd = parseTimeToExcelFraction(entry.endTime);
    const cellH = ws.getCell(`H${r}`);
    cellH.value = fracEnd;
    cellH.numFmt = "hh:mm:ss";
    cellH.border = THIN_BORDER;

    const netFrac = fracStart !== null && fracEnd !== null ? Math.max(0, fracEnd - fracStart - 1 / 24) : 0;
    const cellI = ws.getCell(`I${r}`);
    cellI.value = { formula: `(H${r}-F${r})-(1/24)`, result: netFrac };
    cellI.numFmt = "hh:mm:ss";
    cellI.border = THIN_BORDER;

    const cellJ = ws.getCell(`J${r}`);
    cellJ.value = entry.tasks || "";
    cellJ.border = THIN_BORDER;
    cellJ.alignment = { wrapText: true, vertical: "top" };
  });

  // Total Overtime Hours row
  const totRow = 15 + entriesCount;
  const cellSum = ws.getCell(`I${totRow}`);
  const totalNet = entries.reduce((acc, e) => {
    const s = parseTimeToExcelFraction(e.startTime) || 0;
    const en = parseTimeToExcelFraction(e.endTime) || 0;
    return acc + Math.max(0, en - s - 1 / 24);
  }, 0);
  cellSum.value = { formula: `SUM(I15:I${totRow - 1})`, result: totalNet };
  cellSum.numFmt = "hh:mm:ss";

  // Signatures
  const rowOffset = entriesCount - 1;
  const sigNameRow = 24 + rowOffset;
  const sigRoleRow = 25 + rowOffset;

  ws.getCell(`B${sigNameRow}`).value = ` ( ${data.name || ""} )`;
  ws.getCell(`B${sigRoleRow}`).value = data.position || "Developer";

  ws.getCell(`G${sigNameRow}`).value = `( ${data.teamLeaderName || "Gita Kartika"} )`;
  ws.getCell(`G${sigRoleRow}`).value = data.teamLeaderTitle || "Pgs. Team Leader";

  ws.getCell(`K${sigNameRow}`).value = `( ${data.deptHeadName || "Adhy Perdhana"} )`;
  ws.getCell(`K${sigRoleRow}`).value = data.deptHeadTitle || "Department Head";

  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const firstDate = entries[0]?.date ? entries[0].date.split("-")[2] : "12";
  const fileName = `Surat_Perintah_Lembur_${(data.name || "Pegawai").replace(/\s+/g, " ")}_tgl_${firstDate}.xlsx`;
  saveAs(blob, fileName);
}

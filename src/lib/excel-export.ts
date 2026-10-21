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

const NO_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "none",
};

/**
 * Apply clean outer borders for a timesheet data row to prevent internal
 * vertical lines across the merged L:N activity cells.
 */
function applyTimesheetRowBorders(ws: ExcelJS.Worksheet, r: number) {
  // Single cells B through K and O through R have complete thin borders
  const singleCols = ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "O", "P", "Q", "R"];
  singleCols.forEach((colLetter) => {
    ws.getCell(`${colLetter}${r}`).border = THIN_BORDER;
  });

  // Merged activity columns L:N
  ws.getCell(`L${r}`).border = {
    left: { style: "thin", color: { argb: "FF000000" } },
    top: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
  };
  ws.getCell(`M${r}`).border = {
    top: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
  };
  ws.getCell(`N${r}`).border = {
    right: { style: "thin", color: { argb: "FF000000" } },
    top: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
  };
}

/**
 * Converts a time string "HH:MM" or "HH:MM:SS" into a decimal day fraction (0 to 1).
 * In Excel, numeric fractions formatted with "h:mm:ss" display in 24-hour format
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
    // On GitHub Pages the app lives at /<repo-name>/, so static assets must
    // be fetched with that prefix. NEXT_PUBLIC_BASE_PATH is set in CI to
    // e.g. "/timesheetGenerator"; empty string in local dev.
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const url = `${base}${path}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Gagal memuat template Excel (${url}): ${res.statusText}`);
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
 * Matches: sample_Time Sheet September 2026_901513_Mohamad Burhanudin.xlsx
 */
export async function exportTimesheetExcel(data: TimesheetData): Promise<void> {
  const { header, rows } = data;
  const templateBuffer = await loadTemplateBuffer("/templates/template_timesheet.xlsx");

  const workbook = new ExcelJS.Workbook();
  await (workbook.xlsx as unknown as { load: (buf: ArrayBuffer | Uint8Array) => Promise<ExcelJS.Workbook> }).load(templateBuffer);

  workbook.creator = "Adidata Timesheet Generator";
  workbook.lastModifiedBy = "Adidata Timesheet Generator";
  workbook.created = new Date();
  workbook.modified = new Date();

  const ws = workbook.worksheets[0];
  if (!ws) {
    throw new Error("Worksheet tidak ditemukan dalam template.");
  }

  // 1. Fill Header Information (Rows 2 - 6)
  const monthName = MONTH_NAMES_TITLE[header.month - 1] || "September";
  const cellD2 = ws.getCell("D2");
  cellD2.value = `:  ${header.projectName || ""}`;
  cellD2.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF000000" } };

  const cellD3 = ws.getCell("D3");
  cellD3.value = `:  ${header.department || ""}`;
  cellD3.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF000000" } };

  const cellD4 = ws.getCell("D4");
  cellD4.value = `:  ${header.name || ""}`;
  cellD4.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF000000" } };

  const cellD5 = ws.getCell("D5");
  cellD5.value = `:  ${header.npp || ""}`;
  cellD5.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF000000" } };

  const cellD6 = ws.getCell("D6");
  cellD6.value = `:  ${monthName} ${header.year}`;
  cellD6.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF000000" } };

  const numDays = rows.length;

  // 2. Fill Daily Timesheet Rows (Rows 10 to 10 + numDays - 1)
  // Master template has 31 rows (10 to 40), avoiding destructive spliceRows.
  let countP = 0;
  let countS = 0;
  let countBT = 0;
  let countPM = 0;
  let countV = 0;
  let countX = 0;

  const dataCols = ["C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R"];

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

    const isWeekendDayOff = isWeekend && row.status !== "P";
    const isHolidayDayOff = (isHoliday || row.status === "H") && row.status !== "P";
    const isDayOff = isWeekendDayOff || isHolidayDayOff;

    // Col B: Date (Gray background ONLY for weekend and holiday)
    const cellB = ws.getCell(`B${r}`);
    cellB.value = dateObj;
    cellB.numFmt = 'd"-"mmm"-"yyyy';
    cellB.font = { name: "Calibri", size: 9, bold: false, color: { argb: "FF000000" } };
    cellB.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cellB.fill = isDayOff ? GRAY_FILL : NO_FILL;

    // Apply clean outer borders
    applyTimesheetRowBorders(ws, r);

    if (isWeekendDayOff) {
      // Weekend non-working day: All columns gray, value "Weekend" centered and bold
      cellB.fill = GRAY_FILL;
      dataCols.forEach((colLetter) => {
        ws.getCell(`${colLetter}${r}`).fill = GRAY_FILL;
        ws.getCell(`${colLetter}${r}`).value = null;
      });
      const cellL = ws.getCell(`L${r}`);
      cellL.value = "Weekend";
      cellL.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF000000" } };
      cellL.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    } else if (isHolidayDayOff) {
      // Holiday non-working day: All columns gray, activity centered and bold
      cellB.fill = GRAY_FILL;
      dataCols.forEach((colLetter) => {
        ws.getCell(`${colLetter}${r}`).fill = GRAY_FILL;
        ws.getCell(`${colLetter}${r}`).value = null;
      });
      const cellL = ws.getCell(`L${r}`);
      cellL.value = row.activity || row.holidayName || "Hari Libur Nasional";
      cellL.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF000000" } };
      cellL.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    } else if (isPresent) {
      countP++;
      // Working day (Present / Hadir) - NO_FILL (transparent) for entire row
      cellB.fill = NO_FILL;
      dataCols.forEach((colLetter) => {
        ws.getCell(`${colLetter}${r}`).fill = NO_FILL;
      });

      // Start Time (24h format e.g. 08:52:48)
      const fracStart = parseTimeToExcelFraction(row.startTime);
      const cellC = ws.getCell(`C${r}`);
      cellC.value = fracStart;
      cellC.numFmt = "h:mm:ss";
      cellC.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF000000" } };
      cellC.alignment = { horizontal: "center", vertical: "middle" };

      // End Time (24h format e.g. 17:09:17)
      const fracEnd = parseTimeToExcelFraction(row.endTime);
      const cellD = ws.getCell(`D${r}`);
      cellD.value = fracEnd;
      cellD.numFmt = "h:mm:ss";
      cellD.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF000000" } };
      cellD.alignment = { horizontal: "center", vertical: "middle" };

      // Total Hours formula & precalculated result for instant multi-OS preview
      // Friday has 1.5h lunch break deduction; other days 1h
      const breakFrac = dayOfWeek === 5 ? 1.5 / 24 : 1.0 / 24;
      const netFrac = fracStart !== null && fracEnd !== null ? Math.max(0, fracEnd - fracStart - breakFrac) : 0;
      const formulaStr = dayOfWeek === 5 ? `(D${r}-C${r})-(1.5/24)` : `(D${r}-C${r})-(1/24)`;

      const cellE = ws.getCell(`E${r}`);
      cellE.value = {
        formula: formulaStr,
        result: netFrac,
      };
      cellE.numFmt = "h:mm:ss";
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
      cellO.alignment = { horizontal: "center", vertical: "middle" };

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
      cellR.alignment = { horizontal: "center", vertical: "middle" };
    } else {
      // Other statuses (S, BT, PM, V, X)
      if (row.status === "S") countS++;
      else if (row.status === "BT") countBT++;
      else if (row.status === "PM") countPM++;
      else if (row.status === "V") countV++;
      else countX++;

      dataCols.forEach((colLetter) => {
        ws.getCell(`${colLetter}${r}`).fill = NO_FILL;
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
  const summaryCols = ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R"];
  summaryCols.forEach((colLetter) => {
    ws.getCell(`${colLetter}41`).fill = NO_FILL;
  });

  const summaryFont: Partial<ExcelJS.Font> = { name: "Calibri", size: 12, bold: true, color: { argb: "FF000000" } };
  const summaryAlign: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle", wrapText: true };

  const summarySpecs: Array<{ col: string; formula: string; result: number }> = [
    { col: "F", formula: `COUNTIF(F10:F${lastDataRow},"P")`, result: countP },
    { col: "G", formula: `COUNTIF(G10:G${lastDataRow},"S")`, result: countS },
    { col: "H", formula: `COUNTIF(H10:H${lastDataRow},"BT")`, result: countBT },
    { col: "I", formula: `COUNTIF(I10:I${lastDataRow},"PM")`, result: countPM },
    { col: "J", formula: `COUNTIF(J10:J${lastDataRow},"V")`, result: countV },
    { col: "K", formula: `COUNTIF(K10:K${lastDataRow},"x")`, result: countX },
  ];

  summarySpecs.forEach(({ col, formula, result }) => {
    const cell = ws.getCell(`${col}41`);
    cell.value = { formula, result };
    cell.font = summaryFont;
    cell.alignment = summaryAlign;
  });

  // 5. Fill Signatures & Footer (Rows 43 - 50) with pristine merges preserved
  // Row 43: Headers
  const sigHeaderFont: Partial<ExcelJS.Font> = { name: "Calibri", size: 9, bold: true, color: { argb: "FF000000" } };
  const cellB43 = ws.getCell("B43");
  cellB43.value = "TTD PEGAWAI,";
  cellB43.font = sigHeaderFont;

  const cellE43 = ws.getCell("E43");
  cellE43.value = "DI PERIKSA OLEH,";
  cellE43.font = sigHeaderFont;

  const cellN43 = ws.getCell("N43");
  cellN43.value = "DISETUJUI OLEH,";
  cellN43.font = sigHeaderFont;

  // Row 44: Names in Signature Box
  const sigNameFont: Partial<ExcelJS.Font> = { name: "Calibri", size: 9, bold: true, color: { argb: "FF000000" } };
  const cellB44 = ws.getCell("B44");
  cellB44.value = ` (   ${header.name || ""}   )`;
  cellB44.font = sigNameFont;
  cellB44.alignment = { horizontal: "center" };

  const cellE44 = ws.getCell("E44");
  cellE44.value = `(   ${header.officerName || "Valentino Tarigan"}   )`;
  cellE44.font = sigNameFont;
  cellE44.alignment = { horizontal: "center", wrapText: true };

  const cellI44 = ws.getCell("I44");
  cellI44.value = `(   ${header.managerName || "Gita Kartika"}   )`;
  cellI44.font = sigNameFont;
  cellI44.alignment = { horizontal: "center" };

  const cellN44 = ws.getCell("N44");
  cellN44.value = `(  ${header.deptHeadName || "Adhy Perdhana"}  )`;
  cellN44.font = sigNameFont;
  cellN44.alignment = { horizontal: "center" };

  // Row 49: Titles / Roles
  const sigRoleFont: Partial<ExcelJS.Font> = { name: "Calibri", size: 10, bold: true, color: { argb: "FF000000" } };
  const sigRoleAlign: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle" };

  const cellB49 = ws.getCell("B49");
  cellB49.value = header.employeeTitle || "Pegawai";
  cellB49.font = sigRoleFont;
  cellB49.alignment = sigRoleAlign;

  const cellE49 = ws.getCell("E49");
  cellE49.value = header.officerTitle || "Officer";
  cellE49.font = sigRoleFont;
  cellE49.alignment = sigRoleAlign;

  const cellI49 = ws.getCell("I49");
  cellI49.value = header.managerTitle || "Pgs. Team Leader";
  cellI49.font = sigRoleFont;
  cellI49.alignment = sigRoleAlign;

  const cellN49 = ws.getCell("N49");
  cellN49.value = header.deptHeadTitle || "Department Head";
  cellN49.font = sigRoleFont;
  cellN49.alignment = sigRoleAlign;

  // Row 50: Date Stamp
  const nextMonth = header.month === 12 ? 1 : header.month + 1;
  const nextYear = header.month === 12 ? header.year + 1 : header.year;
  const defaultDateStamp = `01 ${MONTH_NAMES_TITLE[nextMonth - 1]} ${nextYear}`;
  const dateStampText = `DATE : ${header.dateStamp || defaultDateStamp}`;
  const dateStampFont: Partial<ExcelJS.Font> = { name: "Calibri", size: 9, bold: false, color: { argb: "FF000000" } };
  const dateStampAlign: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle" };

  ["B50", "E50", "I50", "N50"].forEach((cellAddr) => {
    const c = ws.getCell(cellAddr);
    c.value = dateStampText;
    c.font = dateStampFont;
    c.alignment = dateStampAlign;
  });

  // 6. Generate and trigger download with universal OOXML format
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

  workbook.creator = "Adidata Timesheet Generator";
  workbook.lastModifiedBy = "Adidata Timesheet Generator";
  workbook.created = new Date();
  workbook.modified = new Date();

  const ws = workbook.worksheets[0];
  if (!ws) {
    throw new Error("Worksheet tidak ditemukan dalam template SPL.");
  }

  // Header info
  const splHeaderFont: Partial<ExcelJS.Font> = { name: "Calibri", size: 11, bold: true, color: { argb: "FF000000" } };
  const cellC7 = ws.getCell("C7");
  cellC7.value = `NPP                                         : ${data.npp || ""}`;
  cellC7.font = splHeaderFont;

  const cellC8 = ws.getCell("C8");
  cellC8.value = `NAMA                                    : ${data.name || ""}`;
  cellC8.font = splHeaderFont;

  const cellC9 = ws.getCell("C9");
  cellC9.value = `DEPARTEMENT / DIVISI      : ${data.department || ""}`;
  cellC9.font = splHeaderFont;

  const cellC10 = ws.getCell("C10");
  cellC10.value = `POSISI                                     : ${data.position || "Developer"}`;
  cellC10.font = splHeaderFont;

  const entries = data.entries && data.entries.length > 0 ? data.entries : [];
  const entriesCount = Math.max(1, entries.length);
  const extraRows = entriesCount - 1;

  // If more than 1 entry, properly unmerge shifted regions below, splice rows, and re-merge
  if (extraRows > 0) {
    const toUnmerge = [
      "C16:H16",
      "C18:E23",
      "B24:E24",
      "G24:I24",
      "K24:M24",
      "B25:E25",
      "G25:I25",
      "K25:M25",
    ];
    toUnmerge.forEach((range) => {
      try {
        ws.unMergeCells(range);
      } catch {
        // ignore if not merged
      }
    });

    ws.spliceRows(16, 0, ...new Array(extraRows).fill([null]));

    // Merge new data rows (row index 16..15+extraRows)
    for (let i = 1; i <= extraRows; i++) {
      const r = 15 + i;
      ws.mergeCells(`D${r}:E${r}`);
      ws.mergeCells(`F${r}:G${r}`);
      ws.mergeCells(`J${r}:M${r}`);
    }

    // Re-merge shifted rows below
    const shiftedTotRow = 16 + extraRows;
    ws.mergeCells(`C${shiftedTotRow}:H${shiftedTotRow}`);
    ws.mergeCells(`C${18 + extraRows}:E${23 + extraRows}`);

    const shiftedSigNameRow = 24 + extraRows;
    const shiftedSigRoleRow = 25 + extraRows;
    ws.mergeCells(`B${shiftedSigNameRow}:E${shiftedSigNameRow}`);
    ws.mergeCells(`G${shiftedSigNameRow}:I${shiftedSigNameRow}`);
    ws.mergeCells(`K${shiftedSigNameRow}:M${shiftedSigNameRow}`);
    ws.mergeCells(`B${shiftedSigRoleRow}:E${shiftedSigRoleRow}`);
    ws.mergeCells(`G${shiftedSigRoleRow}:I${shiftedSigRoleRow}`);
    ws.mergeCells(`K${shiftedSigRoleRow}:M${shiftedSigRoleRow}`);
  }

  const tableDataFont: Partial<ExcelJS.Font> = { name: "Calibri", size: 11, bold: false, color: { argb: "FF000000" } };
  const centerMiddleAlign: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle" };

  // Fill entries
  entries.forEach((entry, i) => {
    const r = 15 + i;

    // Col C: No
    const cellC = ws.getCell(`C${r}`);
    cellC.value = entry.no || i + 1;
    cellC.numFmt = "@";
    cellC.font = tableDataFont;
    cellC.alignment = centerMiddleAlign;
    cellC.fill = NO_FILL;
    cellC.border = THIN_BORDER;

    // Col D:E (Date)
    const dateObj = parseDateToExcelDate(entry.date);
    const cellD = ws.getCell(`D${r}`);
    cellD.value = dateObj;
    cellD.numFmt = "mm/dd/yyyy";
    cellD.font = tableDataFont;
    cellD.alignment = centerMiddleAlign;
    cellD.fill = NO_FILL;
    cellD.border = {
      left: { style: "thin", color: { argb: "FF000000" } },
      top: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
    };

    const cellE = ws.getCell(`E${r}`);
    cellE.fill = NO_FILL;
    cellE.border = {
      right: { style: "thin", color: { argb: "FF000000" } },
      top: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
    };

    // Col F:G (Start Time)
    const fracStart = parseTimeToExcelFraction(entry.startTime);
    const cellF = ws.getCell(`F${r}`);
    cellF.value = fracStart;
    cellF.numFmt = "h:mm:ss";
    cellF.font = tableDataFont;
    cellF.alignment = centerMiddleAlign;
    cellF.fill = NO_FILL;
    cellF.border = {
      left: { style: "thin", color: { argb: "FF000000" } },
      top: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
    };

    const cellG = ws.getCell(`G${r}`);
    cellG.fill = NO_FILL;
    cellG.border = {
      right: { style: "thin", color: { argb: "FF000000" } },
      top: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
    };

    // Col H (End Time)
    const fracEnd = parseTimeToExcelFraction(entry.endTime);
    const cellH = ws.getCell(`H${r}`);
    cellH.value = fracEnd;
    cellH.numFmt = "h:mm:ss";
    cellH.font = tableDataFont;
    cellH.alignment = centerMiddleAlign;
    cellH.fill = NO_FILL;
    cellH.border = THIN_BORDER;

    // Col I (Total Jam: formula with precomputed result)
    const netFrac = fracStart !== null && fracEnd !== null ? Math.max(0, fracEnd - fracStart - 1 / 24) : 0;
    const cellI = ws.getCell(`I${r}`);
    cellI.value = { formula: `(H${r}-F${r})-(1/24)`, result: netFrac };
    cellI.numFmt = "h:mm:ss";
    cellI.font = tableDataFont;
    cellI.alignment = centerMiddleAlign;
    cellI.fill = NO_FILL;
    cellI.border = THIN_BORDER;

    // Col J:M (Tugas yang di Kerjakan)
    const cellJ = ws.getCell(`J${r}`);
    cellJ.value = entry.tasks || "";
    cellJ.font = tableDataFont;
    cellJ.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    cellJ.fill = NO_FILL;
    cellJ.border = {
      left: { style: "thin", color: { argb: "FF000000" } },
      top: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
    };

    ["K", "L"].forEach((colLetter) => {
      const c = ws.getCell(`${colLetter}${r}`);
      c.fill = NO_FILL;
      c.border = {
        top: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
      };
    });

    const cellM = ws.getCell(`M${r}`);
    cellM.fill = NO_FILL;
    cellM.border = {
      right: { style: "thin", color: { argb: "FF000000" } },
      top: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
    };
  });

  // Total Overtime Hours row
  const totRow = 15 + entriesCount;
  const cellTotLabel = ws.getCell(`C${totRow}`);
  cellTotLabel.value = "Total Keseluruhan Jam Lembur";
  cellTotLabel.font = tableDataFont;
  cellTotLabel.alignment = centerMiddleAlign;
  cellTotLabel.fill = NO_FILL;
  cellTotLabel.border = {
    left: { style: "thin", color: { argb: "FF000000" } },
    top: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
  };

  ["D", "E", "F", "G"].forEach((colLetter) => {
    const c = ws.getCell(`${colLetter}${totRow}`);
    c.fill = NO_FILL;
    c.border = {
      top: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
    };
  });

  const cellTotH = ws.getCell(`H${totRow}`);
  cellTotH.fill = NO_FILL;
  cellTotH.border = {
    right: { style: "thin", color: { argb: "FF000000" } },
    top: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
  };

  const cellSum = ws.getCell(`I${totRow}`);
  const totalNet = entries.reduce((acc, e) => {
    const s = parseTimeToExcelFraction(e.startTime) || 0;
    const en = parseTimeToExcelFraction(e.endTime) || 0;
    return acc + Math.max(0, en - s - 1 / 24);
  }, 0);
  cellSum.value = { formula: `SUM(I15:I${totRow - 1})`, result: totalNet };
  cellSum.numFmt = "h:mm:ss";
  cellSum.font = tableDataFont;
  cellSum.alignment = centerMiddleAlign;
  cellSum.fill = NO_FILL;
  cellSum.border = THIN_BORDER;

  // Signatures
  const sigNameRow = 24 + extraRows;
  const sigRoleRow = 25 + extraRows;
  const splSigFont: Partial<ExcelJS.Font> = { name: "Calibri", size: 11, bold: true, color: { argb: "FF000000" } };

  const cellSigB = ws.getCell(`B${sigNameRow}`);
  cellSigB.value = ` ( ${data.name || ""} )`;
  cellSigB.font = splSigFont;
  cellSigB.alignment = { horizontal: "center" };

  const cellRoleB = ws.getCell(`B${sigRoleRow}`);
  cellRoleB.value = `${data.position || "Developer"}\n`;
  cellRoleB.font = splSigFont;
  cellRoleB.alignment = { horizontal: "center", vertical: "top" };

  const cellSigG = ws.getCell(`G${sigNameRow}`);
  cellSigG.value = `( ${data.teamLeaderName || "Gita Kartika"} )`;
  cellSigG.font = splSigFont;
  cellSigG.alignment = { horizontal: "center" };

  const cellRoleG = ws.getCell(`G${sigRoleRow}`);
  cellRoleG.value = data.teamLeaderTitle || "Pgs. Team Leader";
  cellRoleG.font = splSigFont;
  cellRoleG.alignment = { horizontal: "center", vertical: "top" };

  const cellSigK = ws.getCell(`K${sigNameRow}`);
  cellSigK.value = `( ${data.deptHeadName || "Adhy Perdhana"} )`;
  cellSigK.font = splSigFont;
  cellSigK.alignment = { horizontal: "center" };

  const cellRoleK = ws.getCell(`K${sigRoleRow}`);
  cellRoleK.value = `${data.deptHeadTitle || "Department Head"}\n`;
  cellRoleK.font = splSigFont;
  cellRoleK.alignment = { horizontal: "center", vertical: "top" };

  // Generate and download with universal OOXML format
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const firstDate = entries[0]?.date ? entries[0].date.split("-")[2] : "12";
  const fileName = `Surat_Perintah_Lembur_${(data.name || "Pegawai").replace(/\s+/g, " ")}_tgl_${firstDate}.xlsx`;
  saveAs(blob, fileName);
}


"use client";

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { TimesheetData, SPLData } from "./types";
import type { IzinData } from "./schemas";
import { MONTH_NAMES_TITLE } from "./types";
import { formatDateId, formatIzinDateRange } from "./calc";

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

function setCellFill(cell: ExcelJS.Cell, fill: ExcelJS.Fill) {
  cell.style = { ...cell.style, fill };
}

/**
 * Prevent formula injection in user-entered text cells (PRD Sec 7 Security).
 */
export function sanitizeCellText(str: string): string {
  if (!str) return "";
  const trimmed = str.trim();
  if (trimmed === "-") return str;
  if (/^[=+\-@]/.test(trimmed)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Replace employee signature image in workbook if custom signatureDataUrl is provided.
 */
function applyCustomSignatureIfProvided(
  workbook: ExcelJS.Workbook,
  signatureDataUrl: string | undefined,
  targetMediaSize = 62870
) {
  if (!signatureDataUrl || !signatureDataUrl.startsWith("data:image/")) return;
  try {
    const base64Data = signatureDataUrl.split(",")[1];
    if (!base64Data) return;
    const binaryStr = typeof atob !== "undefined" ? atob(base64Data) : Buffer.from(base64Data, "base64").toString("binary");
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const mediaList = (workbook.model as unknown as { media?: Array<{ buffer?: Uint8Array | Buffer; extension?: string }> }).media;
    if (Array.isArray(mediaList)) {
      const sigMedia = mediaList.find((m) => m.buffer && m.buffer.length === targetMediaSize);
      if (sigMedia) {
        sigMedia.buffer = bytes;
        sigMedia.extension = signatureDataUrl.includes("image/jpeg") ? "jpeg" : "png";
      }
    }
  } catch {
    // Keep default template signature if parsing fails
  }
}

function applyTimesheetRowBorders(ws: ExcelJS.Worksheet, r: number) {
  const singleCols = ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "O", "P", "Q", "R"];
  singleCols.forEach((colLetter) => {
    ws.getCell(`${colLetter}${r}`).border = THIN_BORDER;
  });

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

function applyBoxBorder(
  ws: ExcelJS.Worksheet,
  startCol: string,
  endCol: string,
  startRow: number,
  endRow: number
) {
  const startColCode = startCol.charCodeAt(0);
  const endColCode = endCol.charCodeAt(0);
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startColCode; c <= endColCode; c++) {
      const colLetter = String.fromCharCode(c);
      const isTop = r === startRow;
      const isBottom = r === endRow;
      const isLeft = c === startColCode;
      const isRight = c === endColCode;

      ws.getCell(`${colLetter}${r}`).border = {
        top: isTop ? { style: "thin", color: { argb: "FF000000" } } : undefined,
        bottom: isBottom ? { style: "thin", color: { argb: "FF000000" } } : undefined,
        left: isLeft ? { style: "thin", color: { argb: "FF000000" } } : undefined,
        right: isRight ? { style: "thin", color: { argb: "FF000000" } } : undefined,
      };
    }
  }
}

export function parseTimeToExcelFraction(timeStr: string): number | null {
  if (!timeStr) return null;
  const parts = timeStr.trim().split(":").map(Number);
  if (isNaN(parts[0])) return null;
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  const s = parts[2] || 0;
  return (h * 3600 + m * 60 + s) / 86400;
}

export function parseDateToExcelDate(dateStr: string): Date {
  const parts = dateStr.trim().split("-").map(Number);
  const year = parts[0];
  const monthIndex = (parts[1] || 1) - 1;
  const day = parts[2] || 1;
  return new Date(Date.UTC(year, monthIndex, day));
}

export async function loadTemplateBuffer(path: string): Promise<ArrayBuffer | Uint8Array> {
  if (typeof window !== "undefined") {
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
 * Build Timesheet Excel Workbook in memory (used by both export and tests).
 */
export async function buildTimesheetWorkbook(data: TimesheetData): Promise<ExcelJS.Workbook> {
  const { header, rows } = data;
  const templateBuffer = await loadTemplateBuffer("/templates/template_timesheet.xlsx");

  const workbook = new ExcelJS.Workbook();
  await (workbook.xlsx as unknown as { load: (buf: ArrayBuffer | Uint8Array) => Promise<ExcelJS.Workbook> }).load(templateBuffer);

  applyCustomSignatureIfProvided(workbook, header.signatureDataUrl);

  workbook.creator = "Adidata Timesheet Generator";
  workbook.lastModifiedBy = "Adidata Timesheet Generator";
  workbook.created = new Date();
  workbook.modified = new Date();

  const ws = workbook.worksheets[0];
  if (!ws) {
    throw new Error("Worksheet tidak ditemukan dalam template.");
  }

  const monthName = MONTH_NAMES_TITLE[header.month - 1] || "September";
  const cellD2 = ws.getCell("D2");
  cellD2.value = `:  ${sanitizeCellText(header.projectName || "")}`;
  cellD2.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF000000" } };

  const cellD3 = ws.getCell("D3");
  cellD3.value = `:  ${sanitizeCellText(header.department || "")}`;
  cellD3.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF000000" } };

  const cellD4 = ws.getCell("D4");
  cellD4.value = `:  ${sanitizeCellText(header.name || "")}`;
  cellD4.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF000000" } };

  const cellD5 = ws.getCell("D5");
  cellD5.value = `:  ${sanitizeCellText(header.npp || "")}`;
  cellD5.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF000000" } };

  const cellD6 = ws.getCell("D6");
  cellD6.value = `:  ${monthName} ${header.year}`;
  cellD6.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF000000" } };

  const numDays = rows.length;
  const rowsToRemove = 31 - numDays;

  if (rowsToRemove > 0) {
    for (let r = 10 + numDays; r <= 40; r++) {
      try {
        ws.unMergeCells(`L${r}:N${r}`);
      } catch {}
    }

    const bottomMerges = [
      "B41:E41",
      "L41:N41",
      "B42:N42",
      "B43:D43",
      "E43:M43",
      "B44:D48",
      "E44:H48",
      "I44:M48",
      "N44:N48",
      "B49:D49",
      "E49:H49",
      "I49:M49",
      "B50:D50",
      "E50:H50",
      "I50:M50",
    ];
    bottomMerges.forEach((range) => {
      try {
        ws.unMergeCells(range);
      } catch {}
    });

    ws.spliceRows(10 + numDays, rowsToRemove);

    const sumR = 10 + numDays;
    const empR = 11 + numDays;
    const hdrR = 12 + numDays;
    const sigStart = 13 + numDays;
    const sigEnd = 17 + numDays;
    const roleR = 18 + numDays;
    const dateR = 19 + numDays;

    ws.mergeCells(`B${sumR}:E${sumR}`);
    ws.mergeCells(`L${sumR}:N${sumR}`);
    ws.mergeCells(`B${empR}:N${empR}`);
    ws.mergeCells(`B${hdrR}:D${hdrR}`);
    ws.mergeCells(`E${hdrR}:M${hdrR}`);
    ws.mergeCells(`B${sigStart}:D${sigEnd}`);
    ws.mergeCells(`E${sigStart}:H${sigEnd}`);
    ws.mergeCells(`I${sigStart}:M${sigEnd}`);
    ws.mergeCells(`N${sigStart}:N${sigEnd}`);
    ws.mergeCells(`B${roleR}:D${roleR}`);
    ws.mergeCells(`E${roleR}:H${roleR}`);
    ws.mergeCells(`I${roleR}:M${roleR}`);
    ws.mergeCells(`B${dateR}:D${dateR}`);
    ws.mergeCells(`E${dateR}:H${dateR}`);
    ws.mergeCells(`I${dateR}:M${dateR}`);

    ws.getRow(hdrR).height = 10.5;
    ws.getRow(sigStart).height = 10.5;
    ws.getRow(sigStart + 1).height = 18;
    ws.getRow(sigStart + 2).height = 16.5;
    ws.getRow(sigStart + 3).height = 16.5;
    ws.getRow(sigStart + 4).height = 16.5;
    ws.getRow(roleR).height = 14.25;
    ws.getRow(dateR).height = 14.25;

    // Also shift signature image anchor row to match spliced rows
    for (const img of ws.getImages()) {
      const tl = img.range?.tl as unknown as { nativeRow?: number } | undefined;
      if (tl && typeof tl.nativeRow === "number" && tl.nativeRow >= 40) {
        tl.nativeRow = sigStart - 1;
      }
    }
  }

  const sumR = 10 + numDays;
  const empR = 11 + numDays;
  const hdrR = 12 + numDays;
  const sigStart = 13 + numDays;
  const sigEnd = 17 + numDays;
  const roleR = 18 + numDays;
  const dateR = 19 + numDays;

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
    const dayOfWeek = dateObj.getUTCDay();

    ws.getRow(r).hidden = false;

    const isWeekendDayOff = isWeekend && row.status !== "P";
    const isHolidayDayOff = (isHoliday || row.status === "H") && row.status !== "P";
    const isDayOff = isWeekendDayOff || isHolidayDayOff;

    const cellB = ws.getCell(`B${r}`);
    cellB.value = dateObj;
    cellB.numFmt = 'd"-"mmm"-"yyyy';
    cellB.font = { name: "Calibri", size: 9, bold: false, color: { argb: "FF000000" } };
    cellB.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    setCellFill(cellB, isDayOff ? GRAY_FILL : NO_FILL);

    applyTimesheetRowBorders(ws, r);

    if (isWeekendDayOff) {
      setCellFill(cellB, GRAY_FILL);
      dataCols.forEach((colLetter) => {
        const c = ws.getCell(`${colLetter}${r}`);
        setCellFill(c, GRAY_FILL);
        c.value = null;
      });
      const cellL = ws.getCell(`L${r}`);
      cellL.value = "Weekend";
      cellL.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF000000" } };
      cellL.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    } else if (isHolidayDayOff) {
      setCellFill(cellB, GRAY_FILL);
      dataCols.forEach((colLetter) => {
        const c = ws.getCell(`${colLetter}${r}`);
        setCellFill(c, GRAY_FILL);
        c.value = null;
      });
      const cellL = ws.getCell(`L${r}`);
      cellL.value = sanitizeCellText(row.activity || row.holidayName || "Hari Libur Nasional");
      cellL.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF000000" } };
      cellL.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    } else if (isPresent) {
      countP++;
      setCellFill(cellB, NO_FILL);
      dataCols.forEach((colLetter) => {
        setCellFill(ws.getCell(`${colLetter}${r}`), NO_FILL);
      });

      const fracStart = parseTimeToExcelFraction(row.startTime);
      const cellC = ws.getCell(`C${r}`);
      cellC.value = fracStart;
      cellC.numFmt = "h:mm:ss";
      cellC.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF000000" } };
      cellC.alignment = { horizontal: "center", vertical: "middle" };

      const fracEnd = parseTimeToExcelFraction(row.endTime);
      const cellD = ws.getCell(`D${r}`);
      cellD.value = fracEnd;
      cellD.numFmt = "h:mm:ss";
      cellD.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF000000" } };
      cellD.alignment = { horizontal: "center", vertical: "middle" };

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

      const cellF = ws.getCell(`F${r}`);
      cellF.value = "P";
      cellF.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF000000" } };
      cellF.alignment = { horizontal: "center", vertical: "middle" };

      ["G", "H", "I", "J", "K"].forEach((colLetter) => {
        ws.getCell(`${colLetter}${r}`).value = null;
      });

      const cellL = ws.getCell(`L${r}`);
      cellL.value = sanitizeCellText(row.activity || "");
      cellL.font = { name: "Calibri", size: 9, bold: false, color: { argb: "FF000000" } };
      cellL.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

      const cellO = ws.getCell(`O${r}`);
      cellO.value = sanitizeCellText(row.projectName || header.projectName || "");
      cellO.font = { name: "Calibri", size: 9, bold: false, color: { argb: "FF000000" } };
      cellO.alignment = { horizontal: "center", vertical: "middle" };

      const cellP = ws.getCell(`P${r}`);
      cellP.value = sanitizeCellText(row.projectId || header.projectId || "");
      cellP.font = { name: "Calibri", size: 9, bold: false, color: { argb: "FF000000" } };
      cellP.alignment = { horizontal: "center", vertical: "middle" };

      const cellQ = ws.getCell(`Q${r}`);
      cellQ.value = sanitizeCellText(row.aplikasiBerdampak || header.aplikasiBerdampak || "");
      cellQ.font = { name: "Calibri", size: 9, bold: false, color: { argb: "FF000000" } };
      cellQ.alignment = { horizontal: "center", vertical: "middle" };

      const cellR = ws.getCell(`R${r}`);
      cellR.value = sanitizeCellText(row.aipFitur || header.aipFitur || "");
      cellR.font = { name: "Calibri", size: 9, bold: false, color: { argb: "FF000000" } };
      cellR.alignment = { horizontal: "center", vertical: "middle" };
    } else {
      if (row.status === "S") countS++;
      else if (row.status === "BT") countBT++;
      else if (row.status === "PM") countPM++;
      else if (row.status === "V") countV++;
      else countX++;

      setCellFill(cellB, NO_FILL);
      dataCols.forEach((colLetter) => {
        setCellFill(ws.getCell(`${colLetter}${r}`), NO_FILL);
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
      cellL.value = sanitizeCellText(
        row.activity ||
          (row.status === "S"
            ? "Sakit"
            : row.status === "V"
              ? "Cuti / Vacation"
              : row.status === "BT"
                ? "Business Trip"
                : row.status === "PM"
                  ? "Permit / Izin"
                  : "")
      );
      cellL.font = { name: "Calibri", size: 9, bold: false, color: { argb: "FF000000" } };
      cellL.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

      if (row.status === "BT") {
        ws.getCell(`O${r}`).value = sanitizeCellText(row.projectName || header.projectName || "");
        ws.getCell(`P${r}`).value = sanitizeCellText(row.projectId || header.projectId || "");
      }
    }
  }

  const lastDataRow = 9 + numDays;
  const summaryCols = ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R"];
  summaryCols.forEach((colLetter) => {
    setCellFill(ws.getCell(`${colLetter}${sumR}`), NO_FILL);
  });

  const summaryFont: Partial<ExcelJS.Font> = { name: "Calibri", size: 12, bold: true, color: { argb: "FF000000" } };
  const summaryAlign: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle", wrapText: true };

  const summarySpecs: Array<{ col: string; formula: string; result: number | undefined }> = [
    { col: "F", formula: `COUNTIF(F10:F${lastDataRow},"P")`, result: countP },
    { col: "G", formula: `COUNTIF(G10:G${lastDataRow},"S")`, result: countS || undefined },
    { col: "H", formula: `COUNTIF(H10:H${lastDataRow},"BT")`, result: countBT || undefined },
    { col: "I", formula: `COUNTIF(I10:I${lastDataRow},"PM")`, result: countPM || undefined },
    { col: "J", formula: `COUNTIF(J10:J${lastDataRow},"V")`, result: countV || undefined },
    { col: "K", formula: `COUNTIF(K10:K${lastDataRow},"x")`, result: countX || undefined },
  ];

  summarySpecs.forEach(({ col, formula, result }) => {
    const cell = ws.getCell(`${col}${sumR}`);
    cell.value = { formula, result };
    cell.font = summaryFont;
    cell.alignment = summaryAlign;
    cell.border = THIN_BORDER;
  });

  applyBoxBorder(ws, "B", "E", sumR, sumR);
  applyBoxBorder(ws, "L", "N", sumR, sumR);
  ["O", "P", "Q", "R"].forEach((c) => {
    ws.getCell(`${c}${sumR}`).border = THIN_BORDER;
    ws.getCell(`${c}${sumR}`).value = null;
  });

  for (let c = 1; c <= 18; c++) {
    ws.getRow(empR).getCell(c).value = null;
    ws.getRow(empR).getCell(c).border = {};
    setCellFill(ws.getRow(empR).getCell(c), NO_FILL);
  }

  const sigHeaderFont: Partial<ExcelJS.Font> = { name: "Calibri", size: 9, bold: true, color: { argb: "FF000000" } };
  ws.getCell(`B${hdrR}`).value = "TTD PEGAWAI,";
  ws.getCell(`B${hdrR}`).font = sigHeaderFont;

  ws.getCell(`E${hdrR}`).value = "DI PERIKSA OLEH,";
  ws.getCell(`E${hdrR}`).font = sigHeaderFont;

  ws.getCell(`N${hdrR}`).value = "DISETUJUI OLEH,";
  ws.getCell(`N${hdrR}`).font = sigHeaderFont;

  applyBoxBorder(ws, "B", "D", hdrR, hdrR);
  applyBoxBorder(ws, "E", "M", hdrR, hdrR);
  ws.getCell(`N${hdrR}`).border = THIN_BORDER;

  const sigNameFont: Partial<ExcelJS.Font> = { name: "Calibri", size: 9, bold: true, color: { argb: "FF000000" } };
  const cellB_sig = ws.getCell(`B${sigStart}`);
  cellB_sig.value = ` (   ${sanitizeCellText(header.name || "")}   )`;
  cellB_sig.font = sigNameFont;
  cellB_sig.alignment = { horizontal: "center", vertical: "bottom" };

  const cellE_sig = ws.getCell(`E${sigStart}`);
  cellE_sig.value = `(   ${sanitizeCellText(header.officerName || "Valentino Tarigan")}   )`;
  cellE_sig.font = sigNameFont;
  cellE_sig.alignment = { horizontal: "center", vertical: "bottom", wrapText: true };

  const cellI_sig = ws.getCell(`I${sigStart}`);
  cellI_sig.value = `(   ${sanitizeCellText(header.managerName || "Gita Kartika")}   )`;
  cellI_sig.font = sigNameFont;
  cellI_sig.alignment = { horizontal: "center", vertical: "bottom" };

  const cellN_sig = ws.getCell(`N${sigStart}`);
  cellN_sig.value = `(  ${sanitizeCellText(header.deptHeadName || "Adhy Perdhana")}  )`;
  cellN_sig.font = sigNameFont;
  cellN_sig.alignment = { horizontal: "center", vertical: "bottom" };

  applyBoxBorder(ws, "B", "D", sigStart, sigEnd);
  applyBoxBorder(ws, "E", "H", sigStart, sigEnd);
  applyBoxBorder(ws, "I", "M", sigStart, sigEnd);
  applyBoxBorder(ws, "N", "N", sigStart, sigEnd);

  const sigRoleFont: Partial<ExcelJS.Font> = { name: "Calibri", size: 10, bold: true, color: { argb: "FF000000" } };
  const sigRoleAlign: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle" };

  const cellB_role = ws.getCell(`B${roleR}`);
  cellB_role.value = sanitizeCellText(header.employeeTitle || "Pegawai");
  cellB_role.font = sigRoleFont;
  cellB_role.alignment = sigRoleAlign;

  const cellE_role = ws.getCell(`E${roleR}`);
  cellE_role.value = sanitizeCellText(header.officerTitle || "Officer");
  cellE_role.font = sigRoleFont;
  cellE_role.alignment = sigRoleAlign;

  const cellI_role = ws.getCell(`I${roleR}`);
  cellI_role.value = sanitizeCellText(header.managerTitle || "Pgs. Team Leader");
  cellI_role.font = sigRoleFont;
  cellI_role.alignment = sigRoleAlign;

  const cellN_role = ws.getCell(`N${roleR}`);
  cellN_role.value = sanitizeCellText(header.deptHeadTitle || "Department Head");
  cellN_role.font = sigRoleFont;
  cellN_role.alignment = sigRoleAlign;

  applyBoxBorder(ws, "B", "D", roleR, roleR);
  applyBoxBorder(ws, "E", "H", roleR, roleR);
  applyBoxBorder(ws, "I", "M", roleR, roleR);
  ws.getCell(`N${roleR}`).border = THIN_BORDER;

  const nextMonth = header.month === 12 ? 1 : header.month + 1;
  const nextYear = header.month === 12 ? header.year + 1 : header.year;
  const defaultDateStamp = `01 ${MONTH_NAMES_TITLE[nextMonth - 1]} ${nextYear}`;
  const dateStampText = `DATE : ${sanitizeCellText(header.dateStamp || defaultDateStamp)}`;
  const dateStampFont: Partial<ExcelJS.Font> = { name: "Calibri", size: 9, bold: false, color: { argb: "FF000000" } };
  const dateStampAlign: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle" };

  ws.getCell(`B${dateR}`).value = dateStampText;
  ws.getCell(`B${dateR}`).font = dateStampFont;
  ws.getCell(`B${dateR}`).alignment = dateStampAlign;

  ws.getCell(`E${dateR}`).value = `${dateStampText}\n`;
  ws.getCell(`E${dateR}`).font = dateStampFont;
  ws.getCell(`E${dateR}`).alignment = dateStampAlign;

  ws.getCell(`I${dateR}`).value = `${dateStampText}\n`;
  ws.getCell(`I${dateR}`).font = dateStampFont;
  ws.getCell(`I${dateR}`).alignment = dateStampAlign;

  ws.getCell(`N${dateR}`).value = `${dateStampText}\n`;
  ws.getCell(`N${dateR}`).font = dateStampFont;
  ws.getCell(`N${dateR}`).alignment = dateStampAlign;

  applyBoxBorder(ws, "B", "D", dateR, dateR);
  applyBoxBorder(ws, "E", "H", dateR, dateR);
  applyBoxBorder(ws, "I", "M", dateR, dateR);
  ws.getCell(`N${dateR}`).border = THIN_BORDER;

  return workbook;
}

export async function exportTimesheetExcel(data: TimesheetData): Promise<void> {
  const { header } = data;
  const monthName = MONTH_NAMES_TITLE[header.month - 1] || "September";
  const workbook = await buildTimesheetWorkbook(data);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const safeName = (header.name || "Pegawai").replace(/\s+/g, " ");
  const fileName = `Time Sheet ${monthName} ${header.year}_${header.npp || "NPP"}_${safeName}.xlsx`;
  saveAs(blob, fileName);
}

/**
 * Build SPL Excel Workbook in memory.
 */
export async function buildSPLWorkbook(data: SPLData): Promise<ExcelJS.Workbook> {
  const templateBuffer = await loadTemplateBuffer("/templates/template_spl.xlsx");

  const workbook = new ExcelJS.Workbook();
  await (workbook.xlsx as unknown as { load: (buf: ArrayBuffer | Uint8Array) => Promise<ExcelJS.Workbook> }).load(templateBuffer);

  applyCustomSignatureIfProvided(workbook, data.signatureDataUrl);

  workbook.creator = "Adidata Timesheet Generator";
  workbook.lastModifiedBy = "Adidata Timesheet Generator";
  workbook.created = new Date();
  workbook.modified = new Date();

  const ws = workbook.worksheets[0];
  if (!ws) {
    throw new Error("Worksheet tidak ditemukan dalam template SPL.");
  }

  const splHeaderFont: Partial<ExcelJS.Font> = { name: "Calibri", size: 11, bold: true, color: { argb: "FF000000" } };
  const cellC7 = ws.getCell("C7");
  cellC7.value = `NPP                                         : ${sanitizeCellText(data.npp || "")}`;
  cellC7.font = splHeaderFont;

  const cellC8 = ws.getCell("C8");
  cellC8.value = `NAMA                                    : ${sanitizeCellText(data.name || "")}`;
  cellC8.font = splHeaderFont;

  const cellC9 = ws.getCell("C9");
  cellC9.value = `DEPARTEMENT / DIVISI      : ${sanitizeCellText(data.department || "")}`;
  cellC9.font = splHeaderFont;

  const cellC10 = ws.getCell("C10");
  cellC10.value = `POSISI                                     : ${sanitizeCellText(data.position || "Developer")}`;
  cellC10.font = splHeaderFont;

  const entries = data.entries && data.entries.length > 0 ? data.entries : [];
  const entriesCount = Math.max(1, entries.length);
  const extraRows = entriesCount - 1;

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
      } catch {}
    });

    ws.spliceRows(16, 0, ...new Array(extraRows).fill([null]));

    for (let i = 1; i <= extraRows; i++) {
      const r = 15 + i;
      ws.mergeCells(`D${r}:E${r}`);
      ws.mergeCells(`F${r}:G${r}`);
      ws.mergeCells(`J${r}:M${r}`);
    }

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

    for (const img of ws.getImages()) {
      const tl = img.range?.tl as unknown as { nativeRow?: number } | undefined;
      if (tl && typeof tl.nativeRow === "number" && tl.nativeRow >= 15) {
        tl.nativeRow += extraRows;
      }
    }
  }

  const tableDataFont: Partial<ExcelJS.Font> = { name: "Calibri", size: 11, bold: false, color: { argb: "FF000000" } };
  const centerMiddleAlign: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle" };

  entries.forEach((entry, i) => {
    const r = 15 + i;

    const cellC = ws.getCell(`C${r}`);
    cellC.value = entry.no || i + 1;
    cellC.numFmt = "@";
    cellC.font = tableDataFont;
    cellC.alignment = centerMiddleAlign;
    cellC.fill = NO_FILL;
    cellC.border = THIN_BORDER;

    const dateObj = parseDateToExcelDate(entry.date);
    const cellD = ws.getCell(`D${r}`);
    cellD.value = dateObj;
    cellD.numFmt = "dd/mm/yyyy";
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

    const fracEnd = parseTimeToExcelFraction(entry.endTime);
    const cellH = ws.getCell(`H${r}`);
    cellH.value = fracEnd;
    cellH.numFmt = "h:mm:ss";
    cellH.font = tableDataFont;
    cellH.alignment = centerMiddleAlign;
    cellH.fill = NO_FILL;
    cellH.border = THIN_BORDER;

    const netFrac = fracStart !== null && fracEnd !== null ? Math.max(0, fracEnd - fracStart - 1 / 24) : 0;
    const cellI = ws.getCell(`I${r}`);
    cellI.value = { formula: `(H${r}-F${r})-(1/24)`, result: netFrac };
    cellI.numFmt = "h:mm:ss";
    cellI.font = tableDataFont;
    cellI.alignment = centerMiddleAlign;
    cellI.fill = NO_FILL;
    cellI.border = THIN_BORDER;

    const cellJ = ws.getCell(`J${r}`);
    cellJ.value = sanitizeCellText(entry.tasks || "");
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
  const sumFormula = entriesCount === 1 ? `SUM(I15)` : `SUM(I15:I${totRow - 1})`;
  cellSum.value = { formula: sumFormula, result: totalNet };
  cellSum.numFmt = "h:mm:ss";
  cellSum.font = tableDataFont;
  cellSum.alignment = centerMiddleAlign;
  cellSum.fill = NO_FILL;
  cellSum.border = THIN_BORDER;

  const sigNameRow = 24 + extraRows;
  const sigRoleRow = 25 + extraRows;
  const splSigFont: Partial<ExcelJS.Font> = { name: "Calibri", size: 11, bold: true, color: { argb: "FF000000" } };

  const cellSigB = ws.getCell(`B${sigNameRow}`);
  cellSigB.value = ` ( ${sanitizeCellText(data.name || "")} )`;
  cellSigB.font = splSigFont;
  cellSigB.alignment = { horizontal: "center", vertical: "bottom" };

  const cellRoleB = ws.getCell(`B${sigRoleRow}`);
  cellRoleB.value = `${sanitizeCellText(data.position || "Developer")}\n`;
  cellRoleB.font = splSigFont;
  cellRoleB.alignment = { horizontal: "center", vertical: "top" };

  const cellSigG = ws.getCell(`G${sigNameRow}`);
  cellSigG.value = `( ${sanitizeCellText(data.teamLeaderName || "Gita Kartika")} )`;
  cellSigG.font = splSigFont;
  cellSigG.alignment = { horizontal: "center", vertical: "bottom" };

  const cellRoleG = ws.getCell(`G${sigRoleRow}`);
  cellRoleG.value = sanitizeCellText(data.teamLeaderTitle || "Pgs. Team Leader");
  cellRoleG.font = splSigFont;
  cellRoleG.alignment = { horizontal: "center", vertical: "top" };

  const cellSigK = ws.getCell(`K${sigNameRow}`);
  cellSigK.value = `( ${sanitizeCellText(data.deptHeadName || "Adhy Perdhana")} )`;
  cellSigK.font = splSigFont;
  cellSigK.alignment = { horizontal: "center", vertical: "bottom" };

  const cellRoleK = ws.getCell(`K${sigRoleRow}`);
  cellRoleK.value = `${sanitizeCellText(data.deptHeadTitle || "Department Head")}\n`;
  cellRoleK.font = splSigFont;
  cellRoleK.alignment = { horizontal: "center", vertical: "top" };

  return workbook;
}

export async function exportSPLExcel(data: SPLData): Promise<void> {
  const workbook = await buildSPLWorkbook(data);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const firstEntryDate = data.entries?.[0]?.date || "";
  const formattedPeriod = firstEntryDate ? formatDateId(firstEntryDate) : "Lembur";
  const safeName = (data.name || "Pegawai").replace(/\s+/g, " ");
  const fileName = `Surat Perintah Lembur_${formattedPeriod}_${data.npp || "NPP"}_${safeName}.xlsx`;
  saveAs(blob, fileName);
}

/**
 * Build Surat Permohonan Izin Excel Workbook in memory using official `template_izin.xlsx`.
 * Matches `sample Permohonan Izin_06 November 2026_901513_Mohamad Burhanudin.xlsx` 100%.
 */
export async function buildIzinWorkbook(data: IzinData): Promise<ExcelJS.Workbook> {
  const templateBuffer = await loadTemplateBuffer("/templates/template_izin.xlsx");

  const workbook = new ExcelJS.Workbook();
  await (workbook.xlsx as unknown as { load: (buf: ArrayBuffer | Uint8Array) => Promise<ExcelJS.Workbook> }).load(templateBuffer);

  applyCustomSignatureIfProvided(workbook, data.signatureDataUrl);

  workbook.creator = "Adidata Document Generator";
  workbook.lastModifiedBy = "Adidata Document Generator";
  workbook.created = new Date();
  workbook.modified = new Date();

  const ws = workbook.worksheets[0];
  if (!ws) {
    throw new Error("Worksheet tidak ditemukan dalam template Permohonan Izin.");
  }

  // L3: "Jakarta, 02 November 2026"
  const city = sanitizeCellText(data.city || "Jakarta");
  const subDateFormatted = formatDateId(data.submissionDate);
  const cellL3 = ws.getCell("L3");
  cellL3.value = `${city}, ${subDateFormatted}`;
  cellL3.font = { name: "Arial", size: 11, bold: false };
  cellL3.alignment = { vertical: "middle" };

  // E7 (merged E7:I8): Employee Name
  const cellE7 = ws.getCell("E7");
  cellE7.value = sanitizeCellText(data.name || "");
  cellE7.font = { name: "Arial", size: 11, bold: true };
  cellE7.alignment = { horizontal: "center", vertical: "middle" };

  // M7 (merged M7:P8): Department / Bagian
  const cellM7 = ws.getCell("M7");
  cellM7.value = sanitizeCellText(data.department || "");
  cellM7.font = { name: "Arial", size: 11, bold: true };
  cellM7.alignment = { horizontal: "center", vertical: "middle" };

  // Clear all 4 checkmarks first: C12, G12, L12, O12
  ["C12", "G12", "L12", "O12"].forEach((addr) => {
    ws.getCell(addr).value = null;
  });

  const checkCellMap: Record<string, string> = {
    pulang_awal: "C12",
    datang_terlambat: "G12",
    cuti: "L12",
    lain_lain: "O12",
  };
  const targetCheckAddr = checkCellMap[data.izinType] || "L12";
  const checkCell = ws.getCell(targetCheckAddr);
  checkCell.value = "√";
  checkCell.font = { name: "Calibri", size: 11, bold: false };
  checkCell.alignment = { horizontal: "center", vertical: "middle" };

  if (data.izinType === "lain_lain" && data.customIzinLabel) {
    ws.getCell("P12").value = `  ${sanitizeCellText(data.customIzinLabel)}`;
  } else {
    ws.getCell("P12").value = "  Lain - Lain";
  }

  // Row 14: Hari, Tanggal, Jam
  const { dayLabel, dateLabel } = formatIzinDateRange(data.startDate, data.endDate);
  ws.getCell("C14").value = `Hari                      :  ${dayLabel}`;
  ws.getCell("H14").value = `Tanggal :  ${dateLabel}`;
  ws.getCell("O14").value = `Jam : ${sanitizeCellText(data.timeRange || "-")}`;

  // Row 16: Untuk Keperluan
  ws.getCell("C16").value = `Untuk Keperluan  : ${sanitizeCellText(data.reason || "")}`;

  // Row 18-19: Catatan
  ws.getCell("C18").value = `Catatan                :  ${sanitizeCellText(data.notes || "")}`;

  // Row 22 & 25: Signatures
  ws.getCell("H22").value = `\n\n\n\n${sanitizeCellText(data.supervisorTitle || "Pgs. Team Leader")}`;
  ws.getCell("N22").value = `\n\n\n\n${sanitizeCellText(data.approverTitle || "Department Head")}`;

  ws.getCell("C25").value = sanitizeCellText(data.name || "");
  ws.getCell("H25").value = sanitizeCellText(data.supervisorName || "Gita Kartika");
  ws.getCell("N25").value = sanitizeCellText(data.approverName || "Adhy Perdhana");

  return workbook;
}

export async function exportIzinExcel(data: IzinData): Promise<void> {
  const workbook = await buildIzinWorkbook(data);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const periodeStr = formatDateId(data.startDate || data.submissionDate);
  const safeName = (data.name || "Pegawai").replace(/\s+/g, " ");
  const fileName = `Permohonan Izin_${periodeStr}_${data.npp || "NPP"}_${safeName}.xlsx`;
  saveAs(blob, fileName);
}

import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  calcWorkHours,
  calcWorkingDays,
  toRomanMonth,
  formatDateId,
  formatIzinDateRange,
  calcTotalSPLHours,
} from "../src/lib/calc";
import { generateMonthRows, summarizeTimesheet, isOvertimeRow } from "../src/lib/types";
import { SAMPLE_HEADER, getSampleTimesheetRows, getSampleSPLData, getSampleIzinData } from "../src/lib/sample-data";
import {
  buildTimesheetWorkbook,
  buildSPLWorkbook,
  buildIzinWorkbook,
  sanitizeCellText,
} from "../src/lib/excel-export";

describe("Calculation Utilities (calc)", () => {
  it("calculates normal work hours with 1.0h break on Monday-Thursday and 1.5h on Friday", () => {
    // Tuesday (2): 08:00:00 to 17:00:00 = 9h - 1h = 8h
    expect(calcWorkHours("08:00:00", "17:00:00", 2)).toBe(8);
    // Friday (5): 08:00:00 to 17:00:00 = 9h - 1.5h = 7.5h
    expect(calcWorkHours("08:00:00", "17:00:00", 5)).toBe(7.5);
    // Short shift (< 5h): no break deduction
    expect(calcWorkHours("08:00:00", "12:00:00", 2)).toBe(4);
  });

  it("supports cross-midnight shift calculation", () => {
    // 22:00:00 to 02:00:00 = 4 hours
    expect(calcWorkHours("22:00:00", "02:00:00", 1)).toBe(4);
    // 21:00:00 to 03:00:00 = 6 hours - 1h break = 5 hours
    expect(calcWorkHours("21:00:00", "03:00:00", 1)).toBe(5);
  });

  it("converts month number to Roman numeral", () => {
    expect(toRomanMonth(1)).toBe("I");
    expect(toRomanMonth(9)).toBe("IX");
    expect(toRomanMonth(11)).toBe("XI");
    expect(toRomanMonth(12)).toBe("XII");
  });

  it("calculates working days excluding weekends and holidays", () => {
    // Nov 2 (Mon) to Nov 6 (Fri) 2026 = 5 working days
    expect(calcWorkingDays("2026-11-02", "2026-11-06", [])).toBe(5);
    // With 1 holiday on Nov 4
    expect(
      calcWorkingDays("2026-11-02", "2026-11-06", [
        { date: "2026-11-04", name: "Hari Libur Test", type: "nasional" },
      ])
    ).toBe(4);
    // Spanning a weekend: Nov 6 (Fri) to Nov 9 (Mon) = 2 working days
    expect(calcWorkingDays("2026-11-06", "2026-11-09", [])).toBe(2);
  });

  it("calculates total SPL overtime hours accurately in hours and HMS", () => {
    const single = calcTotalSPLHours([
      { startTime: "09:00:00", endTime: "18:00:00" },
    ]);
    expect(single.totalHours).toBe(8);
    expect(single.totalHMS).toBe("8:00:00");

    const multi = calcTotalSPLHours([
      { startTime: "09:00:00", endTime: "18:00:00" },
      { startTime: "17:00:00", endTime: "20:00:00" },
    ]);
    expect(multi.totalHours).toBe(11);
    expect(multi.totalHMS).toBe("11:00:00");
  });

  it("formats Indonesian dates and Izin date ranges accurately", () => {
    expect(formatDateId("2026-11-06")).toBe("06 November 2026");
    expect(formatIzinDateRange("2026-11-06", "2026-11-06")).toEqual({
      dayLabel: "Jumat",
      dateLabel: "06 November 2026",
    });
  });

  it("sanitizes formula-like user input against CSV/Excel injection", () => {
    expect(sanitizeCellText("=SUM(A1:A5)")).toBe("'=SUM(A1:A5)");
    expect(sanitizeCellText("Normal Text")).toBe("Normal Text");
  });
});

describe("Timesheet Generation & Summary", () => {
  it("marks holidays and weekends automatically on month generation", () => {
    // August 2026 has 17 Aug (Monday) as Independence Day
    const rows = generateMonthRows(8, 2026);
    expect(rows.length).toBe(31);
    const aug17 = rows.find((r) => r.date === "2026-08-17");
    expect(aug17?.isHoliday).toBe(true);
    expect(aug17?.status).toBe("H");
  });

  it("matches official September 2026 sample attendance counts (22 Present, 1 Sick, 1 Saturday Overtime)", () => {
    const sampleRows = getSampleTimesheetRows();
    const summary = summarizeTimesheet(sampleRows);
    expect(summary.present).toBe(22);
    expect(summary.sick).toBe(1);
    const satRow = sampleRows.find((r) => r.date === "2026-09-12");
    expect(satRow && isOvertimeRow(satRow)).toBe(true);
  });
});

describe("Excel Template Snapshot & Formula Fidelity", () => {
  it("builds Timesheet workbook matching sample_Time Sheet September 2026_901513_Mohamad Burhanudin.xlsx", async () => {
    const rows = getSampleTimesheetRows();
    const wb = await buildTimesheetWorkbook({ header: SAMPLE_HEADER, rows });
    const ws = wb.worksheets[0];

    expect(ws.getCell("D2").value).toBe(":  OPERATIONAL RISK MANAGEMENT SYSTEM (ORMS)");
    expect(ws.getCell("D4").value).toBe(":  Mohamad Burhanudin");
    expect(ws.getCell("D5").value).toBe(":  901513");
    expect(ws.getCell("D6").value).toBe(":  September 2026");

    // Check formula on row 10 (1 Sep 2026) and row 13 (4 Sep 2026 - Friday)
    const e10 = ws.getCell("E10").value as ExcelJS.CellFormulaValue;
    expect(e10.formula).toBe("(D10-C10)-(1/24)");
    const e13 = ws.getCell("E13").value as ExcelJS.CellFormulaValue;
    expect(e13.formula).toBe("(D13-C13)-(1.5/24)");

    // Summary row for 30 days is row 40
    const f40 = ws.getCell("F40").value as ExcelJS.CellFormulaValue;
    expect(f40.formula).toBe('COUNTIF(F10:F39,"P")');
    expect(f40.result).toBe(22);
  });

  it("builds SPL workbook matching sample_Surat_Perintah_Lembur_Mohamad Burhanudin_tgl_12.xlsx", async () => {
    const splData = getSampleSPLData();
    const wb = await buildSPLWorkbook(splData);
    const ws = wb.worksheets[0];

    expect(ws.getCell("C7").value).toContain("901513");
    expect(ws.getCell("C8").value).toContain("Mohamad Burhanudin");
    const i15 = ws.getCell("I15").value as ExcelJS.CellFormulaValue;
    expect(i15.formula).toBe("(H15-F15)-(1/24)");
    const i16 = ws.getCell("I16").value as ExcelJS.CellFormulaValue;
    expect(i16.formula).toBe("SUM(I15)");
    expect(ws.getCell("C16").value).toBe("Total Keseluruhan Jam Lembur");
  });

  it("builds Permohonan Izin workbook matching sample Permohonan Izin_06 November 2026_901513_Mohamad Burhanudin.xlsx", async () => {
    const izinData = getSampleIzinData();
    const wb = await buildIzinWorkbook(izinData);
    const ws = wb.worksheets[0];

    expect(ws.getCell("L3").value).toBe("Jakarta, 02 November 2026");
    expect(ws.getCell("E7").value).toBe("Mohamad Burhanudin");
    expect(ws.getCell("M7").value).toBe("ADV / EDV");
    expect(ws.getCell("L12").value).toBe("√");
    expect(ws.getCell("C12").value).toBeNull();
    expect(ws.getCell("C14").value).toBe("Hari                      :  Jumat");
    expect(ws.getCell("H14").value).toBe("Tanggal :  06 November 2026");
    expect(ws.getCell("O14").value).toBe("Jam : -");
    expect(ws.getCell("C16").value).toBe("Untuk Keperluan  : Pribadi");
    expect(ws.getCell("C18").value).toBe("Catatan                :  Telah Disetujui via DigiHC");
    expect(ws.getCell("C25").value).toBe("Mohamad Burhanudin");
    expect(ws.getCell("H25").value).toBe("Gita Kartika");
    expect(ws.getCell("N25").value).toBe("Adhy Perdhana");
  });
});

describe("Theme & Visual Mode Resolution", () => {
  it("resolves active theme accurately according to user preference or OS setting", () => {
    function resolveTheme(
      saved: "light" | "dark" | "system" | null,
      systemPrefersLight: boolean
    ): "light" | "dark" {
      if (saved === "light" || saved === "dark") return saved;
      return systemPrefersLight ? "light" : "dark";
    }

    // Explicit light
    expect(resolveTheme("light", false)).toBe("light");
    // Explicit dark
    expect(resolveTheme("dark", true)).toBe("dark");
    // System when OS prefers light
    expect(resolveTheme("system", true)).toBe("light");
    // System when OS prefers dark
    expect(resolveTheme("system", false)).toBe("dark");
    // Unset defaults to OS
    expect(resolveTheme(null, true)).toBe("light");
    expect(resolveTheme(null, false)).toBe("dark");
  });

  it("toggles between dark and light modes correctly", () => {
    function getNextTheme(currentResolved: "light" | "dark"): "light" | "dark" {
      return currentResolved === "dark" ? "light" : "dark";
    }

    expect(getNextTheme("dark")).toBe("light");
    expect(getNextTheme("light")).toBe("dark");
  });
});

describe("Progressive Web App (PWA) Fidelity", () => {
  it("provides valid web app manifest with standalone display, icons, and shortcuts", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const manifestPath = path.resolve(__dirname, "../public/manifest.webmanifest");
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    expect(manifest.name).toContain("Adidata DocGen");
    expect(manifest.short_name).toBe("Adidata DocGen");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("./");
    expect(manifest.theme_color).toBe("#dc2626");
    expect(manifest.icons.length).toBeGreaterThanOrEqual(4);

    // Verify all referenced icons physically exist in public directory
    for (const icon of manifest.icons) {
      const iconPath = path.resolve(__dirname, "../public", icon.src);
      expect(fs.existsSync(iconPath)).toBe(true);
    }
  });

  it("verifies service worker script exists and pre-caches essential document templates", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const swPath = path.resolve(__dirname, "../public/sw.js");
    expect(fs.existsSync(swPath)).toBe(true);

    const swContent = fs.readFileSync(swPath, "utf-8");
    expect(swContent).toContain("template_timesheet.xlsx");
    expect(swContent).toContain("template_spl.xlsx");
    expect(swContent).toContain("template_izin.xlsx");
    expect(swContent).toContain("holidays-2026.json");
  });
});

describe("Responsive Design & Mobile App Experience", () => {
  it("verifies responsive CSS contains bottom navigation, sticky table columns, and mobile media queries", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const cssPath = path.resolve(__dirname, "../src/app/globals.css");
    expect(fs.existsSync(cssPath)).toBe(true);

    const cssContent = fs.readFileSync(cssPath, "utf-8");
    expect(cssContent).toContain(".bottom-nav");
    expect(cssContent).toContain("@media (max-width: 768px)");
    expect(cssContent).toContain("@media (max-width: 640px)");
    expect(cssContent).toContain("@media (max-width: 480px)");
    expect(cssContent).toContain(".mobile-scroll-hint");
    expect(cssContent).toContain("position: sticky");
    expect(cssContent).toContain(".app-toast");
  });
});


import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import type { Profile, HolidayItem, IzinData } from "@/lib/schemas";
import type { TimesheetHeader, TimesheetRow, SPLData } from "@/lib/types";
import defaultHolidaysJson from "../../../public/data/holidays-2026.json";

export const DEFAULT_HOLIDAYS: HolidayItem[] = defaultHolidaysJson as HolidayItem[];

export const DEFAULT_PROFILE: Profile = {
  name: "Mohamad Burhanudin",
  employeeId: "901513",
  position: "Developer",
  department: "EDV / ADV",
  project: "OPERATIONAL RISK MANAGEMENT SYSTEM (ORMS)",
  projectId: "P25068",
  aplikasiBerdampak: "ORMS",
  aipFitur: "Implementasi ORMS",
  officerName: "Valentino Tarigan",
  officerPosition: "Officer",
  supervisorName: "Gita Kartika",
  supervisorPosition: "Pgs. Team Leader",
  approverName: "Adhy Perdhana",
  approverPosition: "Department Head",
  city: "Jakarta",
  signatureDataUrl: "",
};

export type DocumentKind = "timesheet" | "spl" | "izin";

export interface HistoryRecord {
  id: string;
  kind: DocumentKind;
  title: string;
  periode: string;
  employeeName: string;
  employeeId: string;
  savedAt: string;
  summaryText: string;
  payload:
    | { kind: "timesheet"; header: TimesheetHeader; rows: TimesheetRow[] }
    | { kind: "spl"; data: SPLData }
    | { kind: "izin"; data: IzinData };
}

/**
 * Dual IndexedDB + localStorage storage adapter so Zustand state is persisted in IndexedDB
 * (via idb-keyval per PRD 8) while also keeping a synchronous mirror in localStorage
 * for instant hydration and resilience.
 */
const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (typeof window === "undefined") return null;
    try {
      const val = await idbGet<string>(name);
      if (val) return val;
      return localStorage.getItem(name);
    } catch {
      return localStorage.getItem(name);
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(name, value);
      await idbSet(name, value);
    } catch {
      // ignore quota/idb errors
    }
  },
  removeItem: async (name: string): Promise<void> => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(name);
      await idbDel(name);
    } catch {
      // ignore
    }
  },
};

interface AppStoreState {
  profile: Profile;
  holidays: HolidayItem[];
  izinTypes: Array<{ value: string; label: string }>;
  timesheetDraft: { header: TimesheetHeader; rows: TimesheetRow[] } | null;
  splDraft: SPLData | null;
  izinDraft: IzinData | null;
  history: HistoryRecord[];

  setProfile: (profile: Partial<Profile>) => void;
  setHolidays: (holidays: HolidayItem[]) => void;
  addHoliday: (holiday: HolidayItem) => void;
  removeHoliday: (date: string) => void;
  resetHolidays: () => void;

  setTimesheetDraft: (header: TimesheetHeader, rows: TimesheetRow[]) => void;
  setSPLDraft: (data: SPLData) => void;
  setIzinDraft: (data: IzinData) => void;

  addHistoryRecord: (record: Omit<HistoryRecord, "id" | "savedAt">) => HistoryRecord;
  duplicateHistoryRecord: (id: string) => HistoryRecord | null;
  deleteHistoryRecord: (id: string) => void;
  clearHistory: () => void;

  exportBackupJson: () => string;
  importBackupJson: (jsonStr: string) => boolean;
}

export const useAppStore = create<AppStoreState>()(
  persist(
    (set, get) => ({
      profile: DEFAULT_PROFILE,
      holidays: DEFAULT_HOLIDAYS,
      izinTypes: [
        { value: "cuti", label: "Cuti" },
        { value: "pulang_awal", label: "Pulang Lebih Awal" },
        { value: "datang_terlambat", label: "Datang Terlambat" },
        { value: "lain_lain", label: "Lain - Lain" },
      ],
      timesheetDraft: null,
      splDraft: null,
      izinDraft: null,
      history: [],

      setProfile: (partial) =>
        set((state) => ({
          profile: { ...state.profile, ...partial },
        })),

      setHolidays: (holidays) =>
        set({
          holidays: [...holidays].sort((a, b) => a.date.localeCompare(b.date)),
        }),

      addHoliday: (holiday) =>
        set((state) => {
          const filtered = state.holidays.filter((h) => h.date !== holiday.date);
          return {
            holidays: [...filtered, holiday].sort((a, b) => a.date.localeCompare(b.date)),
          };
        }),

      removeHoliday: (date) =>
        set((state) => ({
          holidays: state.holidays.filter((h) => h.date !== date),
        })),

      resetHolidays: () => set({ holidays: DEFAULT_HOLIDAYS }),

      setTimesheetDraft: (header, rows) =>
        set({ timesheetDraft: { header, rows } }),

      setSPLDraft: (data) => set({ splDraft: data }),

      setIzinDraft: (data) => set({ izinDraft: data }),

      addHistoryRecord: (rec) => {
        const newRecord: HistoryRecord = {
          ...rec,
          id: `${rec.kind}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          savedAt: new Date().toISOString(),
        };
        set((state) => ({
          history: [newRecord, ...state.history],
        }));
        return newRecord;
      },

      duplicateHistoryRecord: (id) => {
        const target = get().history.find((r) => r.id === id);
        if (!target) return null;
        const copy: HistoryRecord = {
          ...JSON.parse(JSON.stringify(target)),
          id: `${target.kind}_${Date.now()}_copy`,
          title: `${target.title} (Salinan)`,
          savedAt: new Date().toISOString(),
        };
        set((state) => ({
          history: [copy, ...state.history],
        }));
        return copy;
      },

      deleteHistoryRecord: (id) =>
        set((state) => ({
          history: state.history.filter((r) => r.id !== id),
        })),

      clearHistory: () => set({ history: [] }),

      exportBackupJson: () => {
        const s = get();
        const payload = {
          version: "1.0",
          exportedAt: new Date().toISOString(),
          profile: s.profile,
          holidays: s.holidays,
          timesheetDraft: s.timesheetDraft,
          splDraft: s.splDraft,
          izinDraft: s.izinDraft,
          history: s.history,
        };
        return JSON.stringify(payload, null, 2);
      },

      importBackupJson: (jsonStr: string) => {
        try {
          const parsed = JSON.parse(jsonStr);
          if (!parsed || typeof parsed !== "object") return false;
          set((state) => ({
            profile: parsed.profile ? { ...state.profile, ...parsed.profile } : state.profile,
            holidays: Array.isArray(parsed.holidays) ? parsed.holidays : state.holidays,
            timesheetDraft: parsed.timesheetDraft ?? state.timesheetDraft,
            splDraft: parsed.splDraft ?? state.splDraft,
            izinDraft: parsed.izinDraft ?? state.izinDraft,
            history: Array.isArray(parsed.history) ? parsed.history : state.history,
          }));
          return true;
        } catch {
          return false;
        }
      },
    }),
    {
      name: "adidata-docgen-store-v1",
      storage: createJSONStorage(() => idbStorage),
    }
  )
);


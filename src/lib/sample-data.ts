import type { TimesheetHeader, TimesheetRow, AttendanceStatus, SPLData } from "./types";
import type { IzinData } from "./schemas";
import { calcHours, formatTimeWithSeconds, DAY_NAMES_ID } from "./types";

export const SAMPLE_HEADER: TimesheetHeader = {
  projectName: "OPERATIONAL RISK MANAGEMENT SYSTEM (ORMS)",
  department: "EDV / ADV",
  name: "Mohamad Burhanudin",
  npp: "901513",
  periode: "September 2026",
  month: 9,
  year: 2026,
  employeeTitle: "Developer",
  officerName: "Valentino Tarigan",
  officerTitle: "Officer",
  managerName: "Gita Kartika",
  managerTitle: "Pgs. Team Leader",
  deptHeadName: "Adhy Perdhana",
  deptHeadTitle: "Department Head",
  projectId: "P25068",
  aplikasiBerdampak: "ORMS",
  aipFitur: "Implementasi ORMS",
  dateStamp: "01 Oktober 2026",
};

export const RAW_SAMPLE_ROWS: Array<{
  day: number;
  start: string;
  end: string;
  status: AttendanceStatus;
  activity: string;
}> = [
  { day: 1, start: "07:39:43", end: "17:09:17", status: "P", activity: "Perbaikan DAST, Perbaikan Defect CR60131 - Integrasi LDAP Active Directory" },
  { day: 2, start: "07:39:34", end: "17:09:25", status: "P", activity: "Perbaikan DAST, Perbaikan Defect CR60131 - Integrasi LDAP Active Directory" },
  { day: 3, start: "07:30:20", end: "17:08:58", status: "P", activity: "Perbaikan Defect CR60131 - Integrasi LDAP Active Directory,\nPerbaikan Defect CR60132 - Login & Security Management" },
  { day: 4, start: "07:23:06", end: "17:09:15", status: "P", activity: "Perbaikan Defect CR60131 - Integrasi LDAP Active Directory,\nMigrasi database ORMS" },
  { day: 5, start: "", end: "", status: "X", activity: "Weekend" },
  { day: 6, start: "", end: "", status: "X", activity: "Weekend" },
  { day: 7, start: "07:59:02", end: "18:00:42", status: "P", activity: "Pengembangan [TPRM] Identifikasi Pihak Ketiga (Formulir B), Perbaikan Defect CR60131 - Integrasi LDAP Active Directory" },
  { day: 8, start: "07:38:40", end: "17:06:19", status: "P", activity: "Pengembangan [TPRM] Identifikasi Pihak Ketiga (Formulir B), Perbaikan Defect CR60141 - [CIP] Monitoring & Tindak Lanjut" },
  { day: 9, start: "07:45:26", end: "17:11:40", status: "P", activity: "Pengembangan [TPRM] Identifikasi Pihak Ketiga (Formulir B), Perbaikan Defect CR60131 - Integrasi LDAP Active DirectoryCR60131 - Integrasi LDAP Active Directory" },
  { day: 10, start: "07:35:42", end: "17:19:11", status: "P", activity: "Pengembangan [TPRM] Identifikasi Pihak Ketiga (Formulir B), Perbaikan Defect CR60141 - [CIP] Monitoring & Tindak Lanjut" },
  { day: 11, start: "07:23:02", end: "18:00:00", status: "P", activity: "Pengembangan [TPRM] Identifikasi Pihak Ketiga (Formulir B)" },
  { day: 12, start: "09:54:03", end: "18:56:42", status: "P", activity: "Support SIT, Perbaikan Defect CR60137 - [KRI] Pencatatan Input & Penugasan,\nCR60138 - [KRI] Monitoring & Tindak Lanjut" }, // Lembur Sabtu
  { day: 13, start: "", end: "", status: "X", activity: "Weekend" },
  { day: 14, start: "07:49:07", end: "17:14:09", status: "P", activity: "Tunning CR60141 - [CIP] Monitoring & Tindak Lanjut" },
  { day: 15, start: "07:43:22", end: "17:11:02", status: "P", activity: "Perbaikan defect CR60141 - [CIP] Monitoring & Tindak Lanjut,\nPerbaikan defect CR60131 - Integrasi LDAP Active Directory" },
  { day: 16, start: "07:45:03", end: "17:25:43", status: "P", activity: "Perbaikan defect dan tunning CR60141 - [CIP] Monitoring & Tindak Lanjut" },
  { day: 17, start: "07:48:13", end: "17:29:39", status: "P", activity: "Pengembangan [TPRM] Identifikasi Pihak Ketiga (Formulir B)" },
  { day: 18, start: "07:21:55", end: "17:24:11", status: "P", activity: "Perbaikan defect CR60133 - Administration Management" },
  { day: 19, start: "", end: "", status: "X", activity: "Weekend" },
  { day: 20, start: "", end: "", status: "X", activity: "Weekend" },
  { day: 21, start: "07:46:49", end: "17:21:45", status: "P", activity: "Tunning CR60141 - [CIP] Monitoring & Tindak Lanjut,\nPengembangan [TPRM] Identifikasi Pihak Ketiga (Formulir B)" },
  { day: 22, start: "07:42:06", end: "17:10:33", status: "P", activity: "Perbaikan defect CR60141 - [CIP] Monitoring & Tindak Lanjut" },
  { day: 23, start: "07:43:09", end: "17:21:35", status: "P", activity: "Tunning CR60131 - Integrasi LDAP Active Directory" },
  { day: 24, start: "07:38:52", end: "17:08:23", status: "P", activity: "Pengembangan [TPRM] Identifikasi Pihak Ketiga (Formulir B)" },
  { day: 25, start: "07:19:09", end: "17:48:36", status: "P", activity: "Pengembangan [TPRM] Identifikasi Pihak Ketiga (Formulir B),\nPerbaikan defect CR60142 - [CIP] Reporting" },
  { day: 26, start: "", end: "", status: "X", activity: "Weekend" },
  { day: 27, start: "", end: "", status: "X", activity: "Weekend" },
  { day: 28, start: "", end: "", status: "S", activity: "Sakit" },
  { day: 29, start: "07:46:57", end: "17:05:26", status: "P", activity: "Pengembangan [TPRM] Identifikasi Pihak Ketiga (Formulir B)" },
  { day: 30, start: "07:42:22", end: "17:06:04", status: "P", activity: "Pengembangan [TPRM] Identifikasi Pihak Ketiga (Formulir B)" },
];

export function getSampleTimesheetRows(): TimesheetRow[] {
  return RAW_SAMPLE_ROWS.map((item) => {
    const dateStr = `2026-09-${String(item.day).padStart(2, "0")}`;
    const date = new Date(2026, 8, item.day);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const startTime = formatTimeWithSeconds(item.start);
    const endTime = formatTimeWithSeconds(item.end);

    const totalHours =
      item.status === "P" && startTime && endTime
        ? calcHours(startTime, endTime, dayOfWeek)
        : 0;

    return {
      id: dateStr,
      date: dateStr,
      dayName: DAY_NAMES_ID[dayOfWeek],
      startTime,
      endTime,
      totalHours,
      status: item.status,
      activity: item.activity,
      projectName: item.status === "P" ? SAMPLE_HEADER.projectName : "",
      projectId: item.status === "P" ? SAMPLE_HEADER.projectId : "",
      aplikasiBerdampak: item.status === "P" ? SAMPLE_HEADER.aplikasiBerdampak : "",
      aipFitur: item.status === "P" ? SAMPLE_HEADER.aipFitur : "",
      isWeekend,
      isHoliday: false,
    };
  });
}

export function getSampleSPLData(): SPLData {
  return {
    npp: "901513",
    name: "Mohamad Burhanudin",
    department: "EDV / ADV",
    position: "Developer",
    teamLeaderName: "Gita Kartika",
    teamLeaderTitle: "Pgs. Team Leader",
    deptHeadName: "Adhy Perdhana",
    deptHeadTitle: "Department Head",
    entries: [
      {
        no: 1,
        date: "2026-09-12",
        startTime: "09:54:03",
        endTime: "18:56:42",
        tasks:
          "1. Support SIT\n2. Perbaikan Defect CR60137 - [KRI] Pencatatan Input & Penugasan\n3. Perbaikan Defect CR60138 - [KRI] Monitoring & Tindak Lanjut",
      },
    ],
  };
}

export function getSampleIzinData(): IzinData {
  return {
    npp: "901513",
    name: "Mohamad Burhanudin",
    department: "ADV / EDV",
    position: "Developer",
    city: "Jakarta",
    submissionDate: "2026-11-02",
    izinType: "cuti",
    customIzinLabel: "",
    startDate: "2026-11-06",
    endDate: "2026-11-06",
    timeRange: "-",
    workingDaysCount: 1,
    reason: "Pribadi",
    notes: "Telah Disetujui via DigiHC",
    supervisorName: "Gita Kartika",
    supervisorTitle: "Pgs. Team Leader",
    approverName: "Adhy Perdhana",
    approverTitle: "Department Head",
  };
}

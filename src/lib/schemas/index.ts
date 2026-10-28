import { z } from "zod";

export const HolidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
  name: z.string().min(1, "Nama hari libur wajib diisi"),
  type: z.enum(["nasional", "cuti_bersama"]),
});

export type HolidayItem = z.infer<typeof HolidaySchema>;

export const ProfileSchema = z.object({
  name: z.string().min(1, "Nama karyawan wajib diisi"),
  employeeId: z.string().min(1, "NPP / ID karyawan wajib diisi"),
  position: z.string().min(1, "Jabatan wajib diisi"),
  department: z.string().min(1, "Departemen / Divisi wajib diisi"),
  project: z.string().optional(),
  projectId: z.string().optional(),
  aplikasiBerdampak: z.string().optional(),
  aipFitur: z.string().optional(),
  officerName: z.string().optional(),
  officerPosition: z.string().optional(),
  supervisorName: z.string().min(1, "Nama atasan langsung wajib diisi"),
  supervisorPosition: z.string().min(1, "Jabatan atasan wajib diisi"),
  approverName: z.string().optional(),
  approverPosition: z.string().optional(),
  city: z.string().min(1, "Kota penandatanganan wajib diisi"),
  signatureDataUrl: z.string().optional(),
});

export type Profile = z.infer<typeof ProfileSchema>;

export const AttendanceStatusSchema = z.enum(["P", "S", "V", "BT", "PM", "X", "H"]);

export const TimesheetRowSchema = z
  .object({
    id: z.string(),
    date: z.string(),
    dayName: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    totalHours: z.number().min(0).max(24, "Total jam per hari tidak boleh melebihi 24 jam"),
    status: AttendanceStatusSchema,
    activity: z.string().max(500, "Uraian maksimal 500 karakter"),
    projectName: z.string(),
    projectId: z.string(),
    aplikasiBerdampak: z.string().optional(),
    aipFitur: z.string().optional(),
    isWeekend: z.boolean(),
    isHoliday: z.boolean(),
    holidayName: z.string().optional(),
    isOvertime: z.boolean().optional(),
    overtimeStartTime: z.string().optional(),
    overtimeEndTime: z.string().optional(),
  })
  .refine(
    (row) => {
      if (row.status === "P" && row.startTime && row.endTime) {
        return row.endTime > row.startTime;
      }
      return true;
    },
    { message: "Jam keluar harus setelah jam masuk", path: ["endTime"] }
  );

export const TimesheetHeaderSchema = z.object({
  projectName: z.string().min(1, "Nama proyek wajib diisi"),
  department: z.string().min(1, "Departemen wajib diisi"),
  name: z.string().min(1, "Nama wajib diisi"),
  npp: z.string().min(1, "NPP wajib diisi"),
  periode: z.string(),
  month: z.number().min(1).max(12),
  year: z.number().min(2020).max(2100),
  employeeTitle: z.string(),
  officerName: z.string(),
  officerTitle: z.string(),
  managerName: z.string(),
  managerTitle: z.string(),
  deptHeadName: z.string(),
  deptHeadTitle: z.string(),
  projectId: z.string(),
  aplikasiBerdampak: z.string(),
  aipFitur: z.string(),
  dateStamp: z.string(),
  signatureDataUrl: z.string().optional(),
});

export const TimesheetDocumentSchema = z
  .object({
    header: TimesheetHeaderSchema,
    rows: z.array(TimesheetRowSchema),
  })
  .refine(
    (doc) => {
      const dates = doc.rows.map((r) => r.date);
      return new Set(dates).size === dates.length;
    },
    { message: "Tidak boleh ada tanggal ganda dalam satu periode", path: ["rows"] }
  );

export const SPLEntrySchema = z
  .object({
    no: z.number().int().positive(),
    date: z.string().min(1, "Tanggal lembur wajib diisi"),
    startTime: z.string().min(1, "Jam mulai wajib diisi"),
    endTime: z.string().min(1, "Jam selesai wajib diisi"),
    totalHours: z.number().optional(),
    tasks: z.string().min(1, "Uraian pekerjaan wajib diisi").max(600, "Maksimal 600 karakter"),
    workerName: z.string().optional(),
    workerNpp: z.string().optional(),
  })
  .refine((entry) => !entry.startTime || !entry.endTime || entry.endTime > entry.startTime, {
    message: "Jam selesai harus setelah jam mulai",
    path: ["endTime"],
  });

export const SPLDataSchema = z.object({
  npp: z.string().min(1, "NPP wajib diisi"),
  name: z.string().min(1, "Nama wajib diisi"),
  department: z.string().min(1, "Departemen wajib diisi"),
  position: z.string().min(1, "Posisi wajib diisi"),
  entries: z.array(SPLEntrySchema).min(1, "Minimal 1 baris lembur").max(20, "Maksimal 20 baris per surat"),
  teamLeaderName: z.string().min(1, "Nama pemberi perintah wajib diisi"),
  teamLeaderTitle: z.string().min(1, "Jabatan pemberi perintah wajib diisi"),
  deptHeadName: z.string().min(1, "Nama penyetuju wajib diisi"),
  deptHeadTitle: z.string().min(1, "Jabatan penyetuju wajib diisi"),
  signatureDataUrl: z.string().optional(),
});

export const IzinTypeSchema = z.enum([
  "pulang_awal",
  "datang_terlambat",
  "cuti",
  "lain_lain",
]);

export type IzinType = z.infer<typeof IzinTypeSchema>;

export const IzinDataSchema = z
  .object({
    npp: z.string().min(1, "NPP wajib diisi"),
    name: z.string().min(1, "Nama pemohon wajib diisi"),
    department: z.string().min(1, "Bagian / Departemen wajib diisi"),
    position: z.string().optional(),
    city: z.string().min(1, "Kota penandatanganan wajib diisi"),
    submissionDate: z.string().min(1, "Tanggal surat wajib diisi"),
    izinType: IzinTypeSchema,
    customIzinLabel: z.string().optional(),
    startDate: z.string().min(1, "Tanggal mulai wajib diisi"),
    endDate: z.string().min(1, "Tanggal selesai wajib diisi"),
    timeRange: z.string().min(1, "Jam izin wajib diisi (misal '-' atau '08:00:00 - 17:00:00')"),
    workingDaysCount: z.number().min(1, "Minimal 1 hari kerja"),
    reason: z.string().min(1, "Alasan / keperluan wajib diisi").max(200, "Maksimal 200 karakter"),
    notes: z.string().max(250, "Maksimal 250 karakter"),
    supervisorName: z.string().min(1, "Nama atasan langsung wajib diisi"),
    supervisorTitle: z.string().min(1, "Jabatan atasan wajib diisi"),
    approverName: z.string().min(1, "Nama penyetuju (Dept Head/HRD) wajib diisi"),
    approverTitle: z.string().min(1, "Jabatan penyetuju wajib diisi"),
    signatureDataUrl: z.string().optional(),
  })
  .refine((d) => !d.startDate || !d.endDate || d.endDate >= d.startDate, {
    message: "Tanggal selesai harus sama atau setelah tanggal mulai",
    path: ["endDate"],
  });

export type IzinData = z.infer<typeof IzinDataSchema>;


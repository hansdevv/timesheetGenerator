# PRD: Timesheet & Dokumen Lembur/Izin Generator

| Item | Nilai |
|---|---|
| Versi | 0.1 |
| Tanggal | 28 Oktober 2026 |
| Status | Untuk review |
| Hosting | GitHub Pages (static) |
| Stack | Next.js (App Router, static export), Tailwind CSS 4.1, TypeScript |

---

## 1. Ringkasan

Webapp client-side untuk menghasilkan tiga dokumen administrasi kerja dari template Excel yang sudah ada:

1. **Timesheet** bulanan
2. **SPL** (Surat Perintah Lembur)
3. **Surat Permohonan Izin** (cuti, izin, dll)

Setiap dokumen bisa diekspor ke **Excel (.xlsx)** dan **PDF** dengan format yang sama seperti template. Seluruh proses berjalan di browser, tanpa backend dan tanpa database.

## 2. Latar Belakang & Masalah

- Timesheet, SPL, dan surat izin saat ini diisi manual di Excel setiap periode.
- Pengisian berulang (identitas, atasan, proyek) rawan salah ketik dan format bergeser.
- Hitung jam lembur, total jam, dan hari kerja dilakukan manual.
- Konversi ke PDF kadang mengubah layout.

## 3. Tujuan & Non-Tujuan

### Tujuan
- Mengisi form sekali, menghasilkan dokumen siap kirim dalam kurang dari 1 menit.
- Output Excel identik dengan template (merge cell, border, font, lebar kolom, print area tetap).
- Output PDF visual setara template, ukuran halaman sesuai template.
- Data tidak keluar dari perangkat pengguna.
- Biaya hosting nol.

### Non-Tujuan (v1)
- Login, multi-user, atau sinkronisasi antar perangkat.
- Alur approval atau tanda tangan digital tersertifikasi.
- Integrasi HRIS/payroll.
- Pengiriman email otomatis.
- Editor template di dalam aplikasi.

## 4. Target Pengguna

| Persona | Kebutuhan |
|---|---|
| Karyawan | Mengisi timesheet bulanan, mengajukan lembur dan izin |
| Admin/atasan langsung | Menerima file rapi dan konsisten untuk diarsipkan |

Pengguna utama v1: individu (satu profil per browser).

## 5. Scope Fitur

### 5.1 Profil & Pengaturan (dipakai semua dokumen)
- Nama, NIK/ID karyawan, jabatan, departemen/divisi, proyek/klien default.
- Nama dan jabatan atasan, nama penyetuju (HRD/Manager).
- Kota penandatanganan default.
- Opsional: unggah gambar tanda tangan (PNG) disimpan lokal.
- Daftar hari libur nasional dan cuti bersama (JSON statis, bisa diedit pengguna).

### 5.2 Timesheet
- Input: periode (bulan/tahun), data karyawan, proyek/klien, daftar entri harian (tanggal, jam masuk, jam keluar, uraian pekerjaan, nama proyek).
- Tanggal diisi otomatis sesuai kalender bulan terpilih. Akhir pekan dan libur nasional ditandai.
- Total jam per hari dan per bulan dihitung otomatis.
- Mode input: tabel yang bisa diedit (seperti spreadsheet), dengan opsi "isi massal" (misalnya Senin–Jumat 08:00:00–17:00:00).
- Validasi: jam keluar harus setelah jam masuk, tidak ada tanggal ganda, dan total jam per hari tidak melebihi 24.

### 5.3 SPL (Surat Perintah Lembur)
- Per baris: tanggal lembur, jam mulai, jam selesai, durasi (otomatis), uraian pekerjaan.
- Blok tanda tangan: pemberi perintah, pekerja, penyetuju.
- Opsi: tarik data lembur dari timesheet yang sudah diisi.

### 5.4 Surat Permohonan Izin
- Jenis: cuti, pulang lebih awal, datang terlambat,lainnya, izin lainnya (daftar jenis bisa dikonfigurasi).
- Input: data pemohon, jenis izin, tanggal mulai dan selesai, jam izin (misal 08:00:00–17:00:00), alasan (untuk keperluan), catatan.
- Teks surat memakai kalimat baku dari template; hanya bagian variabel yang diganti.
- Blok tanda tangan: pemohon, atasan.

### 5.5 Ekspor
- Tombol **Unduh Excel** dan **Unduh PDF** di setiap dokumen.
- Nama file: `{jenis}_{periode}_{npp}_nama.xlsx|pdf`, contoh `Time Sheet September 2026_901513_Mohamad Burhanudin.xlsx`.
- Pratinjau dokumen sebelum unduh.

### 5.6 Penyimpanan Lokal
- Draft otomatis tersimpan di IndexedDB.
- Riwayat dokumen (daftar, buka ulang, duplikat, hapus).
- Ekspor/impor seluruh data sebagai JSON untuk backup dan pindah perangkat.

## 6. Functional Requirements

| ID | Requirement | Prioritas |
|---|---|---|
| FR-01 | Pengguna dapat menyimpan dan mengubah profil | Must |
| FR-02 | Timesheet menghasilkan grid sesuai bulan dan tahun terpilih | Must |
| FR-03 | Total jam, hari kerja, dan lembur dihitung otomatis | Must |
| FR-04 | Hari libur dan akhir pekan terdeteksi otomatis | Must |
| FR-05 | SPL mendukung banyak pekerja dalam satu surat | Must |
| FR-06 | Surat izin menghitung jumlah hari kerja otomatis | Must |
| FR-07 | Ekspor Excel memakai file template asli sebagai basis | Must |
| FR-08 | Ekspor PDF dengan layout setara template | Must |
| FR-09 | Draft tersimpan otomatis dan dapat dilanjutkan | Must |
| FR-10 | Riwayat dokumen dan fitur duplikat | Should |
| FR-11 | Backup/restore data JSON | Should |
| FR-12 | Tarik data lembur dari timesheet ke SPL | Should |
| FR-13 | Tanda tangan gambar pada dokumen | Could |
| FR-14 | Dark / Light Mode (Tema Tampilan) dengan dukungan Light, Dark, dan System (Otomatis) | Must |
| FR-15 | Progressive Web App (PWA) dengan kapabilitas 100% offline & installable | Must |

### 6.1 Spesifikasi Fitur Dark / Light Mode (FR-14)

Sistem tema tampilan dirancang untuk kenyamanan visual pengguna dalam berbagai kondisi pencahayaan kerja:

1. **Pilihan Mode Tema:**
   - **Mode Gelap (Dark Mode):** Palette obsidian slate (`#090d16`, `#131b2e`) dengan aksen safir (`#3b82f6`) yang ramah mata saat bekerja dalam kondisi minim cahaya atau malam hari.
   - **Mode Terang (Light Mode):** Palette putih bersih dan abu-abu korporat (`#ffffff`, `#f8fafc`, `#e2e8f0`) dengan kontras teks tinggi (`#0f172a`, `#334155`), optimal untuk pencahayaan ruangan kantor terang.
   - **Ikuti Sistem (System/Auto):** Mengikuti preferensi tema sistem operasi perangkat pengguna secara real-time via `window.matchMedia('(prefers-color-scheme: light)')`.

2. **Kontrol Antarmuka (UI Controls):**
   - **Navbar Quick-Toggle:** Tombol switch cepat di sudut kanan atas navbar dengan ikon dinamis (`SunIcon` saat gelap, `MoonIcon` saat terang) dan tooltip informatif.
   - **Pengaturan Lengkap di Halaman Profil:** Kartu pemilihan visual 3 opsi (Terang, Gelap, Sistem) dengan indikator status aktif dan penjelasan peruntukan.

3. **Pencegahan Kedipan Tampilan (Anti-FOUC & Hydration Safe):**
   - Inisialisasi tema synchronous menggunakan script ringan (`public/theme-init.js`) pada `<head>` sebelum rendering DOM utama.
   - Sepenuhnya mematuhi prinsip keamanan PRD: **tanpa `dangerouslySetInnerHTML`**.
   - Sinkronisasi CSS native `color-scheme: dark | light` untuk scrollbar, datepicker, dan kontrol bawaan browser.

4. **Persistensi & Aksesibilitas:**
   - Preferensi tema disimpan di `localStorage` (`ts-theme`).
   - Kontras rasio memenuhi standar WCAG 2.1 AA di seluruh komponen: teks, form input, tabel timesheet, badge status, dan dialog modal.
   - Transisi warna halus (`0.2s ease`) untuk perpindahan mode yang mulus.

### 6.2 Spesifikasi Fitur Progressive Web App (PWA) & Offline Mode (FR-15)

Aplikasi dilengkapi kapabilitas PWA penuh agar dapat dipasang (*installable*) sebagai aplikasi mandiri (*standalone*) pada Desktop (Windows/macOS/Linux) maupun Mobile (Android/iOS) dan dapat bekerja **100% offline**:

1. **Web App Manifest (`public/manifest.webmanifest`):**
   - Nama aplikasi: `Adidata DocGen - Timesheet, SPL & Izin`.
   - Nama pendek: `Adidata DocGen`.
   - Display mode: `standalone` (tampil tanpa bilah navigasi peramban).
   - Warna tema: Crimson Adidata (`#dc2626`), warna latar belakang splash: Obsidian (`#090d16`).
   - Ikon PWA lengkap: 192x192 px, 512x512 px, maskable adaptive icon untuk Android launcher, dan `apple-touch-icon.png` untuk iOS Safari.
   - App Shortcuts: Akses cepat sekali sentuh ke modul *Timesheet Bulanan*, *SPL Lembur*, dan *Surat Izin*.

2. **Service Worker & Strategi Caching Offline (`public/sw.js`):**
   - **Pre-caching Template & Aset Kritis:** Menyimpan otomatis berkas template Excel resmi (`template_timesheet.xlsx`, `template_spl.xlsx`, `template_izin.xlsx`), JSON daftar libur nasional (`holidays-2026.json`), logo perusahaan, dan skrip aplikasi ke dalam Cache Storage (`adidata-docgen-v1.0.0`).
   - **Stale-While-Revalidate:** Aset statis dan berkas script disajikan instan dari cache lokal, lalu diperbarui di latar belakang jika terhubung ke internet.
   - **Network-First dengan Offline Fallback:** Permintaan navigasi halaman HTML memprioritaskan jaringan saat online dan otomatis jatuh ke cache lokal saat offline.
   - **Dynamic Base-Path Scope:** Mengambil scope URL secara dinamis dari `self.registration.scope` sehingga bekerja identik di localhost (`/`) maupun subpath GitHub Pages (`/timesheetGenerator/`).

3. **Integrasi Antarmuka Pengguna (UI & UX):**
   - **Tombol Pasang Aplikasi (Install Prompt):** Muncul otomatis di Navbar saat peramban mendukung instalasi (`beforeinstallprompt`).
   - **Indikator Status Offline:** Badge *Offline PWA* muncul di Navbar saat koneksi terputus, memberi kepastian kepada pengguna bahwa dokumen tetap aman dan dapat diekspor.
   - **Panel Manajemen PWA di Profil (`/profil`):** Menampilkan status instalasi, status jaringan online/offline, status cache dokumen, serta tombol manual untuk memeriksa pembaruan cache offline via Service Worker.

4. **Kemandirian Offline 100%:**
   - Karena perhitungan jam kerja, lembur, hari kerja efektif, serta kompilasi biner Excel (.xlsx) dan PDF dilakukan 100% *client-side* menggunakan JavaScript dan Web APIs, seluruh dokumen administrasi dapat dibuat, disimpan ke IndexedDB, dan diunduh meskipun perangkat pengguna berada dalam mode pesawat (*airplane mode*) atau tanpa akses jaringan internet.

## 7. Non-Functional Requirements

- **Privasi:** tidak ada request jaringan yang membawa data pengguna; semua pemrosesan di browser.
- **Performa:** generate dan unduh file maksimal 3 detik pada laptop standar; Lighthouse Performance ≥ 90.
- **Responsif:** form dapat dipakai di layar 360 px ke atas; pratinjau dokumen dapat di-scroll horizontal pada layar kecil.
- **Kompatibilitas:** Chrome, Edge, Firefox, Safari versi terbaru; Excel hasil ekspor terbuka di Microsoft Excel dan LibreOffice tanpa peringatan perbaikan file.
- **Aksesibilitas:** label form, fokus keyboard, kontras sesuai WCAG 2.1 AA.
- **Keamanan:** tanpa `dangerouslySetInnerHTML`; input disanitasi sebelum ditulis ke sel; CSP ketat via meta tag; dependensi dipantau Dependabot; tanpa secret di repo.
- **Bahasa:** Indonesia (default); struktur siap i18n.

## 8. Arsitektur & Tech Stack

| Lapisan | Pilihan | Catatan |
|---|---|---|
| Framework | Next.js App Router, `output: 'export'` | GitHub Pages hanya melayani file statis; tanpa API route atau SSR |
| UI | Tailwind CSS 4.1 | |
| Form & validasi | React Hook Form + Zod | Skema Zod menjadi sumber kebenaran tipe data |
| State | Zustand + persist ke IndexedDB (`idb-keyval`) | |
| Tanggal | date-fns | Locale `id` |
| Ekspor Excel | ExcelJS | Memuat template .xlsx, mengisi sel, mempertahankan style |
| Ekspor PDF | `@react-pdf/renderer` | Layout dibangun ulang agar identik dengan template |
| PWA & Offline | Service Worker + Web App Manifest | Caching 100% offline (template .xlsx, data libur, font, aset) |
| Pengujian | Vitest, Playwright | |
| CI/CD | GitHub Actions | Build dan deploy ke Pages |

### Keputusan Penting: Strategi PDF

Konversi `.xlsx` ke PDF dengan fidelity tinggi memerlukan engine seperti LibreOffice, yang tidak tersedia di browser maupun GitHub Pages. Pendekatan yang dipilih:

- **Default:** render PDF dari data yang sama menggunakan `@react-pdf/renderer`, dengan komponen layout yang meniru template (ukuran kertas, margin, kolom, border, font). Hasil konsisten dan sepenuhnya client-side.
- Alternatif (1 baris): `window.print()` dari pratinjau HTML dengan `@media print`, lebih sederhana tetapi hasil bergantung pada browser.
- Konsekuensi: setiap perubahan template Excel perlu disinkronkan ke komponen PDF. Karena itu pemetaan kolom dan ukuran disimpan dalam satu file konfigurasi bersama.

### Strategi Template Excel

- File template asli disimpan di `public/templates/*.xlsx` dan di-fetch saat ekspor.
- Pemetaan field ke sel disimpan di file konfigurasi terpisah, sehingga mengganti template tidak perlu mengubah logika.
- Baris dinamis (misalnya pekerja SPL): template menyediakan baris contoh; engine menyalin style baris tersebut, lalu menyisipkan baris tambahan sesuai jumlah data.
- Kapasitas maksimum per dokumen ditentukan dari template (misalnya SPL ≤ N pekerja per halaman) dan divalidasi di form.

Contoh pemetaan:

```json
{
  "template": "templates/timesheet.xlsx",
  "sheet": "Timesheet",
  "fields": {
    "employeeName": "C4",
    "employeeId": "C5",
    "period": "C6",
    "totalHours": "H40"
  },
  "table": {
    "startRow": 9,
    "maxRows": 31,
    "columns": {
      "date": "A",
      "day": "B",
      "timeIn": "C",
      "timeOut": "D",
      "breakHours": "E",
      "workHours": "F",
      "location": "G",
      "description": "H"
    }
  }
}
```

> Alamat sel di atas hanya contoh. Nilai sebenarnya diambil dari template yang Anda miliki.

## 9. Struktur Proyek

```text
timesheet-generator/
├─ .github/workflows/deploy.yml
├─ public/
│  ├─ templates/
│  │  ├─ timesheet.xlsx
│  │  ├─ spl.xlsx
│  │  └─ izin.xlsx
│  ├─ icons/                    # Ikon PWA (192px, 512px, maskable, apple-touch)
│  ├─ data/holidays-2026.json
│  ├─ manifest.webmanifest      # Web App Manifest PWA
│  ├─ sw.js                     # Service Worker PWA (offline cache)
│  └─ theme-init.js             # Skrip inisialisasi synchronous anti-FOUC
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx
│  │  ├─ page.tsx
│  │  ├─ profil/page.tsx
│  │  ├─ timesheet/page.tsx
│  │  ├─ spl/page.tsx
│  │  ├─ izin/page.tsx
│  │  └─ riwayat/page.tsx
│  ├─ components/
│  │  ├─ Navbar.tsx
│  │  ├─ TimesheetGenerator.tsx
│  │  └─ Icons.tsx
│  ├─ lib/
│  │  ├─ schemas/            # Zod schema per dokumen
│  │  ├─ theme-context.tsx   # Provider context tema (Light, Dark, System)
│  │  ├─ pwa-context.tsx     # Provider context PWA & status offline
│  │  ├─ excel/              # ExcelJS: loader, filler, mapping
│  │  ├─ pdf/                # komponen @react-pdf per dokumen
│  │  ├─ calc/               # jam kerja, lembur, hari kerja
│  │  └─ storage/            # IndexedDB, backup/restore
│  └─ config/mappings/       # pemetaan sel per template
├─ tests/
├─ next.config.ts
└─ package.json
```

## 10. Model Data (ringkas)

```ts
type Profile = {
  name: string;
  employeeId: string;
  position: string;
  department: string;
  project?: string;
  supervisorName: string;
  supervisorPosition: string;
  approverName?: string;
  city: string;
  signatureDataUrl?: string;
};

```

## 11. Alur Pengguna

1. Buka aplikasi → isi **Profil** sekali.
2. Pilih dokumen (Timesheet / SPL / Izin).
3. Isi form; kalkulasi tampil langsung.
4. Cek **pratinjau**.
5. Klik **Unduh Excel** atau **Unduh PDF**.
6. Dokumen tersimpan di **Riwayat** untuk diduplikasi bulan berikutnya.

## 12. Deployment (GitHub Pages)

`next.config.ts`:

```ts
import type { NextConfig } from 'next';

const repo = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  output: 'export',
  basePath: repo,
  assetPrefix: repo || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
```

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

# Allow only one concurrent deployment; cancel in-progress runs
concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build static export
        env:
          # Matches the GitHub repo name — update if repo is renamed
          NEXT_PUBLIC_BASE_PATH: /timesheetGenerator
        run: npm run build

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: out

  deploy:
    name: Deploy
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

Catatan:
- Repo harus mengaktifkan **Settings → Pages → Source: GitHub Actions**.
- Seluruh path aset template memakai `basePath`, sehingga fetch memakai helper yang menambahkan prefix.
- Repo publik berarti template Excel ikut publik. Pastikan template tidak memuat data sensitif atau logo yang tidak boleh disebarkan. Repo privat di Pages membutuhkan plan berbayar.
- Pastikan tidak ada routing dinamis yang tidak bisa di-prerender; gunakan query string untuk membuka dokumen dari riwayat.

## 13. Pengujian & Kriteria Penerimaan

### Pengujian
- **Unit (Vitest):** hitung jam kerja, lintas tengah malam, lembur, hari kerja dengan libur, nomor surat Romawi.
- **Snapshot template:** isi template dengan data tetap, bandingkan nilai sel dan merge range dengan hasil acuan.
- **E2E (Playwright):** isi form → unduh file → verifikasi file terbentuk dan terbaca.
- **Visual PDF:** bandingkan render halaman PDF dengan screenshot acuan dari template.
- **Manual:** buka hasil di Excel desktop dan LibreOffice.

### Kriteria Penerimaan v1
- [ ] Tiga jenis dokumen dapat dibuat dan diekspor ke Excel dan PDF.
- [ ] Excel hasil ekspor mempertahankan merge, border, font, lebar kolom, dan print area template.
- [ ] PDF hasil ekspor tidak menyimpang lebih dari toleransi visual yang disepakati (margin, posisi kolom, pemotongan teks).
- [ ] Draft tidak hilang setelah tab ditutup.
- [ ] Aplikasi terdeploy di GitHub Pages dan dapat dipakai pada layar ponsel.
- [ ] Tidak ada request jaringan berisi data pengguna (diverifikasi lewat DevTools).

## 14. Milestone

## 15. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| ExcelJS tidak mempertahankan fitur tertentu (gambar, shape, conditional formatting kompleks) | Format Excel bergeser | Audit template di M0; sederhanakan elemen yang bermasalah; uji dengan file asli lebih awal |
| PDF tidak identik dengan template | Dokumen tampak berbeda | Satu konfigurasi layout bersama; uji visual; sepakati toleransi |
| Data tersimpan di browser hilang saat cache dibersihkan | Kehilangan riwayat | Fitur backup JSON dan pengingat berkala |
| Template berisi data sensitif pada repo publik | Kebocoran | Review template sebelum commit; gunakan placeholder |
| Daftar hari libur kedaluwarsa | Hitungan salah | File libur terpisah per tahun yang mudah diperbarui |
| Teks panjang melebihi lebar sel | Teks terpotong | Batas karakter di form, wrap text, dan peringatan di pratinjau |

## 16. Pertanyaan Terbuka

1. Berapa jumlah sheet dan halaman per template, dan apakah ada gambar, logo, atau shape di dalamnya?
1, ada
2. Apakah rumus Excel di template (total jam, dll) harus tetap berupa rumus, atau cukup nilai hasil?
tetap rumus
3. Apakah satu pengguna bisa mengelola beberapa profil (misalnya admin yang membuatkan untuk tim)?
tidak, kalau admin bisa
4. Apakah tanda tangan berupa gambar perlu ada di v1? ya
5. Ukuran kertas dan orientasi tiap dokumen (A4 portrait/landscape)? legal portrai
6. Apakah repo akan publik atau privat? public

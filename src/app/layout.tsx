import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme-context";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Timesheet, SPL & Permohonan Izin Generator | Adidata",
  description:
    "Generator dokumen administrasi kerja resmi Adidata (Timesheet Bulanan, Surat Perintah Lembur, dan Surat Permohonan Izin). Ekspor ke Excel (.xlsx) & PDF 100% client-side.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  return (
    <html
      lang="id"
      data-theme="dark"
      className={`h-full ${inter.variable} ${jetbrainsMono.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <script src={`${basePath}/theme-init.js`} />
      </head>
      <body
        className="app-layout"
        style={{ fontFamily: "var(--font-inter, 'Inter', system-ui, sans-serif)" }}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

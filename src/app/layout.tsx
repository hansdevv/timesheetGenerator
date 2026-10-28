import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme-context";
import { PwaProvider } from "@/lib/pwa-context";

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

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Timesheet, SPL & Permohonan Izin Generator | Adidata",
  description:
    "Generator dokumen administrasi kerja resmi Adidata (Timesheet Bulanan, Surat Perintah Lembur, dan Surat Permohonan Izin). Bekerja 100% offline via PWA.",
  manifest: `${basePath}/manifest.webmanifest`,
  icons: {
    icon: `${basePath}/favicon.ico`,
    apple: `${basePath}/icons/apple-touch-icon.png`,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Adidata DocGen",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="id"
      data-theme="dark"
      className={`h-full ${inter.variable} ${jetbrainsMono.variable}`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <link rel="manifest" href={`${basePath}/manifest.webmanifest`} />
        <meta name="theme-color" content="#dc2626" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Adidata DocGen" />
        <link rel="apple-touch-icon" href={`${basePath}/icons/apple-touch-icon.png`} />
        <script src={`${basePath}/theme-init.js`} />
      </head>
      <body
        className="app-layout"
        style={{ fontFamily: "var(--font-inter, 'Inter', system-ui, sans-serif)" }}
      >
        <ThemeProvider>
          <PwaProvider>{children}</PwaProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

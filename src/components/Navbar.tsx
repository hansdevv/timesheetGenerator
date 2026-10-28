"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/lib/theme-context";
import { usePwa } from "@/lib/pwa-context";
import {
  CalendarIcon,
  FileTextIcon,
  ArchiveIcon,
  UserIcon,
  UmbrellafillIcon,
  SunIcon,
  MoonIcon,
  DownloadIcon,
} from "@/components/Icons";

const NAV_ITEMS = [
  {
    href: "/timesheet",
    matchHrefs: ["/", "/timesheet"],
    label: "Timesheet",
    icon: <CalendarIcon size={15} />,
  },
  {
    href: "/spl",
    matchHrefs: ["/spl"],
    label: "SPL Lembur",
    icon: <FileTextIcon size={15} />,
  },
  {
    href: "/izin",
    matchHrefs: ["/izin"],
    label: "Surat Izin",
    icon: <UmbrellafillIcon size={15} />,
  },
  {
    href: "/profil",
    matchHrefs: ["/profil"],
    label: "Profil",
    icon: <UserIcon size={15} />,
  },
  {
    href: "/riwayat",
    matchHrefs: ["/riwayat", "/history"],
    label: "Riwayat",
    icon: <ArchiveIcon size={15} />,
  },
];

export default function Navbar() {
  const pathname = usePathname();
  const { resolvedTheme, toggle, mounted } = useTheme();
  const { isInstallable, isOffline, promptInstall } = usePwa();

  return (
    <>
      <nav className="navbar">
      <Link href="/" className="navbar-brand">
        <div
          className="brand-icon"
          style={{
            background: "#dc2626",
            boxShadow: "0 2px 6px rgba(220, 38, 38, 0.35)",
          }}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--text-hi)",
              fontSize: "0.95rem",
              lineHeight: 1.2,
            }}
          >
            Adidata DocGen
          </span>
          <span style={{ fontSize: "0.68rem", color: "var(--text-lo)", fontWeight: 500 }} className="brand-subtitle">
            Timesheet · SPL · Permohonan Izin
          </span>
        </div>
      </Link>

      <ul className="navbar-nav" style={{ overflowX: "auto" }}>
        {NAV_ITEMS.map((item) => {
          const cleanPath = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
          const isActive = item.matchHrefs.includes(cleanPath);
          return (
            <li key={item.href}>
              <Link href={item.href} className={`nav-link ${isActive ? "active" : ""}`}>
                {item.icon}
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="navbar-right">
        {isOffline && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "0.72rem",
              fontWeight: 600,
              color: "var(--amber-text)",
              background: "var(--amber-dim)",
              border: "1px solid var(--amber-dim-border)",
              padding: "3px 8px",
              borderRadius: "9999px",
            }}
            title="Anda sedang offline. Semua generator dokumen tetap berfungsi normal berkat cache offline PWA!"
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--amber)" }} />
            <span>Offline PWA</span>
          </div>
        )}

        {isInstallable && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={promptInstall}
            style={{ padding: "4px 10px", fontSize: "0.78rem" }}
            title="Pasang aplikasi Adidata DocGen ke perangkat (Desktop / Mobile)"
          >
            <DownloadIcon size={13} />
            <span>Pasang App</span>
          </button>
        )}

        <div className="autosave-badge" title="Draft otomatis tersimpan di IndexedDB browser">
          <span className="autosave-dot" />
          <span className="autosave-text">IndexedDB Auto-save</span>
        </div>

        <button
          id="theme-toggle-btn"
          type="button"
          className="theme-toggle"
          onClick={toggle}
          suppressHydrationWarning
          title={
            !mounted
              ? "Ganti tema tampilan"
              : resolvedTheme === "dark"
                ? "Beralih ke mode terang (Light mode)"
                : "Beralih ke mode gelap (Dark mode)"
          }
          aria-label={
            !mounted
              ? "Ganti tema tampilan"
              : resolvedTheme === "dark"
                ? "Beralih ke mode terang"
                : "Beralih ke mode gelap"
          }
        >
          {mounted && resolvedTheme === "light" ? (
            <MoonIcon size={16} />
          ) : (
            <SunIcon size={16} />
          )}
        </button>
      </div>
    </nav>

    {/* Mobile Bottom Navigation Bar (< 768px) */}
    <nav className="bottom-nav" aria-label="Navigasi Bawah">
      {NAV_ITEMS.map((item) => {
        const cleanPath = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
        const isActive = item.matchHrefs.includes(cleanPath);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`bottom-nav-item ${isActive ? "active" : ""}`}
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            <span className="bottom-nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
    </>
  );
}

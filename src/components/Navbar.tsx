"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/lib/theme-context";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Timesheet",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    href: "/spl",
    label: "Surat Lembur",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    href: "/history",
    label: "Riwayat",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="12 8 12 12 14 14" />
        <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" />
      </svg>
    ),
  },
];

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();

  return (
    <nav className="navbar">
      <Link href="/" className="navbar-brand">
        <div className="brand-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontWeight: 800, letterSpacing: "-0.025em", color: "var(--text-hi)", fontSize: "1rem" }}>
            TimesheetGen
          </span>
          <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 500, letterSpacing: "0.03em" }}>
            Adidata · Template Resmi
          </span>
        </div>
      </Link>

      <ul className="navbar-nav">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
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
        <div className="autosave-badge" title="Data otomatis tersimpan di browser">
          <span className="autosave-dot" />
          <span>Tersimpan otomatis</span>
        </div>

        <button
          id="theme-toggle-btn"
          className="theme-toggle"
          onClick={toggle}
          title={theme === "dark" ? "Ganti ke Light Mode" : "Ganti ke Dark Mode"}
          aria-label={theme === "dark" ? "Ganti ke Light Mode" : "Ganti ke Dark Mode"}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>
    </nav>
  );
}

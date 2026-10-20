"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/lib/theme-context";
import {
  CalendarIcon,
  FileTextIcon,
  ArchiveIcon,
  SunIcon,
  MoonIcon,
} from "@/components/Icons";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Timesheet",
    icon: <CalendarIcon size={15} />,
  },
  {
    href: "/spl",
    label: "Surat Lembur",
    icon: <FileTextIcon size={15} />,
  },
  {
    href: "/history",
    label: "Riwayat",
    icon: <ArchiveIcon size={15} />,
  },
];

export default function Navbar() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();

  return (
    <nav className="navbar">
      <Link href="/" className="navbar-brand">
        <div className="brand-icon">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-hi)", fontSize: "0.95rem", lineHeight: 1.2 }}>
            TimesheetGen
          </span>
          <span style={{ fontSize: "0.68rem", color: "var(--text-lo)", fontWeight: 500 }}>
            Adidata · Format Resmi
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
        <div className="autosave-badge" title="Data formulir otomatis tersimpan di browser">
          <span className="autosave-dot" />
          <span>Auto-save aktif</span>
        </div>

        <button
          id="theme-toggle-btn"
          type="button"
          className="theme-toggle"
          onClick={toggle}
          suppressHydrationWarning
          title={theme === "dark" ? "Beralih ke mode terang (Light mode)" : "Beralih ke mode gelap (Dark mode)"}
          aria-label={theme === "dark" ? "Beralih ke mode terang" : "Beralih ke mode gelap"}
        >
          {theme === "dark" ? <SunIcon size={16} /> : <MoonIcon size={16} />}
        </button>
      </div>
    </nav>
  );
}

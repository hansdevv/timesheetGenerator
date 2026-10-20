"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Timesheet", icon: "📋" },
  { href: "/spl", label: "Surat Lembur (SPL)", icon: "🌙" },
  { href: "/history", label: "Riwayat & Draf", icon: "🗂️" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="navbar">
      <Link href="/" className="navbar-brand">
        <div className="brand-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontWeight: 800, letterSpacing: "-0.02em", color: "#ffffff", fontSize: "1.05rem" }}>
            Timesheet<span style={{ color: "var(--accent-indigo)" }}>Gen</span>
          </span>
          <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 500, letterSpacing: "0.02em" }}>
            Adidata Template Standard
          </span>
        </div>
      </Link>

      <ul className="navbar-nav">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`nav-link ${isActive ? "active" : ""}`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="navbar-right" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.75rem",
            color: "var(--text-secondary)",
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid var(--border-color)",
            padding: "4px 10px",
            borderRadius: "9999px",
          }}
          title="Data otomatis tersimpan di penyimpanan browser Anda"
        >
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              backgroundColor: "var(--accent-emerald)",
              boxShadow: "0 0 8px var(--accent-emerald)",
              display: "inline-block",
            }}
          />
          <span>Auto-Save Aktif</span>
        </div>
      </div>
    </nav>
  );
}

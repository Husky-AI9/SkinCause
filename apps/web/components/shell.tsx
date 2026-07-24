"use client";

import { persistentDisclaimer } from "@skincause/domain";
import { BookOpenText, FlaskConical, LayoutDashboard, Menu, ScanFace, ShieldCheck, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Routine", icon: BookOpenText },
  { href: "/scan/new", label: "Scan", icon: ScanFace },
  { href: "/experiments/brightening-serum-elimination", label: "Experiment", icon: FlaskConical },
  { href: "/privacy", label: "Privacy", icon: ShieldCheck }
];

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="SkinCause home">
      <span className="brand-mark"><Sparkles size={18} aria-hidden="true" /></span>
      <span>SkinCause</span>
    </Link>
  );
}

export function AppHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        <nav className={open ? "main-nav is-open" : "main-nav"} aria-label="Primary navigation">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={pathname === href ? "nav-link is-active" : "nav-link"}
              onClick={() => setOpen(false)}
            >
              <Icon size={17} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
          <Link className="button button-small" href="/check-in" onClick={() => setOpen(false)}>
            Check in
          </Link>
        </nav>
        <button
          className="icon-button nav-toggle"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}

export function SafetyFooter() {
  return (
    <footer className="safety-footer">
      <div className="footer-inner">
        <div>
          <Brand />
          <p>{persistentDisclaimer}</p>
        </div>
        <nav aria-label="Footer navigation">
          <Link href="/privacy">Privacy center</Link>
          <Link href="/results/brightening-serum-elimination">Seeded result</Link>
          <Link href="/api/v1/me">API status</Link>
        </nav>
      </div>
    </footer>
  );
}

"use client";

import { persistentDisclaimer } from "@skincause/domain";
import {
  BookOpenText,
  FlaskConical,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  ScanFace,
  X
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAppState } from "./app-provider";

const navItems = [
  { href: "/dashboard", label: "Acne plan", icon: LayoutDashboard },
  { href: "/scan/new", label: "Scan", icon: ScanFace },
  { href: "/experiments/new", label: "Experiment", icon: FlaskConical },
  { href: "/products", label: "Products", icon: BookOpenText }
];

function SkinCauseMark() {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M48.5 15.5A23.5 23.5 0 1 0 49 48"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M17 25.5C24 19.2 34.8 18.4 43 24"
        stroke="currentColor"
        strokeWidth="3.25"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M15.5 33.5C24.5 27.1 37 27.1 46 33.5"
        stroke="currentColor"
        strokeWidth="3.25"
        strokeLinecap="round"
        opacity="0.72"
      />
      <path
        d="M18.5 41.5C25.3 37.1 35.7 37.1 42.5 41.5"
        stroke="currentColor"
        strokeWidth="3.25"
        strokeLinecap="round"
        opacity="0.54"
      />
      <circle cx="48.5" cy="15.5" r="5.5" fill="#d96148" />
      <circle cx="48.5" cy="15.5" r="2" fill="#fffdf8" />
    </svg>
  );
}

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="SkinCause home">
      <SkinCauseMark />
      <span>SkinCause</span>
    </Link>
  );
}

export function AppHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { authStatus, demoMode, userEmail, exitDemo, signOut } = useAppState();
  const hasWorkspace = authStatus === "authenticated" || demoMode;

  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        <nav className={open ? "main-nav is-open" : "main-nav"} aria-label="Primary navigation">
          {hasWorkspace && navItems.map(({ href, label, icon: Icon }) => (
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
          {hasWorkspace ? (
            <Link className="button button-small" href="/check-in" onClick={() => setOpen(false)}>
              Check in
            </Link>
          ) : null}
          {demoMode ? (
            <button
              className="button button-quiet button-small auth-nav-control"
              type="button"
              onClick={() => {
                setOpen(false);
                void exitDemo()
                  .catch(() => undefined)
                  .finally(() => router.push("/"));
              }}
            >
              <LogOut size={17} aria-hidden="true" />
              <span>Exit demo</span>
            </button>
          ) : authStatus === "authenticated" ? (
            <button
              className="button button-quiet button-small auth-nav-control"
              type="button"
              title={userEmail ?? "Signed in"}
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
            >
              <LogOut size={17} aria-hidden="true" />
              <span>Sign out</span>
            </button>
          ) : (
            <Link className="nav-link" href="/auth" onClick={() => setOpen(false)}>
              <LogIn size={17} aria-hidden="true" />
              <span>Sign in</span>
            </Link>
          )}
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
  const { authStatus, demoMode } = useAppState();
  const hasWorkspace = authStatus === "authenticated" || demoMode;

  return (
    <footer className="safety-footer">
      <div className="footer-inner">
        <div>
          <Brand />
          <p>{persistentDisclaimer}</p>
        </div>
        {hasWorkspace ? (
          <nav aria-label="Footer navigation">
            <Link href="/results/brightening-serum-elimination">Demo result</Link>
            <Link href="/api/v1/me">API status</Link>
          </nav>
        ) : null}
      </div>
    </footer>
  );
}

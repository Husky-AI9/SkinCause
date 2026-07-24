import type { Metadata } from "next";
import { AppHeader, SafetyFooter } from "@/components/shell";
import { AppProvider } from "@/components/app-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "SkinCause | Understand what changed",
  description: "A privacy-first skincare routine debugger for controlled, repeatable cosmetic tracking."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <AppProvider>
          <a className="skip-link" href="#main">Skip to content</a>
          <AppHeader />
          {children}
          <SafetyFooter />
        </AppProvider>
      </body>
    </html>
  );
}

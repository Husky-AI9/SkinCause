import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AppHeader, SafetyFooter } from "@/components/shell";
import { AppProvider } from "@/components/app-provider";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap"
});

export const metadata: Metadata = {
  title: "SkinCause | Affordable AI acne guidance",
  description: "YouCam acne-pattern analysis, affordable AI skincare guidance, nutrition context, simulation, and repeatable cosmetic tracking."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={plusJakartaSans.variable} lang="en" data-scroll-behavior="smooth">
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

import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/shared/AppProviders";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Campus Support Desk",
  description: "Campus Student Support Desk UI"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${manrope.variable} ${spaceGrotesk.variable}`}>
      <body className="font-sans text-slate-900">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

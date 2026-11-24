import type { Metadata } from "next";
import { Figtree, Noto_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const notoSans = Noto_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Synapse Clinical — Clinical Intelligence & Decision Support",
  description:
    "Clinical decision support workspace with Corrective RAG, claim-level verification, and deterministic pharmacovigilance safety gates.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${figtree.variable} ${notoSans.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-canvas text-ink font-sans min-h-screen antialiased selection:bg-accent-soft selection:text-accent">
        {children}
      </body>
    </html>
  );
}

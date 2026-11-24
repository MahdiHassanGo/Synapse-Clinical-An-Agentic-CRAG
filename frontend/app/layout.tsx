import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Synapse Clinical — Agentic Clinical Intelligence & Decision Support",
  description:
    "Autonomous Agentic RAG clinical decision support with CRAG, Self-RAG, and deterministic pharmacovigilance safety gates.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-graphite-950 text-graphite-100 font-sans min-h-screen antialiased selection:bg-clinical-blue/25 selection:text-white">
        {children}
      </body>
    </html>
  );
}

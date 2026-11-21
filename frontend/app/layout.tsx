import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Synapse Clinical — Agentic Clinical Intelligence & Decision Support",
  description: "Autonomous Agentic RAG clinical decision support with CRAG, Self-RAG, and deterministic pharmacovigilance safety gates.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-graphite-950 text-graphite-100 min-h-screen selection:bg-clinical-blue/20 selection:text-clinical-blue">
        {children}
      </body>
    </html>
  );
}

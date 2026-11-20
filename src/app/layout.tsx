import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spend CivilMafia",
  description: "Reporte general de spend de CivilMafia sobre civil-datalake (BigQuery).",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

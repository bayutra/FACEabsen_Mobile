import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// DESIGN.md specifies Inter exclusively; its tabular figures are what keep
// timestamps aligned inside the roster tables.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RS Absen — Dashboard Kehadiran Rumah Sakit",
  description: "Administrasi absensi, jadwal shift, dan verifikasi biometrik RS Absen",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${inter.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-surface font-sans text-body-md text-on-surface antialiased">
        {children}
      </body>
    </html>
  );
}

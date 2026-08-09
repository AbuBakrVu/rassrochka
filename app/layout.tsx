import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Shell from "@/components/shell";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Nasiya — учёт рассрочек",
  description: "CRM для управления рассрочками: платежи, сделки, клиенты",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body className={`${inter.variable} antialiased`}>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}

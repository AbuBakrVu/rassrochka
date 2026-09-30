import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";
import Shell from "@/components/shell";
import { THEME_SCRIPT } from "@/lib/theme";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

const montserrat = Montserrat({
  subsets: ["latin", "cyrillic"],
  weight: ["600", "700", "800"],
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: "Nasiya — учёт рассрочек",
  description: "CRM для управления рассрочками: платежи, сделки, клиенты",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: класс .dark на <html> ставит скрипт ниже до
    // гидрации — React не должен считать это расхождением
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={`${inter.variable} ${montserrat.variable} antialiased`}>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}

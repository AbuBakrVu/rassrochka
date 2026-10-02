import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";
import Shell from "@/components/shell";
import { THEME_SCRIPT } from "@/lib/theme";
import { requestBranding } from "@/lib/branding";
import { brandCss } from "@/lib/brand-color";
import { BrandingProvider, BRAND_STYLE_ID } from "@/components/branding";

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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Свой цвет и логотип компании (Настройки → Оформление). Стиль с цветами
  // приходит в первом же HTML — страница сразу в цветах компании, без
  // мигания стандартной бирюзовой темой. Чтение адреса запроса делает
  // страницы динамическими: у каждой компании своё оформление.
  const branding = await requestBranding();
  return (
    // suppressHydrationWarning: класс .dark на <html> ставит скрипт ниже до
    // гидрации — React не должен считать это расхождением
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <style id={BRAND_STYLE_ID} dangerouslySetInnerHTML={{ __html: brandCss(branding.color) }} />
      </head>
      <body className={`${inter.variable} ${montserrat.variable} antialiased`}>
        <BrandingProvider initial={branding}>
          <Shell>{children}</Shell>
        </BrandingProvider>
      </body>
    </html>
  );
}

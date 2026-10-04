import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import Shell from "@/components/shell";
import { THEME_SCRIPT } from "@/lib/theme";
import { requestBranding } from "@/lib/branding";
import { brandCss } from "@/lib/brand-color";
import { BrandingProvider, BRAND_STYLE_ID } from "@/components/branding";

// Геометрический шрифт с кириллицей, тонкие начертания — как в референсе.
// Переменная висит на <html>: тема (--font-sans в globals.css) читается
// на :root, и с классом на <body> шрифт молча не подключался
const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-manrope",
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
  // мигания стандартным цветом. Чтение адреса запроса делает
  // страницы динамическими: у каждой компании своё оформление.
  const branding = await requestBranding();
  return (
    // suppressHydrationWarning: класс .dark на <html> ставит скрипт ниже до
    // гидрации — React не должен считать это расхождением
    <html lang="ru" suppressHydrationWarning className={manrope.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <style id={BRAND_STYLE_ID} dangerouslySetInnerHTML={{ __html: brandCss(branding.color) }} />
      </head>
      <body className="antialiased">
        <BrandingProvider initial={branding}>
          <Shell>{children}</Shell>
        </BrandingProvider>
      </body>
    </html>
  );
}

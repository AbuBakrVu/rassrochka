"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Zap } from "lucide-react";
import { brandCss } from "@/lib/brand-color";

// Оформление компании в браузере. Начальное значение приходит из корневого
// layout (там же стиль с цветами уже вставлен в <head>), здесь — только
// обновление после сохранения в настройках, без перезагрузки страницы.

export interface BrandingState {
  color: string | null;
  logoVersion: string | null;
  companyName: string | null;
}

/** id <style> в <head>, который рисует app/layout.tsx. */
export const BRAND_STYLE_ID = "brand-style";

interface BrandingContextValue extends BrandingState {
  /** Адрес логотипа или null, если его нет. */
  logoUrl: string | null;
  setBranding: (next: Omit<BrandingState, "companyName">) => void;
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

export const logoUrlFor = (version: string | null) =>
  version ? `/api/branding/logo?v=${encodeURIComponent(version)}` : null;

export function BrandingProvider({
  initial,
  children,
}: {
  initial: BrandingState;
  children: React.ReactNode;
}) {
  const [state, setState] = useState(initial);

  const setBranding = useCallback((next: Omit<BrandingState, "companyName">) => {
    const el = document.getElementById(BRAND_STYLE_ID);
    if (el) el.textContent = brandCss(next.color);
    setState((s) => ({ ...s, ...next }));
  }, []);

  return (
    <BrandingContext.Provider
      value={{ ...state, logoUrl: logoUrlFor(state.logoVersion), setBranding }}
    >
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingContextValue {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error("useBranding вне BrandingProvider");
  return ctx;
}

/**
 * Знак компании: её логотип, если загружен, иначе стандартная молния.
 * className — размер и форма; tone — подложка молнии (у логотипа подложка
 * всегда белая: логотипы рисуют под белый фон, и на цветной заливке они
 * теряются).
 */
export function BrandMark({
  className,
  tone = "brand",
  iconSize = 18,
}: {
  className: string;
  tone?: "brand" | "canvas";
  iconSize?: number;
}) {
  const { logoUrl, companyName } = useBranding();
  if (logoUrl) {
    return (
      <span className={`flex shrink-0 items-center justify-center overflow-hidden border border-black/5 bg-white ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- логотип из базы компании, оптимизатор картинок ему не нужен */}
        <img
          src={logoUrl}
          alt={companyName ? `Логотип ${companyName}` : "Логотип компании"}
          className="h-full w-full object-contain p-[12%]"
        />
      </span>
    );
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center ${
        tone === "brand" ? "bg-brand text-on-brand" : "bg-canvas text-brand"
      } ${className}`}
    >
      <Zap size={iconSize} aria-hidden />
    </span>
  );
}

/** Подпись рядом со знаком: название компании, если у неё свой логотип, иначе «Nasiya». */
export function useBrandName(): string {
  const { logoUrl, companyName } = useBranding();
  return logoUrl && companyName ? companyName : "Nasiya";
}

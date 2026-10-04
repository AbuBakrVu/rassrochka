"use client";

import { useState } from "react";
import { Check, RotateCcw, Upload, Zap } from "lucide-react";
import { Card } from "@/components/ui";
import { useBranding } from "@/components/branding";
import { useData } from "@/lib/store";
import {
  BRAND_PRESETS,
  DEFAULT_BRAND,
  brandWarning,
  darkShades,
  lightShades,
  normalizeHex,
  textOn,
} from "@/lib/brand-color";

// Настройки → Оформление: логотип и основной цвет компании. Изменения
// сначала видны только в предпросмотре справа; «Сохранить» применяет их
// для всех. Хранение и проверки — app/api/settings/branding, lib/branding.ts.

const MAX_BYTES = 500 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

type LogoDraft = { kind: "keep" } | { kind: "new"; dataUrl: string } | { kind: "none" };

function Step({ n, title, text, children }: { n: number; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[13px] font-semibold text-brand-deep">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-sm text-mute">{text}</p>
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  );
}

export default function BrandingSettings() {
  const { user, saveBranding } = useData();
  const branding = useBranding();
  const isAdmin = user.role === "admin";

  const savedColor = branding.color ?? DEFAULT_BRAND;
  const [color, setColor] = useState(savedColor);
  const [hexDraft, setHexDraft] = useState(savedColor.toUpperCase());
  const [logo, setLogo] = useState<LogoDraft>({ kind: "keep" });
  const [dark, setDark] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const pick = (hex: string) => {
    setColor(hex);
    setHexDraft(hex.toUpperCase());
    setMessage(null);
  };

  const logoSrc =
    logo.kind === "new" ? logo.dataUrl : logo.kind === "none" ? null : branding.logoUrl;
  const colorChanged = color.toLowerCase() !== savedColor.toLowerCase();
  const logoChanged = logo.kind === "new" || (logo.kind === "none" && !!branding.logoVersion);
  const dirty = colorChanged || logoChanged;
  const isDefault = !branding.color && !branding.logoVersion;
  const warning = brandWarning(color);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!TYPES.includes(file.type)) {
      setMessage({ text: "Подходят только PNG, JPG, WebP или SVG", error: true });
      return;
    }
    if (file.size > MAX_BYTES) {
      setMessage({ text: "Файл больше 500 КБ — уменьшите картинку", error: true });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogo({ kind: "new", dataUrl: String(reader.result) });
      setMessage(null);
    };
    reader.readAsDataURL(file);
  };

  const apply = async (input: { color?: string | null; logo?: string | null }, done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const next = await saveBranding(input);
      branding.setBranding(next);
      const c = next.color ?? DEFAULT_BRAND;
      setColor(c);
      setHexDraft(c.toUpperCase());
      setLogo({ kind: "keep" });
      setMessage({ text: done });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Не удалось сохранить", error: true });
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const input: { color?: string | null; logo?: string | null } = {};
    // Стандартный цвет храним как «нет своего цвета»: тогда работает тема
    // из globals.css целиком, а не её приближение
    if (colorChanged) input.color = color.toLowerCase() === DEFAULT_BRAND ? null : color;
    if (logo.kind === "new") input.logo = logo.dataUrl;
    if (logo.kind === "none" && branding.logoVersion) input.logo = null;
    void apply(input, "Сохранено — у остальных сотрудников применится при следующем открытии страницы");
  };

  const reset = () => {
    if (!confirm("Вернуть стандартный цвет и убрать логотип компании?")) return;
    void apply({ color: null, logo: null }, "Вернули стандартное оформление");
  };

  if (!isAdmin) {
    return (
      <Card className="p-5 sm:p-6">
        <h2 className="font-semibold tracking-tight">Оформление компании</h2>
        <p className="mt-1 text-sm text-mute">Логотип и основной цвет меняет администратор компании.</p>
      </Card>
    );
  }

  const shades = dark ? darkShades(color) : lightShades(color);
  const preview = dark
    ? { bg: "#111b21", card: "#1e2b33", text: "#e8eef1", mute: "#93a3ae", line: "#2e3d46", good: "#4ade80", goodSoft: "#173a28", bad: "#f87171", badSoft: "#3d1d1d" }
    : { bg: "#f2f5f7", card: "#ffffff", text: "#1b262e", mute: "#5b6b78", line: "#e3e8ec", good: "#16803c", goodSoft: "#e6f6ec", bad: "#c2412d", badSoft: "#fbe9e6" };
  const bars = [30, 46, 22, 64, 40, 78, 52, 34, 88, 60, 44, 70];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_480px]">
      <Card className="flex flex-col gap-7 p-5 sm:p-7">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Оформление компании</h2>
          <p className="mt-1 text-sm text-mute">
            Увидят все сотрудники и ваши клиенты в личном кабинете.
          </p>
        </div>

        <Step n={1} title="Логотип" text="PNG, SVG, JPG или WebP до 500 КБ. Лучше квадратный, на прозрачном фоне.">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex h-22 w-22 shrink-0 items-center justify-center overflow-hidden rounded-[20px] border-[1.5px] border-dashed border-line bg-canvas/60">
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element -- предпросмотр выбранного файла
                <img src={logoSrc} alt="Логотип компании" className="h-18 w-18 object-contain" />
              ) : (
                <span className="text-center text-xs leading-tight text-mute">
                  Нет
                  <br />
                  логотипа
                </span>
              )}
            </span>
            <div className="flex flex-col items-start gap-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-on-brand shadow-card hover:bg-brand-deep has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring">
                <Upload size={16} aria-hidden />
                {logoSrc ? "Заменить логотип" : "Загрузить логотип"}
                <input
                  type="file"
                  accept={TYPES.join(",")}
                  className="sr-only"
                  onChange={(e) => {
                    onFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              {logoSrc && (
                <button
                  type="button"
                  onClick={() => setLogo({ kind: "none" })}
                  className="text-sm text-danger hover:underline"
                >
                  Убрать логотип
                </button>
              )}
            </div>
          </div>
        </Step>

        <Step
          n={2}
          title="Основной цвет"
          text="Кнопки, активный раздел меню, графики и ссылки. Красный, зелёный и жёлтый цвета статусов не меняются."
        >
          <div className="flex flex-wrap gap-2.5">
            {BRAND_PRESETS.map((p) => {
              const selected = p.hex.toLowerCase() === color.toLowerCase();
              return (
                <button
                  key={p.hex}
                  type="button"
                  onClick={() => pick(p.hex)}
                  title={p.name}
                  aria-label={p.name}
                  aria-pressed={selected}
                  className="flex h-11 w-11 items-center justify-center rounded-full transition-transform hover:scale-105"
                  style={{
                    background: p.hex,
                    boxShadow: selected ? `0 0 0 3px var(--color-surface), 0 0 0 5px ${p.hex}` : undefined,
                  }}
                >
                  {selected && <Check size={18} strokeWidth={3} color={textOn(p.hex)} aria-hidden />}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2.5 rounded-full border border-line py-1.5 pr-4 pl-1.5 text-sm">
              <input
                type="color"
                value={color}
                onChange={(e) => pick(e.target.value)}
                className="h-8 w-8 cursor-pointer rounded-full border-0 bg-transparent p-0"
              />
              Свой цвет
            </label>
            <label className="flex items-center gap-2 text-sm text-mute">
              Код
              <input
                value={hexDraft}
                onChange={(e) => {
                  setHexDraft(e.target.value);
                  const hex = normalizeHex(e.target.value);
                  if (hex) {
                    setColor(hex);
                    setMessage(null);
                  }
                }}
                aria-label="Код цвета, например #1D5FD6"
                className="w-28 rounded-[14px] border border-line bg-canvas px-3 py-2 text-sm text-ink uppercase outline-none focus:border-brand focus:bg-surface"
              />
            </label>
          </div>
          {warning && (
            <p className="mt-3 rounded-[16px] bg-warn-soft px-3.5 py-2.5 text-sm text-ink">{warning}</p>
          )}
        </Step>

        <Step
          n={3}
          title="Сохраните"
          text="Передумали — кнопка «Вернуть по умолчанию» возвращает стандартный цвет и убирает логотип."
        />

        <footer className="mt-auto flex flex-col gap-3 border-t border-line pt-5">
          <p
            className={`min-h-5 text-sm ${message?.error ? "text-danger" : message ? "text-good" : "text-mute"}`}
            role="status"
            aria-live="polite"
          >
            {message?.text ??
              (busy ? "Сохраняем…" : dirty ? "Есть несохранённые изменения" : isDefault ? "Сейчас стандартное оформление" : "")}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={reset}
              disabled={busy || isDefault}
              className="flex items-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm font-medium text-mute hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw size={15} aria-hidden />
              Вернуть по умолчанию
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!dirty || busy}
              className="ml-auto rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-on-brand shadow-card hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-mute disabled:shadow-none"
            >
              Сохранить
            </button>
          </div>
        </footer>
      </Card>

      {/* Предпросмотр: нарисован прямо цветами выбранного оттенка, а не
          переменными темы — чтобы показать несохранённый выбор, не трогая
          остальную страницу */}
      <Card className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <h2 className="font-semibold tracking-tight">Предпросмотр</h2>
            <p className="text-sm text-mute">Так будет выглядеть CRM</p>
          </div>
          <div className="flex rounded-full bg-canvas p-1 text-xs">
            {[
              ["Светлая", false],
              ["Тёмная", true],
            ].map(([label, value]) => (
              <button
                key={String(label)}
                type="button"
                onClick={() => setDark(value as boolean)}
                aria-pressed={dark === value}
                className={`rounded-full px-3 py-1.5 ${dark === value ? "bg-surface font-medium text-ink shadow-card" : "text-mute"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div
          className="flex flex-col gap-3 rounded-[16px] p-4"
          style={{ background: preview.bg, color: preview.text }}
          aria-hidden
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full" style={{ background: logoSrc ? "#ffffff" : shades.brand, color: shades.onBrand }}>
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element -- предпросмотр выбранного файла
                <img src={logoSrc} alt="" className="h-full w-full object-contain p-1" />
              ) : (
                <Zap size={16} />
              )}
            </span>
            <span className="flex-1 font-semibold">Главная</span>
            <span className="rounded-full px-3.5 py-2 text-xs font-medium" style={{ background: shades.brand, color: shades.onBrand }}>
              + Добавить
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[14px] p-3.5" style={{ background: preview.card }}>
              <p className="text-xs" style={{ color: preview.mute }}>Портфель</p>
              <p className="mt-1 text-lg font-semibold">2 278 519 ₽</p>
              <p className="text-xs font-medium" style={{ color: shades.onSoft }}>собрано 48%</p>
            </div>
            <div className="flex items-center gap-3 rounded-[14px] p-3.5" style={{ background: preview.card }}>
              <svg viewBox="0 0 52 52" className="h-12 w-12 -rotate-90">
                <circle cx="26" cy="26" r="21" fill="none" stroke={preview.line} strokeWidth="7" />
                <circle cx="26" cy="26" r="21" fill="none" stroke={shades.brand} strokeWidth="7" strokeLinecap="round" strokeDasharray="88 132" />
              </svg>
              <div>
                <p className="text-xs" style={{ color: preview.mute }}>Оплачено</p>
                <p className="text-sm font-semibold">4 из 6</p>
              </div>
            </div>
          </div>

          <div className="rounded-[14px] p-3.5" style={{ background: preview.card }}>
            <p className="mb-2.5 text-sm font-semibold">План поступлений</p>
            <div className="flex h-20 items-end gap-1.5">
              {bars.map((h, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-t-[4px]"
                  style={{ height: `${h}%`, background: shades.brand, opacity: i === 8 ? 1 : 0.55 }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-[14px] p-3" style={{ background: preview.card }}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold" style={{ background: shades.soft, color: shades.onSoft }}>
              ИП
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">Иванов Пётр</p>
              <p className="truncate text-xs" style={{ color: preview.mute }}>Платёж 32 361 ₽ — 25 октября</p>
            </div>
            <span className="rounded-lg px-2 py-0.5 text-[11px] font-medium" style={{ background: preview.goodSoft, color: preview.good }}>В графике</span>
            <span className="rounded-lg px-2 py-0.5 text-[11px] font-medium" style={{ background: preview.badSoft, color: preview.bad }}>Просрочка</span>
          </div>
        </div>
        <p className="text-xs text-mute">
          Логотип также появится на странице входа, в кабинете клиента, на квитанциях и в договоре.
        </p>
      </Card>
    </div>
  );
}


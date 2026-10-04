// Свой основной цвет компании: из одного выбранного цвета считаются все
// оттенки, которые нужны интерфейсу (кнопка, наведение, светлая подложка,
// рамка фокуса, вариант для тёмной темы), и текст на кнопке — белый или
// тёмный, смотря что читается лучше.
//
// Без серверных зависимостей: тот же расчёт и в корневом layout (стиль
// приходит в первом HTML, страница не мигает стандартным цветом), и в браузере —
// для предпросмотра в настройках и применения сразу после сохранения.

/** Стандартный цвет темы — как --primary в app/globals.css. Только для образцов и сравнения. */
export const DEFAULT_BRAND = "#5b6cf0";

export const BRAND_PRESETS: { name: string; hex: string }[] = [
  { name: "Лавандовый (по умолчанию)", hex: DEFAULT_BRAND },
  { name: "Синий", hex: "#1D5FD6" },
  { name: "Бирюзовый", hex: "#075E54" },
  { name: "Фиолетовый", hex: "#7C3AED" },
  { name: "Изумрудный", hex: "#047857" },
  { name: "Оранжевый", hex: "#D9480F" },
  { name: "Бордовый", hex: "#9F1239" },
  { name: "Графит", hex: "#334155" },
];

export const isHexColor = (v: unknown): v is string =>
  typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);

/** Приводит ввод пользователя («1d5fd6», «#1D5FD6») к виду #1d5fd6 или null. */
export function normalizeHex(v: string): string | null {
  const s = v.trim().replace(/^#?/, "#").toLowerCase();
  return isHexColor(s) ? s : null;
}

const DARK_TEXT = "#13202a";

const toRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (rgb: number[]) =>
  "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

/** Смесь двух цветов: k = 0 — первый, 1 — второй. */
export const mix = (a: string, b: string, k: number) => {
  const x = toRgb(a);
  const y = toRgb(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * k));
};

/** Относительная яркость по WCAG, 0 — чёрный, 1 — белый. */
export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Цвет текста на заливке: белый или тёмный — что контрастнее. */
export const textOn = (fill: string) =>
  contrast(fill, "#ffffff") >= contrast(fill, DARK_TEXT) ? "#ffffff" : DARK_TEXT;

/** Подсказка под выбором цвета; null — цвет нормальный. */
export function brandWarning(hex: string): string | null {
  const l = luminance(hex);
  if (l > 0.6) {
    return "Очень светлый цвет: тонкие линии и ссылки будут плохо видны на белом фоне. Лучше выбрать оттенок темнее.";
  }
  if (textOn(hex) !== "#ffffff") {
    return "Светлый цвет — текст на кнопках автоматически станет тёмным, чтобы его было легко читать.";
  }
  return null;
}

export interface BrandShades {
  brand: string;
  /** Верх градиента главной кнопки — светлее основного. */
  hi: string;
  onBrand: string;
  deep: string;
  soft: string;
  onSoft: string;
}

/** Оттенки для светлой темы. */
export function lightShades(hex: string): BrandShades {
  const l = luminance(hex);
  const soft = mix(hex, "#ffffff", 0.88);
  return {
    brand: hex,
    hi: mix(hex, "#ffffff", 0.28),
    onBrand: textOn(hex),
    deep: mix(hex, "#000000", l > 0.3 ? 0.35 : 0.22),
    soft,
    // Текст на светлой подложке: светлым брендовым цветам — темнее
    onSoft: contrast(hex, soft) >= 4.5 ? hex : mix(hex, "#000000", 0.45),
  };
}

function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = toRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6 : max === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function fromHsl(h: number, s: number, l: number): string {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const ch = (t: number) => {
    const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return toHex([ch(h + 1 / 3), ch(h), ch(h - 1 / 3)].map((v) => v * 255));
}

/**
 * Оттенки для тёмной темы. Тёмный цвет осветляем по светлоте HSL (а не
 * смешиванием с белым) — так он остаётся насыщенным, а не становится
 * серым, — пока он не будет хорошо виден на тёмном фоне.
 */
export function darkShades(hex: string): BrandShades {
  // Стандартный цвет: как --primary тёмной темы в globals.css
  let brand = hex.toLowerCase() === DEFAULT_BRAND ? "#8592f7" : hex;
  const [h, sat, light] = toHsl(brand);
  for (let l = light; luminance(brand) < 0.25 && l < 0.8; l += 0.02) {
    brand = fromHsl(h, Math.min(1, sat * 1.05), l);
  }
  return {
    brand,
    hi: mix(brand, "#ffffff", 0.18),
    onBrand: textOn(brand),
    deep: mix(brand, "#ffffff", 0.22),
    soft: mix(brand, "#1a252c", 0.78),
    onSoft: mix(brand, "#ffffff", 0.3),
  };
}

/**
 * CSS, переопределяющий переменные темы из app/globals.css. Пустая строка
 * для стандартного цвета — тогда работает globals.css как есть.
 *
 * Селекторы нарочно специфичнее, чем в globals.css (:root и .dark): этот
 * стиль может оказаться в документе раньше подключённого globals.css.
 * Тёмные значения — только на экране, как и в globals.css: печать светлая.
 */
export function brandCss(color: string | null | undefined): string {
  if (!isHexColor(color)) return "";
  const l = lightShades(color);
  const d = darkShades(color);
  const vars = (s: BrandShades) =>
    [
      `--primary:${s.brand}`,
      `--primary-foreground:${s.onBrand}`,
      `--primary-deep:${s.deep}`,
      `--primary-hi:${s.hi}`,
      `--glow:${s.brand}73`,
      `--chart-1:${s.brand}`,
      `--secondary:${s.soft}`,
      `--secondary-foreground:${s.onSoft}`,
      `--ring:${s.brand}`,
      `--sidebar-primary:${s.brand}`,
      `--sidebar-primary-foreground:${s.onBrand}`,
      `--sidebar-accent:${s.soft}`,
      `--sidebar-accent-foreground:${s.onSoft}`,
      `--sidebar-ring:${s.brand}`,
    ].join(";");
  return `:root:root{${vars(l)}}@media screen{:root:root.dark{${vars(d)}}}`;
}

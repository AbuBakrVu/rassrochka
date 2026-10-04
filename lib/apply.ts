// Онлайн-заявка и калькулятор рассрочки для клиентов (страница /apply).
// Чистые функции — одинаково считают и в браузере, и на сервере, который
// пересчитывает сумму сам и не верит цифрам из формы. Тест: lib/apply.test.ts.

export interface ApplySettings {
  enabled: boolean;
  /** Наценка компании, % к цене товара. */
  markupPct: number;
  /** Сроки на выбор, месяцев. */
  terms: number[];
  /** Минимальный первый взнос, % от цены с наценкой. */
  minDownPct: number;
}

export const APPLY_DEFAULTS: ApplySettings = { enabled: false, markupPct: 15, terms: [3, 6, 9, 12], minDownPct: 0 };

export const APPLY_MIN_PRICE = 1_000;
export const APPLY_MAX_PRICE = 10_000_000;

/** Настройки из базы (settings.apply) — с защитой от мусора. */
export function normalizeApplySettings(raw: unknown): ApplySettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof ApplySettings, unknown>>;
  const num = (v: unknown, min: number, max: number, def: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
  const terms = Array.isArray(r.terms)
    ? [...new Set(r.terms.filter((t): t is number => Number.isInteger(t) && t >= 1 && t <= 60))].sort((a, b) => a - b)
    : [];
  return {
    enabled: r.enabled === true,
    markupPct: num(r.markupPct, 0, 200, APPLY_DEFAULTS.markupPct),
    terms: terms.length ? terms : APPLY_DEFAULTS.terms,
    minDownPct: num(r.minDownPct, 0, 90, APPLY_DEFAULTS.minDownPct),
  };
}

export interface ApplyQuote {
  /** Цена товара с наценкой. */
  total: number;
  minDown: number;
  down: number;
  /** Сумма рассрочки — то, что клиент выплачивает по графику. */
  financed: number;
  monthly: number;
}

/** Расчёт для калькулятора: суммы в рублях, округлены до рубля. */
export function applyQuote(s: ApplySettings, price: number, months: number, down: number): ApplyQuote {
  const total = Math.round(price * (1 + s.markupPct / 100));
  const minDown = Math.ceil((total * s.minDownPct) / 100);
  const d = Math.min(Math.max(Math.round(down) || 0, minDown), total);
  const financed = total - d;
  return { total, minDown, down: d, financed, monthly: months > 0 ? Math.ceil(financed / months) : 0 };
}

/** Проверка заявки; возвращает текст ошибки для клиента или null. */
export function validateApplication(
  s: ApplySettings,
  input: { price: number; months: number; down: number }
): string | null {
  if (!Number.isFinite(input.price) || input.price < APPLY_MIN_PRICE || input.price > APPLY_MAX_PRICE) {
    return `Цена товара — от ${APPLY_MIN_PRICE.toLocaleString("ru-RU")} до ${APPLY_MAX_PRICE.toLocaleString("ru-RU")} ₽`;
  }
  if (!s.terms.includes(input.months)) return "Выберите срок из предложенных";
  const q = applyQuote(s, input.price, input.months, input.down);
  if (input.down < q.minDown) return `Первый взнос — не меньше ${q.minDown.toLocaleString("ru-RU")} ₽`;
  if (q.financed <= 0) return "Первый взнос больше цены — рассрочка не нужна";
  return null;
}

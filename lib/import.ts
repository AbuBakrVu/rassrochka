// Импорт клиентов и сделок из Excel/CSV: колонки, разбор значений и
// проверка строк. Чистые функции — общие для страницы импорта (предпросмотр)
// и сервера (повторная проверка перед записью), тест — lib/import.test.ts.
//
// Формат — одна таблица, строка = клиент и, если указан товар, его сделка.
// Так обычно и ведут рассрочки в Excel до CRM: один лист, по строке на покупку.

export type ImportField =
  | "name" | "phone" | "passport" | "birthDate" | "address" | "inn"
  | "product" | "total" | "down" | "purchase" | "markupPct" | "months" | "openedAt" | "paid"
  | "manager" | "branch" | "category";

export const IMPORT_FIELDS: { key: ImportField; label: string; hint?: string; synonyms: string[] }[] = [
  { key: "name", label: "ФИО клиента", synonyms: ["фио", "клиент", "покупатель", "фамилия имя", "имя"] },
  { key: "phone", label: "Телефон", synonyms: ["телефон", "тел", "номер телефона", "мобильный"] },
  { key: "passport", label: "Паспорт", hint: "серия и номер", synonyms: ["паспорт", "серия и номер", "паспорт серия номер"] },
  { key: "birthDate", label: "Дата рождения", synonyms: ["дата рождения", "др", "рождения"] },
  { key: "address", label: "Адрес", synonyms: ["адрес", "адрес регистрации", "прописка", "адрес проживания"] },
  { key: "inn", label: "ИНН", synonyms: ["инн"] },
  { key: "product", label: "Товар", hint: "пусто — только клиент", synonyms: ["товар", "наименование", "продукт", "покупка"] },
  { key: "total", label: "Цена продажи", hint: "с наценкой, вместе с первым взносом", synonyms: ["цена", "сумма", "сумма сделки", "стоимость", "цена продажи", "итого"] },
  { key: "down", label: "Первый взнос", synonyms: ["первый взнос", "первоначальный взнос", "предоплата", "аванс"] },
  { key: "purchase", label: "Закупка", hint: "или наценка %", synonyms: ["закупка", "закупочная цена", "себестоимость", "цена закупки"] },
  { key: "markupPct", label: "Наценка, %", synonyms: ["наценка", "наценка %", "процент", "маржа %"] },
  { key: "months", label: "Срок, мес.", synonyms: ["срок", "месяцев", "срок мес", "кол-во месяцев", "мес"] },
  { key: "openedAt", label: "Дата выдачи", synonyms: ["дата", "дата выдачи", "дата сделки", "дата оформления", "дата продажи"] },
  { key: "paid", label: "Уже оплачено", hint: "по графику, без первого взноса", synonyms: ["оплачено", "внесено", "погашено", "выплачено", "оплачено по графику"] },
  { key: "manager", label: "Менеджер", hint: "ФИО или почта", synonyms: ["менеджер", "ответственный", "сотрудник"] },
  { key: "branch", label: "Филиал", synonyms: ["филиал", "точка", "магазин"] },
  { key: "category", label: "Категория", synonyms: ["категория", "тип товара"] },
];

export const MAX_IMPORT_ROWS = 2000;

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9%]+/g, " ").trim();

/** Колонка таблицы → поле: по совпадению заголовка с синонимами. */
export function detectColumns(headers: readonly string[]): Partial<Record<ImportField, number>> {
  const out: Partial<Record<ImportField, number>> = {};
  const used = new Set<number>();
  // Сначала точные совпадения, потом «заголовок начинается с синонима» —
  // иначе «дата» забрала бы колонку «Дата рождения»
  for (const exact of [true, false]) {
    for (const field of IMPORT_FIELDS) {
      if (out[field.key] !== undefined) continue;
      const idx = headers.findIndex((h, i) => {
        if (used.has(i)) return false;
        const n = norm(h);
        return field.synonyms.some((s) => (exact ? n === s : n.startsWith(s + " ") || n === s));
      });
      if (idx >= 0) {
        out[field.key] = idx;
        used.add(idx);
      }
    }
  }
  return out;
}

/** "12 500,50 ₽" → 12500.5; пусто — undefined; мусор — NaN. */
export function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  const s = String(value ?? "")
    .replace(/руб\.?|р\.|₽|%/gi, "")
    .replace(/\s/g, "")
    .replace(",", ".");
  if (s === "") return undefined;
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Дата из Excel: число-серийник (дни с 30.12.1899), «05.10.2026»,
 * «5.10.26», «2026-10-05». Возвращает ISO или undefined/"bad".
 */
export function parseDate(value: unknown): string | undefined | "bad" {
  if (value === undefined || value === null || String(value).trim() === "") return undefined;
  if (typeof value === "number" || /^\d{4,5}(\.\d+)?$/.test(String(value).trim())) {
    const serial = Math.floor(Number(value));
    if (serial < 20000 || serial > 80000) return "bad";
    const d = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = String(value).trim();
  let y: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  const ru = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/.exec(s);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (ru) {
    [d, m, y] = [Number(ru[1]), Number(ru[2]), Number(ru[3])];
    if (y < 100) y += 2000;
  } else return "bad";
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return "bad";
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Строка, готовая к записи: клиент и, если есть товар, сделка. */
export interface ImportRow {
  line: number;
  name: string;
  phone: string;
  passportSeries?: string;
  passportNumber?: string;
  birthDate?: string;
  address?: string;
  inn?: string;
  manager?: string;
  branch?: string;
  deal?: {
    product: string;
    category?: string;
    /** Сумма в рассрочку: цена продажи минус первый взнос. */
    amount: number;
    down: number;
    markupPct: number;
    months: number;
    openedAt: string;
    /** Оплачено по графику (без первого взноса). */
    paid: number;
  };
}

export interface CheckedRow {
  line: number;
  row?: ImportRow;
  errors: string[];
  warnings: string[];
}

const cell = (raw: Record<string, unknown>, key: ImportField) => {
  const v = raw[key];
  return v === undefined || v === null ? "" : String(v).trim();
};

/** Проверка одной строки; raw — значения по полям (уже сопоставленные колонки). */
export function checkRow(raw: Record<string, unknown>, line: number, today: string): CheckedRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  const name = cell(raw, "name").replace(/\s+/g, " ");
  if (name.length < 2) errors.push("нет ФИО");
  if (name.length > 200) errors.push("ФИО длиннее 200 символов");

  const phoneRaw = cell(raw, "phone");
  const digits = phoneRaw.replace(/\D/g, "");
  if (phoneRaw && digits.length < 10) errors.push("телефон короче 10 цифр");
  if (!phoneRaw) warnings.push("нет телефона — дубль клиента найдётся только по ФИО");

  const passport = cell(raw, "passport").replace(/\D/g, "");
  if (passport && passport.length !== 10) warnings.push("паспорт не из 10 цифр — не перенесён");

  const birth = parseDate(raw.birthDate);
  if (birth === "bad") warnings.push("дата рождения не распознана — не перенесена");

  const row: ImportRow = {
    line,
    name,
    phone: phoneRaw || "—",
    ...(passport.length === 10 ? { passportSeries: passport.slice(0, 4), passportNumber: passport.slice(4) } : {}),
    ...(birth && birth !== "bad" ? { birthDate: birth } : {}),
    ...(cell(raw, "address") ? { address: cell(raw, "address").slice(0, 300) } : {}),
    ...(cell(raw, "inn") ? { inn: cell(raw, "inn").replace(/\D/g, "").slice(0, 12) } : {}),
    ...(cell(raw, "manager") ? { manager: cell(raw, "manager") } : {}),
    ...(cell(raw, "branch") ? { branch: cell(raw, "branch") } : {}),
  };

  const product = cell(raw, "product");
  if (product) {
    const total = parseNumber(raw.total);
    const down = parseNumber(raw.down) ?? 0;
    const purchase = parseNumber(raw.purchase);
    const markupRaw = parseNumber(raw.markupPct);
    const months = parseNumber(raw.months);
    const opened = parseDate(raw.openedAt);
    const paid = parseNumber(raw.paid) ?? 0;

    if (total === undefined || Number.isNaN(total) || total <= 0) errors.push("нет цены продажи");
    if (Number.isNaN(down) || down < 0) errors.push("первый взнос не число");
    if (months === undefined || Number.isNaN(months) || !Number.isInteger(months) || months < 1 || months > 120) {
      errors.push("срок — целое число месяцев от 1 до 120");
    }
    if (!opened) errors.push("нет даты выдачи");
    else if (opened === "bad") errors.push("дата выдачи не распознана");
    else if (opened > today) errors.push("дата выдачи в будущем");
    if (Number.isNaN(paid) || paid < 0) errors.push("«оплачено» не число");

    let markupPct = 0;
    if (purchase !== undefined && !Number.isNaN(purchase) && purchase > 0 && total) {
      markupPct = Math.round((total / purchase - 1) * 10000) / 100;
      if (markupPct < 0) errors.push("закупка больше цены продажи");
    } else if (markupRaw !== undefined && !Number.isNaN(markupRaw)) {
      markupPct = markupRaw;
      if (markupPct < 0 || markupPct > 1000) errors.push("наценка вне 0–1000%");
    } else {
      warnings.push("нет закупки и наценки — прибыль по сделке будет 0");
    }

    const amount = (total ?? 0) - down;
    if (total && amount <= 0) errors.push("первый взнос не меньше цены — в рассрочку ничего не остаётся");
    if (paid > amount && amount > 0) errors.push("оплачено больше суммы в рассрочку");

    if (errors.length === 0) {
      row.deal = {
        product: product.slice(0, 200),
        ...(cell(raw, "category") ? { category: cell(raw, "category").slice(0, 60) } : {}),
        amount: Math.round(amount * 100) / 100,
        down: Math.round(down * 100) / 100,
        markupPct,
        months: months!,
        openedAt: opened as string,
        paid: Math.round(paid * 100) / 100,
      };
    }
  } else if (cell(raw, "total") || cell(raw, "months")) {
    warnings.push("есть сумма, но нет товара — сделка не создастся, только клиент");
  }

  return { line, ...(errors.length === 0 ? { row } : {}), errors, warnings };
}

/** Ключ клиента для поиска дублей: последние 10 цифр телефона или ФИО. */
export const clientKey = (r: { phone: string; name: string }) => {
  const digits = r.phone.replace(/\D/g, "");
  return digits.length >= 10 ? `p:${digits.slice(-10)}` : `n:${norm(r.name)}`;
};

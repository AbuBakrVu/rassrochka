import "server-only";

// Оформление компании на сервере: чтение для корневого layout (цвет и
// логотип нужны уже в первом HTML) и запись из Настроек → Оформление.
// Хранение — миграция 019: settings.brand_color и таблица company_logo.

import { headers } from "next/headers";
import { query, queryOne } from "./db";
import { resolveTenant } from "./tenant";
import { isHexColor } from "./brand-color";

export interface Branding {
  /** "#rrggbb" или null — стандартная бирюзовая тема. */
  color: string | null;
  /** Меняется при каждой загрузке логотипа — входит в адрес картинки, чтобы браузер не показал старую. null — логотипа нет. */
  logoVersion: string | null;
  /** Название компании из реестра — подпись рядом с логотипом. */
  companyName: string | null;
}

export const NO_BRANDING: Branding = { color: null, logoVersion: null, companyName: null };

// Оформление читается на каждой загрузке страницы, а меняется редко.
// Кеш в памяти процесса (приложение одно на сервер компании) сбрасывается
// при сохранении, так что администратор видит свои изменения сразу.
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { value: Omit<Branding, "companyName">; at: number }>();

export function forgetBranding(dbName: string) {
  cache.delete(dbName);
}

export async function loadBranding(dbName: string): Promise<Omit<Branding, "companyName">> {
  const hit = cache.get(dbName);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const [colorRow, logoRow] = await Promise.all([
    queryOne<{ value: unknown }>(dbName, "select value from settings where key = 'brand_color'"),
    // До миграции 019 таблицы нет — тогда просто без логотипа
    queryOne<{ updated_at: Date }>(dbName, "select updated_at from company_logo where id = 1").catch(() => undefined),
  ]);
  const value = {
    color: isHexColor(colorRow?.value) ? colorRow.value : null,
    logoVersion: logoRow ? String(logoRow.updated_at.getTime()) : null,
  };
  cache.set(dbName, { value, at: Date.now() });
  return value;
}

/**
 * Оформление компании текущего запроса — для корневого layout. Никогда не
 * бросает: на корневом домене, при неизвестной компании или недоступной
 * базе страница рисуется в стандартной теме, а не падает.
 */
export async function requestBranding(): Promise<Branding> {
  try {
    const tenant = await resolveTenant((await headers()).get("host"));
    return { ...(await loadBranding(tenant.dbName)), companyName: tenant.name };
  } catch {
    return NO_BRANDING;
  }
}

export async function saveBrandColor(dbName: string, color: string | null): Promise<void> {
  if (color === null) {
    await query(dbName, "delete from settings where key = 'brand_color'");
  } else {
    await query(
      dbName,
      `insert into settings (key, value) values ('brand_color', $1::jsonb)
       on conflict (key) do update set value = excluded.value`,
      [JSON.stringify(color)]
    );
  }
  forgetBranding(dbName);
}

export const LOGO_MAX_BYTES = 500 * 1024;

const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] as const;
type LogoType = (typeof LOGO_TYPES)[number];

export class LogoError extends Error {}

/** Сигнатура файла должна совпадать с заявленным типом — иначе это не та картинка, за которую себя выдаёт. */
function matchesType(data: Buffer, type: LogoType): boolean {
  if (type === "image/png") return data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === "image/jpeg") return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (type === "image/webp") return data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP";
  // SVG — текст: должен быть svg-документом и без активного содержимого.
  // Картинка в <img> скрипты и так не выполняет, но файл можно открыть по
  // прямой ссылке — поэтому отказ здесь плюс песочница в заголовках ответа.
  const text = data.toString("utf8");
  if (!/<svg[\s>]/i.test(text)) return false;
  return !/<script|<foreignObject|<iframe|<embed|<object|javascript:|\son[a-z]+\s*=/i.test(text);
}

/** Разбирает data:-URL из формы настроек и сохраняет логотип. */
export async function saveLogo(dbName: string, dataUrl: string): Promise<void> {
  const m = /^data:([a-z+/]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new LogoError("Не удалось прочитать картинку — попробуйте другой файл");
  const type = m[1] as LogoType;
  if (!LOGO_TYPES.includes(type)) throw new LogoError("Подходят только PNG, JPG, WebP или SVG");
  const data = Buffer.from(m[2], "base64");
  if (data.length === 0) throw new LogoError("Файл пустой");
  if (data.length > LOGO_MAX_BYTES) throw new LogoError("Файл больше 500 КБ — уменьшите картинку");
  if (!matchesType(data, type)) {
    throw new LogoError(
      type === "image/svg+xml"
        ? "Этот SVG содержит скрипты или встроенные элементы — сохраните его как PNG"
        : "Файл повреждён или это не картинка"
    );
  }
  await query(
    dbName,
    `insert into company_logo (id, data, content_type, updated_at) values (1, $1, $2, now())
     on conflict (id) do update set data = excluded.data, content_type = excluded.content_type, updated_at = now()`,
    [data, type]
  );
  forgetBranding(dbName);
}

export async function deleteLogo(dbName: string): Promise<void> {
  await query(dbName, "delete from company_logo where id = 1");
  forgetBranding(dbName);
}

export async function loadLogo(dbName: string): Promise<{ data: Buffer; contentType: string } | null> {
  const row = await queryOne<{ data: Buffer; content_type: string }>(
    dbName,
    "select data, content_type from company_logo where id = 1"
  );
  return row ? { data: row.data, contentType: row.content_type } : null;
}

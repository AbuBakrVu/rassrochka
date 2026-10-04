import "server-only";

// Файлы клиента и сделки (миграция 023): фото паспорта, документы, фото
// товара. Хранятся в базе компании — попадают в резервные копии. Тип
// проверяется по содержимому, а не по расширению: под видом «фото» нельзя
// загрузить HTML или скрипт.

import { query, queryOne } from "./db";

export type AttachmentKind = "passport" | "document" | "product" | "other";

export interface Attachment {
  id: string;
  clientId?: string;
  dealId?: string;
  kind: AttachmentKind;
  name: string;
  contentType: string;
  size: number;
  at: string;
}

export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;

const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

export class AttachmentError extends Error {}

function matches(data: Buffer, type: string): boolean {
  if (type === "image/png") return data.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  if (type === "image/jpeg") return data[0] === 0xff && data[1] === 0xd8;
  if (type === "image/webp") return data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP";
  if (type === "application/pdf") return data.toString("ascii", 0, 5) === "%PDF-";
  return false;
}

interface Row extends Record<string, unknown> {
  id: number;
  client_id: string | null;
  deal_id: string | null;
  kind: AttachmentKind;
  name: string;
  content_type: string;
  size: number;
  created_at: Date;
}

const toAttachment = (r: Row): Attachment => ({
  id: String(r.id),
  kind: r.kind,
  name: r.name,
  contentType: r.content_type,
  size: r.size,
  at: r.created_at.toISOString(),
  ...(r.client_id ? { clientId: r.client_id } : {}),
  ...(r.deal_id ? { dealId: r.deal_id } : {}),
});

export async function listAttachments(dbName: string): Promise<Attachment[]> {
  // Таблицы нет до миграции 023 — тогда файлов просто нет
  const rows = await query<Row>(
    dbName,
    `select id, client_id, deal_id, kind, name, content_type, size, created_at
     from attachments order by created_at desc`
  ).catch(() => [] as Row[]);
  return rows.map(toAttachment);
}

export async function saveAttachment(
  dbName: string,
  input: { clientId?: string; dealId?: string; kind: AttachmentKind; name: string; dataUrl: string; userId: number }
): Promise<Attachment> {
  const m = /^data:([a-z/+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(input.dataUrl);
  if (!m) throw new AttachmentError("Не удалось прочитать файл");
  const type = m[1];
  if (!(TYPES as readonly string[]).includes(type)) {
    throw new AttachmentError("Подходят фото (JPG, PNG, WebP) или PDF");
  }
  const data = Buffer.from(m[2], "base64");
  if (data.length === 0) throw new AttachmentError("Файл пустой");
  if (data.length > ATTACHMENT_MAX_BYTES) throw new AttachmentError("Файл больше 5 МБ — уменьшите его");
  if (!matches(data, type)) throw new AttachmentError("Файл повреждён или это не тот формат");

  const row = await queryOne<Row>(
    dbName,
    `insert into attachments (client_id, deal_id, kind, name, content_type, size, data, user_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id, client_id, deal_id, kind, name, content_type, size, created_at`,
    [input.clientId ?? null, input.dealId ?? null, input.kind, input.name.slice(0, 200), type, data.length, data, input.userId]
  );
  if (!row) throw new Error("Файл не сохранён");
  return toAttachment(row);
}

export async function loadAttachment(
  dbName: string,
  id: string
): Promise<{ data: Buffer; contentType: string; name: string; kind: AttachmentKind } | null> {
  if (!/^\d{1,18}$/.test(id)) return null;
  const row = await queryOne<{ data: Buffer; content_type: string; name: string; kind: AttachmentKind }>(
    dbName,
    "select data, content_type, name, kind from attachments where id = $1",
    [id]
  );
  return row ? { data: row.data, contentType: row.content_type, name: row.name, kind: row.kind } : null;
}

/** Удаляет файл; возвращает, что удалили (для журнала), или null. */
export async function deleteAttachment(
  dbName: string,
  id: string
): Promise<{ name: string; clientId?: string; dealId?: string } | null> {
  if (!/^\d{1,18}$/.test(id)) return null;
  const row = await queryOne<{ name: string; client_id: string | null; deal_id: string | null }>(
    dbName,
    "delete from attachments where id = $1 returning name, client_id, deal_id",
    [id]
  );
  if (!row) return null;
  return { name: row.name, clientId: row.client_id ?? undefined, dealId: row.deal_id ?? undefined };
}

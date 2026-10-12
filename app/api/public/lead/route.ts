// Заявка на подключение CRM с лендинга (корневой домен). Без входа:
// пишет контакт в реестр (таблица leads, миграция control/003).

import { NextResponse } from "next/server";
import { CONTROL_DB, query } from "@/lib/db";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

export async function POST(request: Request) {
  const ip = clientIp(request);

  // Не больше 3 заявок с одного адреса за 15 минут
  if (!checkRateLimit(`lead:${ip}`, 3)) {
    return NextResponse.json({ error: "Слишком много заявок подряд — попробуйте позже" }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return bad("Не удалось прочитать заявку");

  // Ловушка для ботов, как в /api/public/apply: отвечаем «принято»
  if (typeof body.website === "string" && body.website !== "") return NextResponse.json({ ok: true });

  const text = (k: string, max: number) => (typeof body[k] === "string" ? (body[k] as string).trim().slice(0, max) : "");
  const name = text("name", 100).replace(/\s+/g, " ");
  const phone = text("phone", 30);
  const company = text("company", 150);
  const comment = text("comment", 1000);

  if (name.length < 2) return bad("Укажите, как к вам обращаться");
  // Международный номер: клиенты не только из России
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return bad("Укажите номер телефона полностью, с кодом страны");
  if (body.consent !== true) return bad("Нужно согласие на обработку персональных данных");

  try {
    await query(
      CONTROL_DB,
      "insert into leads (name, phone, company, comment, ip) values ($1, $2, $3, $4, $5)",
      [name, `+${digits}`, company, comment, ip]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[lead]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Не удалось отправить заявку — попробуйте позже" }, { status: 500 });
  }
}

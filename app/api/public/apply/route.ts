// Публичная онлайн-заявка (/apply): без входа, на поддомене компании.
// GET — условия для калькулятора, POST — заявка. Пока администратор не
// включил заявку в настройках, оба отвечают «выключено».

import { NextResponse } from "next/server";
import { resolveTenant } from "@/lib/tenant";
import { createOnlineApplication, loadApplySettings } from "@/lib/queries";
import { validateApplication } from "@/lib/apply";
import { audit } from "@/lib/audit";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

const OFF = { error: "Онлайн-заявка сейчас не принимается" };

export async function GET(request: Request) {
  try {
    const tenant = await resolveTenant(request.headers.get("host"));
    const settings = await loadApplySettings(tenant.dbName);
    if (!settings.enabled) return NextResponse.json(OFF, { status: 404 });
    const { markupPct, terms, minDownPct } = settings;
    return NextResponse.json({ markupPct, terms, minDownPct });
  } catch {
    return NextResponse.json(OFF, { status: 404 });
  }
}

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

export async function POST(request: Request) {
  let tenant;
  try {
    tenant = await resolveTenant(request.headers.get("host"));
  } catch {
    return NextResponse.json(OFF, { status: 404 });
  }
  const settings = await loadApplySettings(tenant.dbName).catch(() => null);
  if (!settings?.enabled) return NextResponse.json(OFF, { status: 404 });

  // Не больше 5 заявок с одного адреса за 15 минут — от ботов и случайных
  // повторных нажатий
  if (!checkRateLimit(`apply:${tenant.dbName}:${clientIp(request)}`, 5)) {
    return NextResponse.json({ error: "Слишком много заявок подряд — попробуйте позже" }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return bad("Не удалось прочитать заявку");

  // Ловушка для ботов: поле скрыто от людей, бот его заполняет. Отвечаем
  // «принято», чтобы бот не подбирал обход
  if (typeof body.website === "string" && body.website !== "") return NextResponse.json({ ok: true });

  const text = (k: string, max: number) => (typeof body[k] === "string" ? (body[k] as string).trim().slice(0, max) : "");
  const name = text("name", 100).replace(/\s+/g, " ");
  const phone = text("phone", 30);
  const product = text("product", 200);
  const comment = text("comment", 500);
  const price = Number(body.price);
  const months = Number(body.months);
  const down = Number(body.down ?? 0);

  if (name.length < 2) return bad("Укажите имя и фамилию");
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 11 || !/^[78]/.test(digits)) return bad("Укажите номер телефона полностью: +7 и 10 цифр");
  if (product.length < 2) return bad("Напишите, что хотите купить");
  if (body.consent !== true) return bad("Нужно согласие на обработку персональных данных");
  const invalid = validateApplication(settings, { price, months, down });
  if (invalid) return bad(invalid);

  try {
    const normalizedPhone = `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
    const result = await createOnlineApplication(
      tenant.dbName,
      { name, phone: normalizedPhone, product, price, months, down, comment },
      settings
    );
    await audit(
      tenant.dbName, null, "deal.online", result.dealId,
      `Онлайн-заявка ${result.dealId}: ${product} · ${result.newClient ? "новый клиент" : `клиент ${result.clientId}`}`
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[apply]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Не удалось отправить заявку — попробуйте позже или позвоните нам" }, { status: 500 });
  }
}

// Проверка живости для мониторинга и docker healthcheck.
// Наружу не отдаёт ничего, что помогло бы атакующему: ни версий, ни имён баз.

import { NextResponse } from "next/server";
import { CONTROL_DB, query } from "@/lib/db";

export async function GET() {
  try {
    await query(CONTROL_DB, "select 1");
    return NextResponse.json({ ok: true });
  } catch {
    // 503, а не 500: мониторинг должен отличать «приложение живо, но БД
    // недоступна» от полного падения процесса
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}

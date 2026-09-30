// Публичная квитанция о платеже — как и сам кабинет, без авторизации, по
// токену из ссылки. Платёж обязан принадлежать сделке этого токена (см.
// loadPortalReceipt), иначе ответ тот же 404, что и на неизвестный токен.

import { NextResponse } from "next/server";
import { resolveTenant } from "@/lib/tenant";
import { loadPortalReceipt } from "@/lib/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  const { token, id } = await params;

  try {
    const tenant = await resolveTenant(request.headers.get("host"));
    const receipt = await loadPortalReceipt(tenant.dbName, token, id, tenant.name);
    if (receipt) return NextResponse.json(receipt);
  } catch {
    // ниже — тот же ответ, что и на чужую квитанцию
  }
  return NextResponse.json({ error: "Квитанция не найдена" }, { status: 404 });
}

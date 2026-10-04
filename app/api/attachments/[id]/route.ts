import { NextResponse } from "next/server";
import { handle, sessionFor } from "@/app/api/_lib/handler";
import { deleteAttachment, loadAttachment } from "@/lib/attachments";
import { audit } from "@/lib/audit";
import { assertClientInScope, assertDealInScope } from "@/lib/scope";

// Файл клиента — только сотрудникам, которые видят клиентов (не бухгалтеру:
// паспортные данные ему не положены, см. loadBootstrap)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { tenant, user } = await sessionFor(request, { perm: "clients.personal" });
    const file = await loadAttachment(tenant.dbName, id);
    if (!file) return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
    if (file.clientId) await assertClientInScope(tenant.dbName, user, file.clientId);
    if (file.dealId) await assertDealInScope(tenant.dbName, user, file.dealId);
    return new Response(new Uint8Array(file.data), {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        // Паспортные данные не должны оседать в общих кешах
        "Cache-Control": "private, max-age=3600",
        // Картинки открываются в «песочнице». PDF в песочнице браузер не
        // показывает, поэтому для него только запрет всего внешнего: тип
        // файла проверен по содержимому при загрузке (lib/attachments.ts)
        "Content-Security-Policy":
          file.contentType === "application/pdf"
            ? "default-src 'none'; object-src 'self'"
            : "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    const status = err instanceof Error && err.name === "ForbiddenError" ? 403 : 401;
    return NextResponse.json({ error: "Нет доступа" }, { status });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handle(
    request,
    async ({ tenant, user }) => {
      const existing = await loadAttachment(tenant.dbName, id);
      if (existing?.clientId) await assertClientInScope(tenant.dbName, user, existing.clientId);
      if (existing?.dealId) await assertDealInScope(tenant.dbName, user, existing.dealId);
      const file = await deleteAttachment(tenant.dbName, id);
      if (file) {
        const owner = file.clientId ? `клиент ${file.clientId}` : `сделка ${file.dealId}`;
        await audit(tenant.dbName, user.id, "client.document", file.clientId ?? file.dealId ?? null, `Удалён файл «${file.name}» · ${owner}`);
      }
      return { ok: file !== null };
    },
    { perm: "clients.edit" }
  );
}

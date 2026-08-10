import { handle } from "@/app/api/_lib/handler";
import { recordReminderSent } from "@/lib/queries";

// Сам переход в WhatsApp происходит на клиенте (wa.me-ссылка) — сюда
// приходят только зафиксировать факт отправки в истории сделки.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(request, async ({ tenant }) => {
    await recordReminderSent(tenant.dbName, id);
    return { ok: true };
  });
}

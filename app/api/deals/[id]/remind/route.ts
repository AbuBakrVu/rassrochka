import { handle, optionalStr, BadRequestError } from "@/app/api/_lib/handler";
import { recordReminderSent } from "@/lib/queries";

const STAGES = ["before", "due", "overdue_soft", "overdue_hard"];

// Сам переход в WhatsApp происходит на клиенте (wa.me-ссылка) — сюда
// приходят только зафиксировать факт отправки в истории сделки и, если
// напоминание пришло из очереди лесенки, — стадию и дату взноса.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(
    request,
    async ({ tenant, body }) => {
      const stage = optionalStr(body, "stage");
      const dueDate = optionalStr(body, "dueDate");
      if (stage && !STAGES.includes(stage)) {
        throw new BadRequestError("Неизвестная стадия напоминания");
      }
      await recordReminderSent(
        tenant.dbName,
        id,
        stage && dueDate ? { stage, dueDate } : undefined
      );
      return { ok: true };
    },
    { perm: "deals.edit", dealId: id }
  );
}

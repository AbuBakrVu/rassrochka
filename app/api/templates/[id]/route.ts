import { handle, str, optionalStr, BadRequestError } from "@/app/api/_lib/handler";
import { deleteTemplate, updateTemplate } from "@/lib/queries";

const STAGES = ["before", "due", "overdue_soft", "overdue_hard"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(
    request,
    ({ tenant, body }) => {
      const stage = optionalStr(body, "stage");
      if (stage && !STAGES.includes(stage)) {
        throw new BadRequestError("Неизвестная стадия напоминания");
      }
      return updateTemplate(tenant.dbName, id, {
        name: str(body, "name", { max: 120 }),
        body: str(body, "body", { max: 2000 }),
        stage: stage || null,
      });
    },
    { adminOnly: true }
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(
    request,
    async ({ tenant }) => {
      await deleteTemplate(tenant.dbName, id);
      return { ok: true };
    },
    { adminOnly: true }
  );
}

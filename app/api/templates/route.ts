import { handle, str, optionalStr, BadRequestError } from "@/app/api/_lib/handler";
import { createTemplate } from "@/lib/queries";

const STAGES = ["before", "due", "overdue_soft", "overdue_hard"];

export async function POST(request: Request) {
  return handle(
    request,
    ({ tenant, body }) => {
      const stage = optionalStr(body, "stage");
      if (stage && !STAGES.includes(stage)) {
        throw new BadRequestError("Неизвестная стадия напоминания");
      }
      return createTemplate(tenant.dbName, {
        name: str(body, "name", { max: 120 }),
        body: str(body, "body", { max: 2000 }),
        stage: stage || null,
      });
    },
    { adminOnly: true }
  );
}

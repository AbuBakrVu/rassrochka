// Массовые действия на канбане: сменить этап или ответственного сразу у
// нескольких сделок. Каждая сделка проходит тем же путём, что и одиночное
// действие (те же проверки, та же запись в историю), — ошибка по одной
// сделке не отменяет остальные, а возвращается в списке failed.

import { BadRequestError, handle, num, str, strArray } from "@/app/api/_lib/handler";
import { ForbiddenError } from "@/lib/auth";
import { reassignDeal, setDealStage } from "@/lib/queries";
import { stages } from "@/lib/data";
import { audit, employeeName } from "@/lib/audit";

const STAGES = ["new", "check", "active"] as const;
type Stage = (typeof STAGES)[number];

const ERRORS: Record<string, string> = {
  HAS_PAYMENTS: "есть принятые платежи — увести из «Активна» нельзя",
  MANAGER_NOT_FOUND: "сотрудник не найден или отключён",
  BAD_STAGE: "сделка уже закрыта или отклонена",
};

export async function POST(request: Request) {
  return handle(
    request,
    async ({ tenant, body, user }) => {
      const ids = strArray(body, "ids", { maxItems: 200, maxLen: 20 });
      if (ids.length === 0) throw new BadRequestError("Не выбрано ни одной сделки");
      const action = str(body, "action", { max: 10 });

      let run: (id: string) => Promise<{ client: string }>;
      let summary: string;

      if (action === "stage") {
        const stage = str(body, "stage", { max: 10 }) as Stage;
        if (!STAGES.includes(stage)) {
          throw new BadRequestError("Стадия должна быть new, check или active");
        }
        run = (id) => setDealStage(tenant.dbName, id, stage);
        summary = `перенесены в этап «${stages.find((s) => s.key === stage)?.title}»`;
      } else if (action === "manager") {
        // Как и на карточке сделки, ответственного массово меняет только администратор
        if (user.role !== "admin") throw new ForbiddenError();
        const managerId = num(body, "managerId", { min: 1, integer: true });
        run = (id) => reassignDeal(tenant.dbName, id, managerId);
        summary = `назначен ответственный — ${await employeeName(tenant.dbName, managerId)}`;
      } else {
        throw new BadRequestError("Действие должно быть stage или manager");
      }

      const ok: string[] = [];
      const failed: { id: string; error: string }[] = [];
      for (const id of ids) {
        try {
          await run(id);
          ok.push(id);
        } catch (err) {
          const code = err instanceof Error ? err.message : "";
          failed.push({ id, error: ERRORS[code] ?? "не удалось изменить" });
        }
      }

      if (ok.length > 0) {
        await audit(
          tenant.dbName, user.id, action === "stage" ? "deal.stage" : "deal.manager", null,
          `Массово (${ok.length}): ${ok.join(", ")} — ${summary}`
        );
      }
      return { ok, failed };
    },
    { roles: ["admin", "manager"] }
  );
}

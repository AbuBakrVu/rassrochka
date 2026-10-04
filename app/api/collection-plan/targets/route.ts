// Цели сборов по менеджерам на месяц (План/факт в Аналитике). Без цели
// план менеджера считается сам по графикам — lib/collection-plan.ts.

import { BadRequestError, handle, num, str } from "@/app/api/_lib/handler";
import { query } from "@/lib/db";
import { audit, employeeName, rub } from "@/lib/audit";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function monthOf(value: string | null): string {
  if (!value || !MONTH.test(value)) throw new BadRequestError("Месяц — в виде ГГГГ-ММ");
  return value;
}

export async function GET(request: Request) {
  return handle(
    request,
    async ({ tenant }) => {
      const month = monthOf(new URL(request.url).searchParams.get("month"));
      const rows = await query<{ manager_id: number; amount: number }>(
        tenant.dbName,
        "select manager_id, amount from collection_targets where month = $1",
        [`${month}-01`]
      );
      return rows.map((r) => ({ managerId: r.manager_id, amount: Number(r.amount) }));
    },
    { perm: "analytics" }
  );
}

/** { month, managerId, amount } — amount: null снимает цель. */
export async function PUT(request: Request) {
  return handle(
    request,
    async ({ tenant, body, user }) => {
      const month = monthOf(str(body, "month", { max: 7 }));
      const managerId = num(body, "managerId", { min: 1, integer: true });
      const raw = (body as { amount?: unknown }).amount;
      const name = await employeeName(tenant.dbName, managerId);

      if (raw === null) {
        await query(tenant.dbName, "delete from collection_targets where month = $1 and manager_id = $2", [
          `${month}-01`,
          managerId,
        ]);
        await audit(tenant.dbName, user.id, "plan.target", null, `План сборов на ${month} для ${name} — снова по графикам`);
        return { ok: true };
      }

      const amount = Math.round(num(body, "amount", { min: 0, max: 1e10 }));
      await query(
        tenant.dbName,
        `insert into collection_targets (month, manager_id, amount) values ($1, $2, $3)
         on conflict (month, manager_id) do update set amount = excluded.amount, updated_at = now()`,
        [`${month}-01`, managerId, amount]
      );
      await audit(tenant.dbName, user.id, "plan.target", null, `План сборов на ${month} для ${name}: ${rub(amount)}`);
      return { ok: true };
    },
    { adminOnly: true }
  );
}

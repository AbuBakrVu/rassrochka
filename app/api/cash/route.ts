import { handle, isoDate, num, str } from "@/app/api/_lib/handler";
import { addCashAdjustment } from "@/lib/queries";
import { audit, rub } from "@/lib/audit";

export async function POST(request: Request) {
  return handle(request, async ({ tenant, body, user }) => {
    const tx = await addCashAdjustment(tenant.dbName, {
      amount: num(body, "amount", { min: -1e9, max: 1e9 }),
      title: str(body, "title", { max: 200 }),
      date: isoDate(body, "date"),
    });
    await audit(
      tenant.dbName, user.id, "cash.adjustment", null,
      `Ручная операция по кассе: ${tx.amount >= 0 ? "внесение" : "изъятие"} ${rub(Math.abs(tx.amount))} · «${tx.title}», дата ${tx.date}`
    );
    return tx;
  });
}

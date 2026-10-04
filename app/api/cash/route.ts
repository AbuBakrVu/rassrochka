import { handle, isoDate, num, optionalNum, str } from "@/app/api/_lib/handler";
import { addCashAdjustment } from "@/lib/queries";
import { audit, rub } from "@/lib/audit";
import { branchForWrite } from "@/lib/scope";
import { branchName } from "@/lib/org";

export async function POST(request: Request) {
  return handle(request, async ({ tenant, body, user }) => {
    // Касса филиала: у сотрудника с филиалом — его, у остальных — выбранный
    // в шапке; без филиала — общая касса компании
    const branchId = await branchForWrite(
      tenant.dbName, user, optionalNum(body, "branchId", { min: 1, integer: true })
    );
    const tx = await addCashAdjustment(tenant.dbName, {
      amount: num(body, "amount", { min: -1e9, max: 1e9 }),
      title: str(body, "title", { max: 200 }),
      date: isoDate(body, "date"),
      branchId,
    });
    await audit(
      tenant.dbName, user.id, "cash.adjustment", null,
      `Ручная операция по кассе: ${tx.amount >= 0 ? "внесение" : "изъятие"} ${rub(Math.abs(tx.amount))} · «${tx.title}», дата ${tx.date}` +
        (branchId !== undefined ? ` · ${await branchName(tenant.dbName, branchId)}` : "")
    );
    return tx;
  }, { perm: "cash.edit" });
}

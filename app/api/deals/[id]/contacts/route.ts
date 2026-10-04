import { BadRequestError, handle, optionalNum, optionalStr, str } from "@/app/api/_lib/handler";
import { addContact } from "@/lib/queries";
import { OUTCOME_LABEL, type ContactOutcome } from "@/lib/collections";
import { audit } from "@/lib/audit";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Записать звонок по просроченной сделке: итог, дата обещания или перезвона
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(
    request,
    async ({ tenant, body, user }) => {
      const outcome = str(body, "outcome", { max: 20 }) as ContactOutcome;
      if (!(outcome in OUTCOME_LABEL)) throw new BadRequestError("Неизвестный итог звонка");
      const dueDate = optionalStr(body, "dueDate");
      if (dueDate && !ISO_DATE.test(dueDate)) throw new BadRequestError("Дата — в виде ГГГГ-ММ-ДД");
      if ((outcome === "promise" || outcome === "callback") && !dueDate) {
        throw new BadRequestError(outcome === "promise" ? "Укажите, к какой дате обещал оплатить" : "Укажите, когда перезвонить");
      }
      const contact = await addContact(tenant.dbName, id, user.id, {
        outcome,
        ...(dueDate ? { dueDate } : {}),
        amount: optionalNum(body, "amount", { min: 1, max: 1e9 }),
        note: optionalStr(body, "note", ""),
      });
      await audit(tenant.dbName, user.id, "deal.contact", id, `Звонок по сделке ${id}: ${OUTCOME_LABEL[outcome].toLowerCase()}`);
      return contact;
    },
    { roles: ["admin", "manager"] }
  );
}

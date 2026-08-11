// Принять один ближайший взнос. Идемпотентности нет по смыслу: повторный
// вызов засчитает следующий платёж, поэтому кнопка блокируется на клиенте.

import { BadRequestError, handle, optionalStr } from "@/app/api/_lib/handler";
import { acceptPayment } from "@/lib/queries";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const METHODS = new Set(["cash", "card", "transfer"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handle(request, ({ tenant, body }) => {
    const date = optionalStr(body, "date");
    if (date && !ISO_DATE.test(date)) {
      throw new BadRequestError("Поле «date» должно быть датой вида ГГГГ-ММ-ДД");
    }
    const method = optionalStr(body, "method");
    if (method && !METHODS.has(method)) {
      throw new BadRequestError("Поле «method» должно быть cash, card или transfer");
    }

    return acceptPayment(tenant.dbName, id, {
      ...(date ? { date } : {}),
      ...(method ? { method: method as "cash" | "card" | "transfer" } : {}),
    });
  });
}

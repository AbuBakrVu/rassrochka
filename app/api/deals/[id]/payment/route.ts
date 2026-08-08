// Принять один ближайший взнос. Идемпотентности нет по смыслу: повторный
// вызов засчитает следующий платёж, поэтому кнопка блокируется на клиенте.

import { handle } from "@/app/api/_lib/handler";
import { acceptPayment } from "@/lib/queries";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handle(request, ({ tenant }) => acceptPayment(tenant.dbName, id));
}

import { BadRequestError, handle, isoDate, num, optionalStr, str } from "@/app/api/_lib/handler";
import { restructureDeal } from "@/lib/queries";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(request, async ({ tenant, body }) => {
    try {
      return await restructureDeal(tenant.dbName, id, {
        months: num(body, "months", { min: 1, max: 60, integer: true }),
        from: isoDate(body, "from"),
        reason: str(body, "reason", { max: 200 }),
        comment: optionalStr(body, "comment", ""),
      });
    } catch (err) {
      if (err instanceof Error && err.message === "NOT_ACTIVE") {
        throw new BadRequestError("Реструктурировать можно только активную сделку");
      }
      throw err;
    }
  });
}

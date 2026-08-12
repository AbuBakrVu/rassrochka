import { BadRequestError, handle } from "@/app/api/_lib/handler";
import { closeDealEarly } from "@/lib/queries";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(request, async ({ tenant }) => {
    try {
      return await closeDealEarly(tenant.dbName, id);
    } catch (err) {
      if (err instanceof Error && err.message === "NOT_ACTIVE") {
        throw new BadRequestError("Закрыть досрочно можно только активную сделку");
      }
      throw err;
    }
  });
}

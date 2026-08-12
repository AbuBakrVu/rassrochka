import { BadRequestError, handle, num } from "@/app/api/_lib/handler";
import { reassignDeal } from "@/lib/queries";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(request, async ({ tenant, body }) => {
    try {
      return await reassignDeal(
        tenant.dbName,
        id,
        num(body, "managerId", { min: 1, integer: true })
      );
    } catch (err) {
      if (err instanceof Error && err.message === "MANAGER_NOT_FOUND") {
        throw new BadRequestError("Такой сотрудник не найден или отключён");
      }
      throw err;
    }
  });
}

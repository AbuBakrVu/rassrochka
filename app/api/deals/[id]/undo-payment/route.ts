import { BadRequestError, handle } from "@/app/api/_lib/handler";
import { undoLastPayment } from "@/lib/queries";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(
    request,
    async ({ tenant }) => {
      try {
        return await undoLastPayment(tenant.dbName, id);
      } catch (err) {
        if (err instanceof Error && err.message === "NOTHING_TO_UNDO") {
          throw new BadRequestError("По этой сделке ещё нет принятых платежей");
        }
        throw err;
      }
    },
    { adminOnly: true }
  );
}

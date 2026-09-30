import { BadRequestError, handle } from "@/app/api/_lib/handler";
import { closeDealEarly } from "@/lib/queries";
import { audit } from "@/lib/audit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(
    request,
    async ({ tenant, user }) => {
      try {
        const deal = await closeDealEarly(tenant.dbName, id);
        await audit(tenant.dbName, user.id, "deal.close", id, `Сделка ${id} · ${deal.client} закрыта досрочно`);
        return deal;
      } catch (err) {
        if (err instanceof Error && err.message === "NOT_ACTIVE") {
          throw new BadRequestError("Закрыть досрочно можно только активную сделку");
        }
        throw err;
      }
    },
    { roles: ["admin", "manager"] }
  );
}

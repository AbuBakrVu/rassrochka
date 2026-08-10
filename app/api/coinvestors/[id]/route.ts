import { BadRequestError, handle } from "@/app/api/_lib/handler";
import { setCoinvestorActive } from "@/lib/queries";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(
    request,
    async ({ tenant, body }) => {
      const active = (body as { active?: unknown })?.active;
      if (typeof active !== "boolean") {
        throw new BadRequestError("Поле «active» должно быть true или false");
      }
      await setCoinvestorActive(tenant.dbName, id, active);
      return { ok: true };
    },
    { adminOnly: true }
  );
}

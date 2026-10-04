import { BadRequestError, handle } from "@/app/api/_lib/handler";
import { deleteSavedFilter } from "@/lib/saved-filters";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return handle(request, async ({ tenant, user }) => {
    if (!/^\d{1,18}$/.test(id)) throw new BadRequestError("Неверный идентификатор");
    await deleteSavedFilter(tenant.dbName, user.id, id);
    return { ok: true };
  });
}

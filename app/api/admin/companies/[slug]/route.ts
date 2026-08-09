import { handleAdmin } from "@/app/api/admin/_lib/handler";
import { BadRequestError } from "@/app/api/_lib/handler";
import { setCompanyActive } from "@/lib/provisioning";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  return handleAdmin(request, async ({ body }) => {
    const active = (body as { active?: unknown })?.active;
    if (typeof active !== "boolean") {
      throw new BadRequestError("Поле «active» должно быть true или false");
    }
    await setCompanyActive(slug, active);
    return { ok: true };
  });
}

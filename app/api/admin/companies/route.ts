import { handleAdmin } from "@/app/api/admin/_lib/handler";
import { str, num, optionalStr } from "@/app/api/_lib/handler";
import { createCompany, listCompanies } from "@/lib/provisioning";

export async function GET(request: Request) {
  return handleAdmin(request, () => listCompanies());
}

export async function POST(request: Request) {
  return handleAdmin(request, ({ body }) =>
    createCompany({
      slug: str(body, "slug", { max: 32 }),
      name: str(body, "name", { max: 200 }),
      adminEmail: str(body, "adminEmail", { max: 200 }),
      adminName: optionalStr(body, "adminName", "Администратор"),
      cashOpening: (() => {
        const raw = (body as Record<string, unknown>)?.cashOpening;
        return raw === undefined || raw === "" || raw === null
          ? 0
          : num(body, "cashOpening", { min: 0 });
      })(),
    })
  );
}

import { handleAdmin } from "@/app/api/admin/_lib/handler";
import { getCompanyEmployees } from "@/lib/provisioning";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  return handleAdmin(request, () => getCompanyEmployees(slug));
}

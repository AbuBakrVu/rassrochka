import { handle, str, optionalStr, isoDate } from "@/app/api/_lib/handler";
import { createClient } from "@/lib/queries";
import { audit } from "@/lib/audit";

export async function POST(request: Request) {
  return handle(
    request,
    async ({ tenant, body, user }) => {
      const client = await createClient(tenant.dbName, {
        lastName: str(body, "lastName", { max: 100 }),
        firstName: str(body, "firstName", { max: 100 }),
        middleName: optionalStr(body, "middleName") || undefined,
        phone: optionalStr(body, "phone"),
        birthDate: optionalIsoDate(body, "birthDate"),
        passportSeries: optionalStr(body, "passportSeries") || undefined,
        passportNumber: optionalStr(body, "passportNumber") || undefined,
        passportIssuedBy: optionalStr(body, "issuedBy") || undefined,
        passportIssuedAt: optionalIsoDate(body, "issuedAt"),
        registrationAddress: optionalStr(body, "registrationAddress") || undefined,
        livingAddress: optionalStr(body, "livingAddress") || undefined,
        inn: optionalStr(body, "inn") || undefined,
        consent: (body as { consent?: unknown }).consent === true,
      });
      await audit(tenant.dbName, user.id, "client.create", client.id, `Добавлен клиент ${client.id} · ${client.name}`);
      return client;
    },
    { roles: ["admin", "manager"] }
  );
}

function optionalIsoDate(body: unknown, key: string): string | undefined {
  const value = optionalStr(body, key);
  return value ? isoDate({ [key]: value }, key) : undefined;
}

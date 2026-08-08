// Смена собственного пароля. Доступна и тем, у кого стоит
// must_change_password — иначе они не смогли бы им воспользоваться.

import { cookies } from "next/headers";
import { BadRequestError, handle, str } from "@/app/api/_lib/handler";
import { SESSION_COOKIE, changePassword, verifyCredentials } from "@/lib/auth";

const MIN_LENGTH = 8;

export async function POST(request: Request) {
  return handle(request, async ({ tenant, body, user }) => {
    const current = str(body, "currentPassword", { max: 200 });
    const next = str(body, "newPassword", { max: 200 });

    if (next.length < MIN_LENGTH) {
      throw new BadRequestError(`Новый пароль короче ${MIN_LENGTH} символов`);
    }
    if (next === current) {
      throw new BadRequestError("Новый пароль совпадает с текущим");
    }

    const ok = await verifyCredentials(tenant.dbName, user.email, current);
    if (!ok) throw new BadRequestError("Текущий пароль неверен");

    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    await changePassword(tenant.dbName, user.id, next, token);

    return { ok: true };
  });
}

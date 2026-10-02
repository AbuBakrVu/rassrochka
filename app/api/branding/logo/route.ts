// Логотип компании — публично, без входа: он нужен на странице входа и в
// кабинете клиента. Адрес содержит ?v=<версия>, поэтому картинку можно
// кешировать надолго: новая загрузка даёт новый адрес.

import { resolveTenant } from "@/lib/tenant";
import { loadLogo } from "@/lib/branding";

export async function GET(request: Request) {
  try {
    const tenant = await resolveTenant(request.headers.get("host"));
    const logo = await loadLogo(tenant.dbName);
    if (!logo) return new Response("Нет логотипа", { status: 404 });

    return new Response(new Uint8Array(logo.data), {
      headers: {
        "Content-Type": logo.contentType,
        "Cache-Control": new URL(request.url).searchParams.has("v")
          ? "public, max-age=31536000, immutable"
          : "no-cache",
        // SVG, открытый по прямой ссылке, — это документ на нашем домене.
        // Песочница и запрет скриптов не дадут ему ничего выполнить, даже
        // если проверка при загрузке что-то пропустила
        "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Нет логотипа", { status: 404 });
  }
}

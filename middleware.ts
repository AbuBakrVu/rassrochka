// Проверка НАЛИЧИЯ куки — не её валидности: middleware работает на edge и не
// может обратиться к Postgres. Настоящая проверка сессии живёт в
// app/api/_lib/handler.ts, через который проходят все роуты с данными.
//
// Задача этого файла — не пускать в интерфейс без входа, чтобы пользователь
// не смотрел на скелет загрузки, который всё равно кончится ошибкой 401.

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-shared";
import { parseHost } from "@/lib/tenant-host";

// Инфраструктурные роуты: не привязаны ни к одной компании, работают на
// голом Host (docker healthcheck и Caddy ask-запрос шлют Host: app:3000 или
// вообще без него, не под доменом-компанией) — тенант-проверка тут ни к
// чему и обязана идти раньше неё.
const INFRA = [/^\/api\/health$/, /^\/api\/internal\//];

// Открыты без входа: страница входа, кабинет заёмщика по ссылке и роуты,
// которые сами разбираются с доступом
const PUBLIC = [/^\/login$/, /^\/company$/, /^\/pay\//, /^\/api\/auth\//, /^\/api\/portal\//, /^\/api\/branding\//];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (INFRA.some((re) => re.test(pathname))) return NextResponse.next();

  const host = parseHost(request.headers.get("host"));

  // На корневом домене компания не выбрана: показываем страницу, где её
  // адрес можно ввести. Существует ли компания — проверяет уже сервер,
  // middleware работает на edge и в Postgres сходить не может.
  if (host.kind !== "tenant") {
    // В разработке на голом localhost:3000 поддомена нет — там компанию
    // подставляет DEV_TENANT_SLUG (см. lib/tenant.ts), не мешаем
    const devFallback =
      process.env.NODE_ENV !== "production" && !!process.env.DEV_TENANT_SLUG;

    if (!devFallback) {
      if (pathname === "/company") return NextResponse.next();
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Компания не выбрана" }, { status: 404 });
      }
      const url = request.nextUrl.clone();
      url.pathname = "/company";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // На поддомене компании страница выбора не нужна
  if (host.kind === "tenant" && pathname === "/company") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();

  if (!request.cookies.has(SESSION_COOKIE)) {
    // API отвечает кодом, а не редиректом: fetch на 302 к HTML-странице
    // выглядел бы для клиента как невнятная ошибка разбора
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // Куда вернуть после входа
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Статику и картинки не трогаем
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

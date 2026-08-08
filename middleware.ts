// Проверка НАЛИЧИЯ куки — не её валидности: middleware работает на edge и не
// может обратиться к Postgres. Настоящая проверка сессии живёт в
// app/api/_lib/handler.ts, через который проходят все роуты с данными.
//
// Задача этого файла — не пускать в интерфейс без входа, чтобы пользователь
// не смотрел на скелет загрузки, который всё равно кончится ошибкой 401.

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-shared";

// Открыты без входа: страница входа, кабинет заёмщика по ссылке и роуты,
// которые сами разбираются с доступом
const PUBLIC = [/^\/login$/, /^\/pay\//, /^\/api\/auth\//, /^\/api\/portal\//];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

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

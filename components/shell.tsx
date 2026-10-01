"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  BarChart3,
  KanbanSquare,
  Users,
  CalendarDays,
  Send,
  Handshake,
  Wallet,
  BookUser,
  UserCog,
  Settings,
  Menu,
  X,
  Zap,
  LogOut,
  ShieldAlert,
  ScrollText,
  Search,
  MoreHorizontal,
} from "lucide-react";
import CommandPalette from "@/components/command-palette";
import ThemeToggle from "@/components/theme-toggle";
import { DataProvider, useData } from "@/lib/store";

export const nav: {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
  /** Пункт виден только администратору компании. */
  adminOnly?: boolean;
}[] = [
  { href: "/", label: "Главная", icon: LayoutGrid },
  { href: "/analytics", label: "Аналитика", icon: BarChart3 },
  { href: "/deals", label: "Сделки", icon: KanbanSquare },
  { href: "/clients", label: "Клиенты", icon: Users },
  { href: "/payments", label: "Платежи", icon: CalendarDays },
  { href: "/mailings", label: "Рассылки", icon: Send },
  { href: "/coinvestors", label: "Соинвесторы", icon: Handshake },
  { href: "/cash", label: "Финансы", icon: Wallet },
  { href: "/registry", label: "Реестр клиентов", icon: BookUser },
  { href: "/blacklist", label: "Чёрный список", icon: ShieldAlert },
  { href: "/employees", label: "Сотрудники", icon: UserCog },
  { href: "/journal", label: "Журнал действий", icon: ScrollText, adminOnly: true },
  { href: "/settings", label: "Настройки", icon: Settings },
];

// Бухгалтер видит только кассу и аналитику — остальные разделы ему видеть
// незачем (он не ведёт клиентов и сделки). /settings/password — исключение,
// его должен уметь открыть кто угодно, чтобы сменить обязательный первый
// пароль. Список используем и для сайдбара, и для редиректа с чужих страниц.
const ACCOUNTANT_ALLOWED = ["/cash", "/analytics"];

function allowedForAccountant(pathname: string): boolean {
  if (pathname === "/settings/password") return true;
  return ACCOUNTANT_ALLOWED.some((href) => pathname.startsWith(href));
}

function useNavItems() {
  const { user, hiddenNavItems } = useData();
  return nav
    .filter((n) => user.role !== "accountant" || allowedForAccountant(n.href))
    .filter((n) => !n.adminOnly || user.role === "admin")
    .filter((n) => !hiddenNavItems.includes(n.href));
}

const isActive = (href: string, pathname: string) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href);

/** Подпись в полосе меню: видна, только когда полоса раскрыта (наведение или клавиатура). */
const railLabel =
  "whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-has-[:focus-visible]/rail:opacity-100";

/**
 * Десктопное меню — тёмная полоса иконок (как «Dashboards V2»), которая при
 * наведении раскрывается поверх контента и показывает подписи. В узком виде
 * активный пункт — светлая вкладка цвета фона, «врезанная» в полосу
 * (вогнутые скругления — радиальные градиенты в ::before/::after); в
 * раскрытом — светлая плашка внутри панели, потому что край панели тогда
 * лежит уже над контентом, а не над фоном.
 */
function RailNav({ pathname }: { pathname: string }) {
  const items = useNavItems();

  return (
    <nav className="flex flex-1 flex-col gap-1.5 py-2" aria-label="Основные разделы">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`relative flex h-11 shrink-0 items-center gap-3 text-sm transition-colors ${
              active
                ? "ml-3 rounded-l-[16px] bg-canvas pl-2 font-medium text-ink before:pointer-events-none before:absolute before:-top-4 before:right-0 before:h-4 before:w-4 before:bg-[radial-gradient(circle_at_0_0,transparent_15.5px,var(--color-canvas)_16px)] after:pointer-events-none after:absolute after:-bottom-4 after:right-0 after:h-4 after:w-4 after:bg-[radial-gradient(circle_at_0_100%,transparent_15.5px,var(--color-canvas)_16px)] group-hover/rail:mr-3 group-hover/rail:rounded-[16px] group-hover/rail:before:hidden group-hover/rail:after:hidden group-has-[:focus-visible]/rail:mr-3 group-has-[:focus-visible]/rail:rounded-[16px] group-has-[:focus-visible]/rail:before:hidden group-has-[:focus-visible]/rail:after:hidden"
                : "mx-4 rounded-[14px] px-1 text-rail-mute hover:bg-rail-hover hover:text-rail-fg"
            }`}
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] ${
                active ? "bg-brand text-on-brand shadow-card" : ""
              }`}
            >
              <Icon size={18} strokeWidth={1.9} aria-hidden />
            </span>
            <span className={railLabel}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Мобильная шторка — полный список с подписями. */
function DrawerNav({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  const items = useNavItems();

  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3" aria-label="Основные разделы">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-sm transition-colors ${
              active
                ? "bg-brand font-medium text-on-brand shadow-card"
                : "text-mute hover:bg-brand-soft hover:text-brand-deep"
            }`}
          >
            <Icon size={18} strokeWidth={1.75} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

// Нижняя панель на телефоне: самые частые разделы под большим пальцем,
// остальное — в шторке по кнопке «Ещё»
const TAB_PRIORITY = ["/", "/deals", "/clients", "/payments", "/cash", "/analytics"];

function MobileTabBar({ pathname, onMore }: { pathname: string; onMore: () => void }) {
  const items = useNavItems();
  const tabs = TAB_PRIORITY.map((href) => items.find((n) => n.href === href))
    .filter((n): n is (typeof items)[number] => !!n)
    .slice(0, 4);
  const moreActive = !tabs.some((t) => isActive(t.href, pathname));

  const cell =
    "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-[16px] py-1.5 text-[11px] font-medium transition-colors";
  return (
    <nav
      aria-label="Быстрые разделы"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 flex gap-1 rounded-[24px] bg-rail p-1.5 shadow-pop lg:hidden print:hidden"
    >
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = isActive(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`${cell} ${active ? "bg-canvas text-ink" : "text-rail-mute hover:text-rail-fg"}`}
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full ${
                active ? "bg-brand text-on-brand" : ""
              }`}
            >
              <Icon size={17} aria-hidden />
            </span>
            <span className="max-w-full truncate">{label}</span>
          </Link>
        );
      })}
      <button
        onClick={onMore}
        className={`${cell} ${moreActive ? "bg-canvas text-ink" : "text-rail-mute hover:text-rail-fg"}`}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full">
          <MoreHorizontal size={17} aria-hidden />
        </span>
        Ещё
      </button>
    </nav>
  );
}

/** Если бухгалтер каким-то путём (прямая ссылка, старая закладка) попал на
 *  чужую страницу — молча уводим на кассу, а не показываем 403. */
function AccountantGate({ pathname }: { pathname: string }) {
  const { user } = useData();
  const router = useRouter();

  useEffect(() => {
    if (user.role === "accountant" && !allowedForAccountant(pathname)) {
      router.replace("/cash");
    }
  }, [user.role, pathname, router]);

  return null;
}

function useSignOut() {
  const { logout } = useData();
  const [busy, setBusy] = useState(false);
  const signOut = async () => {
    if (busy) return;
    setBusy(true);
    await logout();
  };
  return { busy, signOut };
}

/** Низ тёмной полосы: тема, выход, аватар — с подписями в раскрытом виде. */
function RailFooter() {
  const { user } = useData();
  const { busy, signOut } = useSignOut();

  return (
    <div className="flex flex-col gap-1 px-4 pt-2 pb-4">
      {/* Иконки подвала — в тех же 36px-ячейках, что и пункты меню, чтобы
          иконки и подписи стояли на одной линии с разделами */}
      <div className="flex items-center gap-3 px-1 text-sm text-rail-mute">
        <span className="flex w-9 shrink-0 justify-center">
          <ThemeToggle className="text-rail-mute hover:bg-rail-hover hover:text-rail-fg" />
        </span>
        <span className={railLabel} aria-hidden>
          Тема оформления
        </span>
      </div>
      <button
        onClick={signOut}
        disabled={busy}
        aria-label="Выйти из аккаунта"
        className="flex h-10 items-center gap-3 rounded-[14px] px-1 text-sm text-rail-mute transition-colors hover:bg-rail-hover hover:text-danger disabled:opacity-50"
      >
        <span className="flex w-9 shrink-0 justify-center">
          <LogOut size={17} aria-hidden />
        </span>
        <span className={railLabel}>Выйти</span>
      </button>
      <div className="mt-1 flex items-center gap-3 pl-0.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-canvas text-xs font-semibold text-ink">
          {user.initials}
        </span>
        <span className={`min-w-0 ${railLabel}`}>
          <span className="block truncate text-sm font-medium text-rail-fg">{user.name}</span>
          <span className="block truncate text-xs text-rail-mute">{user.email}</span>
        </span>
      </div>
    </div>
  );
}

function DrawerFooter() {
  const { user } = useData();
  const { busy, signOut } = useSignOut();

  return (
    <div className="mt-2 flex items-center gap-2 border-t border-line px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-deep">
        {user.initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-xs text-mute">{user.email}</p>
      </div>
      <ThemeToggle />
      <button
        onClick={signOut}
        disabled={busy}
        title="Выйти"
        aria-label="Выйти из аккаунта"
        className="shrink-0 rounded-[10px] p-2 text-mute transition-colors hover:bg-canvas hover:text-danger disabled:opacity-50"
      >
        <LogOut size={17} aria-hidden />
      </button>
    </div>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Страницы без CRM-оболочки и БЕЗ общего стора:
  //   /pay/<токен> — кабинет заёмщика, грузит только свою сделку через
  //     /api/portal. Провайдер ниже этой проверки намеренно, иначе заёмщик
  //     тянул бы в браузер все сделки и всех клиентов компании.
  //   /login — на нём сессии ещё нет, и DataProvider ушёл бы в петлю:
  //     bootstrap → 401 → редирект на /login → снова bootstrap.
  //   /company — вообще не про компанию: корневой домен, где вводят адрес
  //     своей компании. Без этой строки сюда всё равно рисовался бы
  //     сайдбар CRM компании (баг, найденный вручную в браузере).
  // Слэш в "/pay/" обязателен: без него сюда попадал и раздел /payments.
  if (
    pathname.startsWith("/pay/") ||
    pathname === "/login" ||
    pathname === "/company"
  ) {
    return <>{children}</>;
  }

  return (
    <DataProvider>
      <AccountantGate pathname={pathname} />
      <div className="flex min-h-screen print:hidden">
        {/* Десктопное меню — тёмная полоса иконок, при наведении раскрывается
            поверх контента (контент не сдвигается). Небольшая задержка на
            раскрытие — чтобы меню не «выпрыгивало», когда курсор просто
            пересекает полосу. С клавиатуры раскрывается по Tab. */}
        <aside className="group/rail fixed inset-y-3 left-3 z-40 hidden w-[76px] flex-col overflow-hidden rounded-[28px] bg-rail shadow-pop transition-[width] delay-0 duration-200 ease-out hover:w-60 hover:delay-150 has-[:focus-visible]:w-60 lg:flex [@media(max-height:760px)]:overflow-y-auto">
          <Link
            href="/"
            aria-label="Nasiya — на главную"
            className="mx-4 mt-5 mb-4 flex h-11 shrink-0 items-center gap-3 rounded-full"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-canvas text-brand">
              <Zap size={18} aria-hidden />
            </span>
            <span className={`text-lg font-semibold tracking-tight text-rail-fg ${railLabel}`}>Nasiya</span>
          </Link>
          <RailNav pathname={pathname} />
          <RailFooter />
        </aside>

        {/* Мобильная шторка */}
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              aria-label="Закрыть меню"
              className="absolute inset-0 bg-scrim"
              onClick={() => setOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-surface shadow-pop">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand text-on-brand">
                    <Zap size={16} aria-hidden />
                  </span>
                  <span className="font-semibold">Nasiya</span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Закрыть"
                  className="rounded-[10px] p-2 text-mute hover:bg-canvas"
                >
                  <X size={18} />
                </button>
              </div>
              <DrawerNav pathname={pathname} onNavigate={() => setOpen(false)} />
              <DrawerFooter />
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col lg:pl-[88px]">
          {/* Мобильная шапка */}
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line/70 bg-surface/80 px-4 py-3 backdrop-blur-xl lg:hidden">
            <button
              onClick={() => setOpen(true)}
              aria-label="Открыть меню"
              className="rounded-[10px] p-2 text-ink hover:bg-canvas"
            >
              <Menu size={20} />
            </button>
            <span className="flex items-center gap-2 font-semibold">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-on-brand">
                <Zap size={14} aria-hidden />
              </span>
              Nasiya
            </span>
            <button
              onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
              aria-label="Поиск"
              className="ml-auto rounded-full p-2 text-mute hover:bg-canvas hover:text-ink"
            >
              <Search size={19} aria-hidden />
            </button>
          </header>
          {/* Снизу на телефоне — место под панель вкладок */}
          <main className="min-w-0 flex-1 pb-24 lg:pb-0">{children}</main>
        </div>
        <MobileTabBar pathname={pathname} onMore={() => setOpen(true)} />
        <CommandPalette />
      </div>
    </DataProvider>
  );
}

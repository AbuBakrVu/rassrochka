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
  PanelLeftClose,
  PanelLeftOpen,
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

function SidebarNav({
  pathname,
  onNavigate,
  collapsed = false,
}: {
  pathname: string;
  onNavigate: () => void;
  /** Узкая полоса только с иконками; подпись — всплывающей подсказкой. */
  collapsed?: boolean;
}) {
  const { user, hiddenNavItems } = useData();
  const items = nav
    .filter((n) => user.role !== "accountant" || allowedForAccountant(n.href))
    .filter((n) => !n.adminOnly || user.role === "admin")
    .filter((n) => !hiddenNavItems.includes(n.href));

  return (
    <nav
      className={`flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto ${collapsed ? "items-center px-2" : "px-3"}`}
      aria-label="Основные разделы"
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            aria-label={collapsed ? label : undefined}
            className={`group relative flex items-center rounded-[14px] text-sm transition-colors ${
              collapsed ? "h-11 w-11 shrink-0 justify-center" : "gap-3 px-3 py-2.5"
            } ${
              active
                ? "bg-brand font-medium text-on-brand shadow-card"
                : "text-mute hover:bg-brand-soft hover:text-brand-deep"
            }`}
          >
            <Icon size={18} strokeWidth={1.75} aria-hidden />
            {collapsed ? (
              <span
                role="tooltip"
                className="pointer-events-none absolute left-full z-50 ml-3 hidden rounded-[10px] bg-ink px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-canvas shadow-pop group-hover:block group-focus-visible:block"
              >
                {label}
              </span>
            ) : (
              label
            )}
          </Link>
        );
      })}
    </nav>
  );
}

// Свёрнутое меню — личная настройка, в браузере сотрудника
const COLLAPSED_KEY = "nav-collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
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

function UserFooter({ collapsed = false }: { collapsed?: boolean }) {
  const { user, logout } = useData();
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    if (busy) return;
    setBusy(true);
    await logout();
  };

  if (collapsed) {
    return (
      <div className="mt-2 flex flex-col items-center gap-1 border-t border-line px-2 pt-3 pb-4">
        <ThemeToggle />
        <button
          onClick={signOut}
          disabled={busy}
          title="Выйти"
          aria-label="Выйти из аккаунта"
          className="rounded-[10px] p-2 text-mute transition-colors hover:bg-canvas hover:text-danger disabled:opacity-50"
        >
          <LogOut size={17} aria-hidden />
        </button>
        <span
          title={`${user.name} · ${user.email}`}
          className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-deep"
        >
          {user.initials}
        </span>
      </div>
    );
  }

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
  // Разметка меню впервые рисуется уже после загрузки данных (до этого
  // DataProvider показывает скелет), поэтому прочитать localStorage прямо в
  // начальном состоянии безопасно — серверного HTML меню нет, сверять нечего
  const [collapsed, setCollapsed] = useState(() =>
    typeof window === "undefined" ? false : readCollapsed()
  );
  const pathname = usePathname();

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, v ? "0" : "1");
      } catch {
        // приватный режим — просто не запомнится
      }
      return !v;
    });
  };

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
        {/* Десктопный сайдбар — плавающая «стеклянная» панель, сворачивается в полосу иконок */}
        <aside
          className={`fixed inset-y-3 left-3 z-30 hidden flex-col rounded-[24px] border border-line/70 bg-surface/80 shadow-card backdrop-blur-xl transition-[width] lg:flex ${
            collapsed ? "w-[76px]" : "w-60"
          }`}
        >
          <div
            className={`flex items-center py-5 ${collapsed ? "flex-col gap-3 px-2" : "gap-2.5 px-5"}`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-brand text-on-brand shadow-card">
              <Zap size={18} aria-hidden />
            </span>
            {!collapsed && (
              <span className="flex-1 text-lg font-semibold tracking-tight">Nasiya</span>
            )}
            <button
              onClick={toggleCollapsed}
              title={collapsed ? "Развернуть меню" : "Свернуть меню"}
              aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"}
              aria-expanded={!collapsed}
              className="rounded-[10px] p-1.5 text-mute transition-colors hover:bg-canvas hover:text-ink"
            >
              {collapsed ? (
                <PanelLeftOpen size={17} aria-hidden />
              ) : (
                <PanelLeftClose size={17} aria-hidden />
              )}
            </button>
          </div>
          <SidebarNav
            pathname={pathname}
            onNavigate={() => setOpen(false)}
            collapsed={collapsed}
          />
          <UserFooter collapsed={collapsed} />
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
              <SidebarNav pathname={pathname} onNavigate={() => setOpen(false)} />
              <UserFooter />
            </aside>
          </div>
        )}

        <div
          className={`flex min-w-0 flex-1 flex-col transition-[padding] ${
            collapsed ? "lg:pl-[88px]" : "lg:pl-[252px]"
          }`}
        >
          {/* Мобильная шапка */}
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line/70 bg-surface/80 px-4 py-3 backdrop-blur-xl lg:hidden">
            <button
              onClick={() => setOpen(true)}
              aria-label="Открыть меню"
              className="rounded-[10px] p-2 text-ink hover:bg-canvas"
            >
              <Menu size={20} />
            </button>
            <span className="font-semibold">Nasiya</span>
          </header>
          <main className="min-w-0 flex-1">{children}</main>
        </div>
        <CommandPalette />
      </div>
    </DataProvider>
  );
}

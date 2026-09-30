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
} from "lucide-react";
import CommandPalette from "@/components/command-palette";
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

function SidebarNav({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  const { user, hiddenNavItems } = useData();
  const items = nav
    .filter((n) => user.role !== "accountant" || allowedForAccountant(n.href))
    .filter((n) => !n.adminOnly || user.role === "admin")
    .filter((n) => !hiddenNavItems.includes(n.href));

  return (
    <nav className="flex flex-col gap-0.5 px-3" aria-label="Основные разделы">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-brand-soft font-medium text-brand-deep"
                : "text-mute hover:bg-canvas hover:text-ink"
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

function UserFooter() {
  const { user, logout } = useData();
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    if (busy) return;
    setBusy(true);
    await logout();
  };

  return (
    <div className="mt-auto flex items-center gap-2.5 border-t border-line px-4 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-deep">
        {user.initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-xs text-mute">{user.email}</p>
      </div>
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
        {/* Десктопный сайдбар */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface lg:flex">
          <div className="flex items-center gap-2.5 px-6 py-5">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand text-white">
              <Zap size={18} aria-hidden />
            </span>
            <span className="text-lg font-semibold tracking-tight">Nasiya</span>
          </div>
          <SidebarNav pathname={pathname} onNavigate={() => setOpen(false)} />
          <UserFooter />
        </aside>

        {/* Мобильная шторка */}
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              aria-label="Закрыть меню"
              className="absolute inset-0 bg-ink/30"
              onClick={() => setOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-surface shadow-pop">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand text-white">
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

        <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
          {/* Мобильная шапка */}
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-surface px-4 py-3 lg:hidden">
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

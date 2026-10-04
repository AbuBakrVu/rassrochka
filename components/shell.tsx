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
  LogOut,
  ShieldAlert,
  ScrollText,
  PhoneCall,
  Search,
  MoreHorizontal,
} from "lucide-react";
import CommandPalette from "@/components/command-palette";
import ThemeToggle from "@/components/theme-toggle";
import { BrandMark, useBrandName } from "@/components/branding";
import { DataProvider, useData } from "@/lib/store";
import { canOpen, homeFor } from "@/lib/permissions";

/** Разделы меню. Кому какой виден — по правам (lib/permissions.ts, SECTION_PERMISSION). */
export const nav: {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
}[] = [
  { href: "/", label: "Главная", icon: LayoutGrid },
  { href: "/analytics", label: "Аналитика", icon: BarChart3 },
  { href: "/deals", label: "Сделки", icon: KanbanSquare },
  { href: "/clients", label: "Клиенты", icon: Users },
  { href: "/payments", label: "Платежи", icon: CalendarDays },
  { href: "/collections", label: "Просрочки", icon: PhoneCall },
  { href: "/mailings", label: "Рассылки", icon: Send },
  { href: "/coinvestors", label: "Соинвесторы", icon: Handshake },
  { href: "/cash", label: "Финансы", icon: Wallet },
  { href: "/registry", label: "Реестр клиентов", icon: BookUser },
  { href: "/blacklist", label: "Чёрный список", icon: ShieldAlert },
  { href: "/employees", label: "Сотрудники", icon: UserCog },
  { href: "/journal", label: "Журнал действий", icon: ScrollText },
  { href: "/settings", label: "Настройки", icon: Settings },
];

// Меню и переход по прямой ссылке решаются одним правилом — canOpen. Настройки
// открыты всем: там смена пароля, обязательная при первом входе.
function useNavItems() {
  const { user, hiddenNavItems } = useData();
  return nav
    .filter((n) => canOpen(user, n.href))
    .filter((n) => !hiddenNavItems.includes(n.href));
}

const isActive = (href: string, pathname: string) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href);

/** Подсказка с названием раздела — всплывает справа от круглой кнопки меню. */
const railTip =
  "pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-ink opacity-0 shadow-pop transition-opacity duration-150 group-hover/item:opacity-100 group-focus-visible/item:opacity-100";

/** Круглая кнопка меню: обводка, у активной — градиент основного цвета с подсветкой. */
const railCircle = (active: boolean) =>
  `flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${
    active
      ? "bg-brand text-on-brand"
      : "border border-line bg-surface/60 text-ink hover:border-brand/40 hover:text-brand-deep"
  }`;

/**
 * Десктопное меню — колонка круглых иконок, как в референсе. Подписи —
 * всплывающими подсказками при наведении и фокусе с клавиатуры.
 */
function RailNav({ pathname }: { pathname: string }) {
  const items = useNavItems();

  return (
    <nav className="my-auto flex flex-col items-center gap-2.5 py-4" aria-label="Основные разделы">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className="group/item relative rounded-full"
          >
            <span className={`${railCircle(active)} ${active ? "rail-active" : ""}`}>
              <Icon size={18} strokeWidth={1.7} aria-hidden />
            </span>
            <span className={railTip}>{label}</span>
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
    "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full py-1 text-[11px] font-medium transition-colors";
  return (
    <nav
      aria-label="Быстрые разделы"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 flex gap-1 rounded-full bg-surface p-1.5 shadow-pop lg:hidden print:hidden"
    >
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = isActive(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`${cell} ${active ? "text-ink" : "text-mute hover:text-ink"}`}
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                active ? "rail-active bg-brand text-on-brand" : ""
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
        className={`${cell} ${moreActive ? "text-ink" : "text-mute hover:text-ink"}`}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full">
          <MoreHorizontal size={17} aria-hidden />
        </span>
        Ещё
      </button>
    </nav>
  );
}

/** Если сотрудник каким-то путём (прямая ссылка, старая закладка) попал на
 *  закрытый ему раздел — молча уводим в первый доступный, а не показываем 403. */
function SectionGate({ pathname }: { pathname: string }) {
  const { user } = useData();
  const router = useRouter();
  const allowed = canOpen(user, pathname);

  useEffect(() => {
    if (!allowed) router.replace(homeFor(user));
  }, [allowed, user, router]);

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

/** Низ колонки меню: тема и выход — такие же круглые кнопки. */
function RailFooter() {
  const { busy, signOut } = useSignOut();

  return (
    <div className="flex flex-col items-center gap-2.5 pt-2 pb-6">
      <span className="group/item relative">
        <ThemeToggle className={`${railCircle(false)} p-0`} />
        <span className={railTip}>Тема оформления</span>
      </span>
      <button
        onClick={signOut}
        disabled={busy}
        aria-label="Выйти из аккаунта"
        className="group/item relative rounded-full disabled:opacity-50"
      >
        <span className={`${railCircle(false)} hover:text-danger`}>
          <LogOut size={17} aria-hidden />
        </span>
        <span className={railTip}>Выйти</span>
      </button>
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
        className="shrink-0 rounded-full p-2 text-mute transition-colors hover:bg-canvas hover:text-danger disabled:opacity-50"
      >
        <LogOut size={17} aria-hidden />
      </button>
    </div>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const brandName = useBrandName();

  // Страницы без CRM-оболочки и БЕЗ общего стора:
  //   /pay/<токен> — кабинет заёмщика, грузит только свою сделку через
  //     /api/portal. Провайдер ниже этой проверки намеренно, иначе заёмщик
  //     тянул бы в браузер все сделки и всех клиентов компании.
  //   /login — на нём сессии ещё нет, и DataProvider ушёл бы в петлю:
  //     bootstrap → 401 → редирект на /login → снова bootstrap.
  //   /investor/<токен> — кабинет соинвестора, так же только свои суммы.
  //   /apply — онлайн-заявка для клиентов, без входа и без стора.
  //   /company — вообще не про компанию: корневой домен, где вводят адрес
  //     своей компании. Без этой строки сюда всё равно рисовался бы
  //     сайдбар CRM компании (баг, найденный вручную в браузере).
  // Слэш в "/pay/" обязателен: без него сюда попадал и раздел /payments.
  if (
    pathname.startsWith("/pay/") ||
    pathname.startsWith("/investor/") ||
    pathname === "/login" ||
    pathname === "/apply" ||
    pathname === "/company"
  ) {
    return <>{children}</>;
  }

  return (
    <DataProvider>
      <SectionGate pathname={pathname} />
      <div className="flex min-h-screen print:hidden">
        {/* Десктопное меню — тёмная полоса иконок, при наведении раскрывается
            поверх контента (контент не сдвигается). Небольшая задержка на
            раскрытие — чтобы меню не «выпрыгивало», когда курсор просто
            пересекает полосу. С клавиатуры раскрывается по Tab. */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-[92px] flex-col items-center lg:flex [@media(max-height:820px)]:overflow-y-auto">
          <Link
            href="/"
            aria-label={`${brandName} — на главную`}
            className="mt-6 flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
          >
            <BrandMark className="h-12 w-12 rounded-full" />
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
                  <BrandMark className="h-8 w-8 rounded-[14px]" iconSize={16} />
                  <span className="truncate font-semibold">{brandName}</span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Закрыть"
                  className="rounded-full p-2 text-mute hover:bg-canvas"
                >
                  <X size={18} />
                </button>
              </div>
              <DrawerNav pathname={pathname} onNavigate={() => setOpen(false)} />
              <DrawerFooter />
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col lg:pl-[92px]">
          {/* Мобильная шапка */}
          <header className="sticky top-0 z-20 flex items-center gap-3 bg-canvas/90 px-4 py-3 backdrop-blur lg:hidden">
            <button
              onClick={() => setOpen(true)}
              aria-label="Открыть меню"
              className="rounded-full p-2 text-ink hover:bg-canvas"
            >
              <Menu size={20} />
            </button>
            <span className="flex min-w-0 items-center gap-2 font-semibold">
              <BrandMark className="h-7 w-7 rounded-full" iconSize={14} />
              <span className="truncate">{brandName}</span>
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

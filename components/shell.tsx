"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  BarChart3,
  KanbanSquare,
  Users,
  CalendarDays,
  Handshake,
  Wallet,
  UserCog,
  Settings,
  Menu,
  X,
  LogOut,
  PhoneCall,
  Search,
  MoreHorizontal,
  Pin,
  PinOff,
  Plus,
  KeyRound,
} from "lucide-react";
import CommandPalette from "@/components/command-palette";
import ThemeToggle from "@/components/theme-toggle";
import { BrandMark, useBrandName } from "@/components/branding";
import { DataProvider, useData } from "@/lib/store";
import { canOpen, homeFor, roleTitle } from "@/lib/permissions";
import { CreateModals, useCreateItems, type CreateModal } from "@/components/ui";

/** Разделы меню. Кому какой виден — по правам (lib/permissions.ts, SECTION_PERMISSION). */
export const nav: {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
  /** С этого пункта в боковом меню начинается вторая группа (после черты). */
  groupStart?: boolean;
}[] = [
  // Реестр и чёрный список — вкладки «Клиентов», рассылки — вкладка «Работы
  // с долгом» (шаблоны — в Настройках), журнал — вкладка «Сотрудников»
  { href: "/", label: "Главная", icon: LayoutGrid },
  { href: "/deals", label: "Сделки", icon: KanbanSquare },
  { href: "/clients", label: "Клиенты", icon: Users },
  { href: "/payments", label: "Платежи", icon: CalendarDays },
  { href: "/collections", label: "Работа с долгом", icon: PhoneCall },
  { href: "/cash", label: "Финансы", icon: Wallet },
  { href: "/analytics", label: "Аналитика", icon: BarChart3 },
  { href: "/coinvestors", label: "Соинвесторы", icon: Handshake, groupStart: true },
  { href: "/employees", label: "Сотрудники", icon: UserCog },
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

/** Счётчики на пунктах меню: новые заявки и сделки с просрочкой. */
function useNavBadges(): Record<string, { count: number; danger?: boolean }> {
  const { deals } = useData();
  const fresh = deals.filter((d) => d.stage === "new").length;
  const overdue = deals.filter((d) => d.stage === "active" && d.statusTone === "red").length;
  return {
    ...(fresh ? { "/deals": { count: fresh } } : {}),
    ...(overdue ? { "/collections": { count: overdue, danger: true } } : {}),
  };
}

const badgeText = (n: number) => (n > 99 ? "99+" : String(n));

/** Всплывающее меню рядом с кнопкой — на fixed, чтобы карточка меню его не обрезала. */
function SidebarPopover({
  anchor,
  onClose,
  children,
  label,
}: {
  anchor: DOMRect;
  onClose: () => void;
  children: React.ReactNode;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Ниже середины экрана — раскрываем вверх, иначе вниз
  const up = anchor.top > window.innerHeight / 2;
  return (
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      className="nsb-pop"
      style={{
        left: anchor.left,
        ...(up ? { bottom: window.innerHeight - anchor.top + 8 } : { top: anchor.bottom + 8 }),
      }}
    >
      {children}
    </div>
  );
}

const popItem =
  "flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left text-sm font-medium text-ink hover:bg-brand-soft hover:text-brand-deep";

/**
 * Десктопное меню по референсу: плавающая карточка, в покое — колонка
 * иконок, при наведении или фокусе с клавиатуры раскрывается поверх
 * контента. Анимация — классы .nsb* в app/globals.css.
 */
function DesktopSidebar({
  pathname,
  pinned,
  onTogglePin,
}: {
  pathname: string;
  /** Закреплённое меню всегда раскрыто, а страница сдвинута вправо. */
  pinned: boolean;
  onTogglePin: () => void;
}) {
  const { user, roles } = useData();
  const items = useNavItems().filter((n) => n.href !== "/settings");
  const badges = useNavBadges();
  const { busy, signOut } = useSignOut();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pop, setPop] = useState<{ kind: "profile" | "create"; anchor: DOMRect } | null>(null);
  const [modal, setModal] = useState<CreateModal>(null);
  const createItems = useCreateItems(setModal);
  // Пока открыто всплывающее меню, карточка не схлопывается
  const open = pinned || hovered || focused || pop !== null;

  const togglePop = (kind: "profile" | "create", el: HTMLElement) =>
    setPop((p) => (p?.kind === kind ? null : { kind, anchor: el.getBoundingClientRect() }));

  return (
    <aside
      aria-label="Боковое меню"
      className={`nsb hidden lg:flex ${open ? "nsb-open" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      // Раскрываем только при фокусе с клавиатуры: после клика мышью фокус
      // остаётся на ссылке, и меню не схлопывалось бы
      onFocus={(e) => setFocused(e.target.matches(":focus-visible"))}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false);
      }}
    >
      <div className="nsb-profile">
        <button
          type="button"
          className="nsb-profile-btn"
          aria-haspopup="menu"
          aria-expanded={pop?.kind === "profile"}
          onClick={(e) => togglePop("profile", e.currentTarget)}
        >
          <span className="nsb-avatar" aria-hidden>
            {user.initials}
          </span>
          <span className="nsb-details nsb-fade">
            <p className="nsb-name">{user.name}</p>
            <p className="nsb-role">{roleTitle(user, roles)}</p>
          </span>
          <span className="sr-only">Меню профиля</span>
        </button>
        <button
          type="button"
          className="nsb-pin nsb-fade"
          onClick={onTogglePin}
          aria-pressed={pinned}
          aria-label={pinned ? "Открепить меню" : "Закрепить меню"}
          title={pinned ? "Открепить меню — будет раскрываться при наведении" : "Закрепить меню открытым"}
        >
          {pinned ? <PinOff size={17} aria-hidden /> : <Pin size={17} aria-hidden />}
        </button>
      </div>

      <button
        type="button"
        className="nsb-search"
        onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
        aria-label="Поиск или переход (⌘K)"
      >
        <span className="nsb-search-text nsb-fade">Поиск или переход</span>
        <Search size={20} strokeWidth={1.75} aria-hidden />
      </button>

      <nav className="nsb-nav" aria-label="Основные разделы">
        {items.map(({ href, label, icon: Icon, groupStart }, i) => {
          const badge = badges[href];
          return (
            <div key={href} className="contents">
              {groupStart && i > 0 && <hr />}
              <Link
                href={href}
                className="nsb-item"
                aria-current={isActive(href, pathname) ? "page" : undefined}
                title={open ? undefined : label}
              >
                <Icon size={22} strokeWidth={1.75} aria-hidden />
                <span className="nsb-label nsb-fade">{label}</span>
                {badge && (
                  <span
                    className={`nsb-badge ${badge.danger ? "nsb-badge-danger" : ""}`}
                    aria-label={`${badge.count}`}
                  >
                    {badgeText(badge.count)}
                  </span>
                )}
              </Link>
            </div>
          );
        })}
      </nav>

      <div className="nsb-actions">
        <ThemeToggle className="nsb-action" iconSize={20} />
        <Link
          href="/settings"
          className="nsb-action"
          aria-label="Настройки"
          title="Настройки"
          aria-current={isActive("/settings", pathname) ? "page" : undefined}
        >
          <Settings size={20} strokeWidth={1.75} aria-hidden />
        </Link>
        {createItems.length > 0 ? (
          <button
            type="button"
            className="nsb-action"
            aria-label="Добавить"
            title="Добавить"
            aria-haspopup="menu"
            aria-expanded={pop?.kind === "create"}
            onClick={(e) => togglePop("create", e.currentTarget)}
          >
            <Plus size={20} strokeWidth={1.75} aria-hidden />
          </button>
        ) : (
          <span aria-hidden className="pointer-events-none opacity-0" />
        )}
        <button
          type="button"
          className="nsb-action nsb-action-danger"
          onClick={signOut}
          disabled={busy}
          aria-label="Выйти из аккаунта"
          title="Выйти"
        >
          <LogOut size={20} strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      {pop?.kind === "profile" && (
        <SidebarPopover anchor={pop.anchor} onClose={() => setPop(null)} label="Профиль">
          <p className="px-3 pt-1.5 pb-2 text-xs text-mute">{user.email}</p>
          <Link href="/settings/password" role="menuitem" className={popItem} onClick={() => setPop(null)}>
            <KeyRound size={16} className="text-brand" aria-hidden /> Сменить пароль
          </Link>
          <button type="button" role="menuitem" className={popItem} onClick={signOut} disabled={busy}>
            <LogOut size={16} className="text-brand" aria-hidden /> Выйти
          </button>
        </SidebarPopover>
      )}
      {pop?.kind === "create" && (
        <SidebarPopover anchor={pop.anchor} onClose={() => setPop(null)} label="Добавить">
          {createItems.map(({ icon: Icon, label, action }) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              className={popItem}
              onClick={() => {
                setPop(null);
                action();
              }}
            >
              <Icon size={16} className="text-brand" aria-hidden /> {label}
            </button>
          ))}
        </SidebarPopover>
      )}
      <CreateModals modal={modal} onClose={() => setModal(null)} />
    </aside>
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

const PIN_KEY = "nasiya:sidebar-pinned";

export default function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  // Закреплённое меню — выбор каждого сотрудника в его браузере
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    try {
      // localStorage есть только в браузере — читаем после первой отрисовки
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPinned(localStorage.getItem(PIN_KEY) === "1");
    } catch {
      // приватный режим — меню просто не закреплено
    }
  }, []);
  const togglePin = () =>
    setPinned((p) => {
      try {
        localStorage.setItem(PIN_KEY, p ? "0" : "1");
      } catch {
        // не запомнится — не страшно
      }
      return !p;
    });
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
        <DesktopSidebar pathname={pathname} pinned={pinned} onTogglePin={togglePin} />

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

        <div
          className={`flex min-w-0 flex-1 flex-col transition-[padding] duration-[350ms] ease-out ${
            pinned ? "lg:pl-[312px]" : "lg:pl-[132px]"
          }`}
        >
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

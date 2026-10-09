"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  PhoneCall,
  CalendarClock,
  FileSearch,
  UserPlus2,
  BellOff,
} from "lucide-react";
import { useData } from "@/lib/store";
import { buildNotifications, type RouteKind } from "@/lib/data";

const kindMeta: Record<
  RouteKind,
  { icon: typeof PhoneCall; bg: string; text: string }
> = {
  overdue: { icon: PhoneCall, bg: "bg-danger-soft", text: "text-danger" },
  deadline: { icon: CalendarClock, bg: "bg-warn-soft", text: "text-warn" },
  review: { icon: FileSearch, bg: "bg-brand-soft", text: "text-brand" },
  request: { icon: UserPlus2, bg: "bg-brand-soft", text: "text-brand" },
};

export default function NotificationsMenu() {
  const { deals } = useData();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const items = buildNotifications(deals);
  const unread = !seen && items.length > 0;

  // Закрываем меню при переходе в другой раздел — прямо во время
  // отрисовки, а не эффектом после неё (рекомендация React для «сбросить
  // состояние при смене значения»)
  const [shownAt, setShownAt] = useState(pathname);
  if (shownAt !== pathname) {
    setShownAt(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <button
        onClick={() => {
          setOpen((v) => !v);
          setSeen(true);
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Уведомления${unread ? ` — есть новые (${items.length})` : ""}`}
        className="relative flex h-11 w-11 items-center justify-center rounded-full bg-surface text-mute shadow-card hover:text-ink"
      >
        <Bell size={17} />
        {unread && (
          <span
            className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-danger"
            aria-hidden
          />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="fixed top-16 right-3 left-3 z-30 max-w-80 overflow-hidden rounded-[16px] border border-line bg-surface shadow-pop sm:absolute sm:top-full sm:right-0 sm:left-auto sm:mt-2 sm:w-80"
        >
          <div className="border-b border-line px-4 py-3">
            <h3 className="text-sm font-semibold">Уведомления</h3>
            <p className="text-xs text-mute">
              Просрочки, дедлайны и новые заявки
            </p>
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-8 text-center">
              <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-canvas text-mute">
                <BellOff size={16} aria-hidden />
              </span>
              <p className="text-sm text-mute">
                Новых уведомлений нет — всё под контролем.
              </p>
            </div>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {items.map((n) => {
                const meta = kindMeta[n.kind];
                return (
                  <li key={n.key}>
                    <Link
                      href={`/deals/${n.dealId}`}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-canvas"
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[14px] ${meta.bg} ${meta.text}`}
                      >
                        <meta.icon size={15} aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="truncate text-sm text-mute">{n.text}</p>
                        <p className="mt-0.5 text-xs text-mute">{n.time}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-line px-4 py-2.5">
            <Link
              href="/collections"
              onClick={() => setOpen(false)}
              className="block text-center text-sm font-medium text-brand hover:text-brand-deep"
            >
              Работа с долгом
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

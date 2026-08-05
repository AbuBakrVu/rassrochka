"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";

const nav = [
  { href: "/", label: "Главная", icon: LayoutGrid },
  { href: "/analytics", label: "Аналитика", icon: BarChart3 },
  { href: "/deals", label: "Сделки", icon: KanbanSquare },
  { href: "/clients", label: "Клиенты", icon: Users },
  { href: "/payments", label: "Платежи", icon: CalendarDays },
  { href: "/mailings", label: "Рассылки", icon: Send },
  { href: "/coinvestors", label: "Соинвесторы", icon: Handshake },
  { href: "/cash", label: "Кассы", icon: Wallet },
  { href: "/registry", label: "Реестр клиентов", icon: BookUser },
  { href: "/employees", label: "Сотрудники", icon: UserCog },
  { href: "/settings", label: "Настройки", icon: Settings },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const menu = (
    <nav className="flex flex-col gap-0.5 px-3" aria-label="Основные разделы">
      {nav.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
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

  return (
    <div className="flex min-h-screen">
      {/* Десктопный сайдбар */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex items-center gap-2.5 px-6 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand text-white">
            <Zap size={18} aria-hidden />
          </span>
          <span className="text-lg font-semibold tracking-tight">Финора</span>
        </div>
        {menu}
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
                <span className="font-semibold">Финора</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
                className="rounded-[10px] p-2 text-mute hover:bg-canvas"
              >
                <X size={18} />
              </button>
            </div>
            {menu}
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
          <span className="font-semibold">Финора</span>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

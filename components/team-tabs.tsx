"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useData } from "@/lib/store";
import { can } from "@/lib/permissions";

// Вкладки раздела «Сотрудники»: команда и журнал действий (раньше — отдельный
// пункт меню). Каждая вкладка — своя страница со своим правом доступа.
export default function TeamTabs() {
  const pathname = usePathname();
  const { user } = useData();
  const tabs = [
    can(user, "employees") && { href: "/employees", label: "Команда" },
    can(user, "journal") && { href: "/journal", label: "Журнал действий" },
  ].filter((t): t is { href: string; label: string } => !!t);
  if (tabs.length < 2) return null;

  return (
    <nav aria-label="Разделы команды" className="px-4 pt-3 sm:px-8">
      <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-line/70 bg-surface p-1 shadow-card">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                active ? "bg-brand text-on-brand shadow-card" : "text-mute hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/analytics", label: "Обзор" },
  { href: "/analytics/quality", label: "Качество портфеля" },
  { href: "/analytics/profit", label: "Доходность" },
];

/** Вкладки раздела «Аналитика» — каждая своя страница, чтобы ссылкой можно было поделиться. */
export default function AnalyticsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Разделы аналитики" className="px-4 pt-3 sm:px-8">
      <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-line/70 bg-surface p-1 shadow-card">
        {TABS.map((t) => {
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

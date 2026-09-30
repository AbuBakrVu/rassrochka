"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  PhoneCall,
  CalendarClock,
  FileSearch,
  UserPlus2,
  Check,
  ArrowRight,
  ListChecks,
} from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import { buildRoute, type RouteKind } from "@/lib/data";
import { money } from "@/lib/schedule";
import { useData } from "@/lib/store";

const kindMeta: Record<
  RouteKind,
  { label: string; icon: typeof PhoneCall; tone: string }
> = {
  overdue: { label: "Просрочка", icon: PhoneCall, tone: "danger" },
  deadline: { label: "Дедлайн", icon: CalendarClock, tone: "warn" },
  review: { label: "Проверка", icon: FileSearch, tone: "blue" },
  request: { label: "Новая заявка", icon: UserPlus2, tone: "blue" },
};

const toneClasses: Record<string, { bg: string; text: string }> = {
  danger: { bg: "bg-danger-soft", text: "text-danger" },
  warn: { bg: "bg-warn-soft", text: "text-warn" },
  blue: { bg: "bg-brand-soft", text: "text-brand" },
};

const tabs = [
  { key: "left", label: "Осталось" },
  { key: "all", label: "Все" },
  { key: "done", label: "Выполнено" },
] as const;

export default function RoutePage() {
  const { deals, paidPayments } = useData();
  const items = useMemo(() => buildRoute(deals, paidPayments), [deals, paidPayments]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("left");

  const toggle = (key: string) =>
    setDone((s) => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const list = items.filter((it) => {
    if (tab === "left") return !done.has(it.key);
    if (tab === "done") return done.has(it.key);
    return true;
  });

  const doneCount = items.filter((it) => done.has(it.key)).length;

  return (
    <>
      <PageHeader
        title="Маршрут"
        subtitle="Приоритетные дела менеджера на сегодня"
      />
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Выполнено {doneCount} из {items.length}
              </h2>
              <p className="text-sm text-mute">
                Сначала просрочки, потом дедлайны и заявки — по приоритету
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand">
              <ListChecks size={18} aria-hidden />
            </span>
          </div>
          <div
            className="mt-4 flex gap-1"
            role="progressbar"
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={items.length}
            aria-label="Прогресс по маршруту дня"
          >
            {items.map((it) => (
              <span
                key={it.key}
                className={`h-2 flex-1 rounded-full ${
                  done.has(it.key) ? "bg-good" : "bg-line"
                }`}
              />
            ))}
          </div>
        </Card>

        <div
          className="mt-4 flex gap-1.5"
          role="tablist"
          aria-label="Фильтр маршрута"
        >
          {tabs.map((t) => {
            const n =
              t.key === "left"
                ? items.length - doneCount
                : t.key === "done"
                  ? doneCount
                  : items.length;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 rounded-[10px] px-3.5 py-2 text-sm transition-colors ${
                  tab === t.key
                    ? "bg-brand font-medium text-on-brand"
                    : "border border-line bg-surface text-mute hover:text-ink"
                }`}
              >
                {t.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs ${
                    tab === t.key
                      ? "bg-on-brand/20 text-on-brand"
                      : "bg-canvas text-mute"
                  }`}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>

        {list.length === 0 ? (
          <Card className="mt-4 flex flex-col items-center px-6 py-14 text-center">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-good-soft text-good">
              <Check size={20} aria-hidden />
            </span>
            <p className="font-medium">
              {tab === "done" ? "Пока ничего не отмечено" : "Дел не осталось"}
            </p>
            <p className="mt-1 max-w-xs text-sm text-mute">
              {tab === "done"
                ? "Отмечайте дела по мере выполнения — они появятся здесь."
                : "Все приоритетные дела на сегодня закрыты."}
            </p>
          </Card>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {list.map((it) => {
              const meta = kindMeta[it.kind];
              const tone = toneClasses[meta.tone];
              const isDone = done.has(it.key);
              return (
                <li key={it.key}>
                  <Card
                    className={`flex items-center gap-4 p-4 transition-opacity ${
                      isDone ? "opacity-60" : ""
                    }`}
                  >
                    <button
                      onClick={() => toggle(it.key)}
                      aria-pressed={isDone}
                      aria-label={
                        isDone
                          ? `Вернуть «${it.text}» в работу`
                          : `Отметить «${it.text}» выполненным`
                      }
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        isDone
                          ? "border-good bg-good text-on-brand"
                          : "border-line text-transparent hover:border-brand"
                      }`}
                    >
                      <Check size={15} aria-hidden />
                    </button>

                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${tone.bg} ${tone.text}`}
                    >
                      <meta.icon size={16} aria-hidden />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/clients/${it.clientId}`}
                          className={`font-medium hover:text-brand-deep ${
                            isDone ? "line-through" : ""
                          }`}
                        >
                          {it.clientName}
                        </Link>
                        <span className={`text-xs ${tone.text}`}>
                          {meta.label}
                        </span>
                      </div>
                      <p
                        className={`truncate text-sm text-mute ${
                          isDone ? "line-through" : ""
                        }`}
                      >
                        {it.text} · {it.dealId}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <span className="hidden text-sm font-semibold whitespace-nowrap sm:inline">
                        {money(it.amount)}
                      </span>
                      <Link
                        href={`/deals/${it.dealId}`}
                        className="flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-deep"
                      >
                        Открыть <ArrowRight size={14} aria-hidden />
                      </Link>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

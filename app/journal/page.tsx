"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, ScrollText, Search, ShieldAlert } from "lucide-react";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { useData } from "@/lib/store";
import { downloadCsv } from "@/lib/csv";

// Журнал действий сотрудников: кто удалил сделку, откатил платёж, поправил
// кассу, сменил ответственного. Только для администратора — данные
// приходят отдельным запросом /api/audit, а не в общем bootstrap.

interface AuditEntry {
  id: string;
  at: string;
  userId: number | null;
  userName: string;
  action: string;
  entityId: string | null;
  details: string;
}

const GROUPS = [
  { key: "", label: "Все действия" },
  { key: "payment", label: "Платежи" },
  { key: "deal", label: "Сделки" },
  { key: "cash", label: "Касса" },
  { key: "client", label: "Клиенты" },
  { key: "coinvestor", label: "Соинвесторы" },
  { key: "employee", label: "Сотрудники" },
  { key: "settings", label: "Настройки" },
];

const ACTION_LABEL: Record<string, string> = {
  "deal.create": "Создание сделки",
  "deal.update": "Правка сделки",
  "deal.delete": "Удаление сделки",
  "deal.stage": "Смена этапа",
  "deal.manager": "Смена ответственного",
  "deal.close": "Досрочное закрытие",
  "deal.restructure": "Изменение графика",
  "payment.accept": "Приём платежа",
  "payment.undo": "Отмена платежа",
  "cash.adjustment": "Ручная операция",
  "client.create": "Новый клиент",
  "client.blacklist": "Чёрный список",
  "client.limit": "Лимит клиента",
  "employee.create": "Новый сотрудник",
  "employee.update": "Правка сотрудника",
  "coinvestor.create": "Новый соинвестор",
  "coinvestor.update": "Правка соинвестора",
  "coinvestor.delete": "Удаление соинвестора",
  "coinvestor.payout": "Выплата соинвестору",
  "coinvestor.reinvest": "Реинвестирование",
  "coinvestor.capital": "Капитал соинвестора",
  "settings.nav": "Разделы меню",
  "settings.credit": "Базовый лимит",
  "settings.branding": "Оформление",
};

// Действия, на которые владельцу стоит смотреть в первую очередь
const RISKY = new Set(["deal.delete", "payment.undo", "cash.adjustment", "deal.close", "coinvestor.payout"]);

function entityHref(id: string | null): string | null {
  if (!id) return null;
  if (id.startsWith("R-")) return `/deals/${id}`;
  if (id.startsWith("C-")) return `/clients/${id}`;
  if (id.startsWith("INV-")) return `/coinvestors/${id}`;
  return null;
}

const timeFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Moscow",
});

export default function JournalPage() {
  const { user, employees } = useData();
  const [userId, setUserId] = useState("");
  const [group, setGroup] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const isAdmin = user.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    const params = new URLSearchParams();
    if (userId) params.set("userId", userId);
    if (group) params.set("group", group);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (debounced) params.set("q", debounced);

    fetch(`/api/audit?${params}`)
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error((data as { error?: string }).error ?? "Ошибка загрузки");
        setEntries(data as AuditEntry[]);
        setError(null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, userId, group, from, to, debounced]);

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Журнал действий" subtitle="Кто и что менял в CRM" />
        <div className="mx-auto max-w-2xl px-4 py-6 sm:px-8">
          <Card>
            <EmptyState
              icon={ShieldAlert}
              title="Только для администратора"
              text="Журнал действий сотрудников видит администратор компании."
            />
          </Card>
        </div>
      </>
    );
  }

  const exportCsv = () => {
    if (!entries) return;
    downloadCsv(
      `журнал-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Время", "Сотрудник", "Действие", "Объект", "Подробности"],
      entries.map((e) => [
        timeFmt.format(new Date(e.at)),
        e.userName,
        ACTION_LABEL[e.action] ?? e.action,
        e.entityId ?? "",
        e.details,
      ])
    );
  };

  const field =
    "rounded-[10px] border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

  return (
    <>
      <PageHeader title="Журнал действий" subtitle="Кто и что менял в CRM — платежи, сделки, касса" />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-mute"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Номер сделки, клиент, сумма…"
              aria-label="Поиск по журналу"
              className={`${field} w-full pl-9`}
            />
          </label>
          <select value={userId} onChange={(e) => setUserId(e.target.value)} aria-label="Сотрудник" className={field}>
            <option value="">Все сотрудники</option>
            {employees.map((e) => (
              <option key={e.id} value={String(e.id)}>
                {e.name}
              </option>
            ))}
          </select>
          <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Тип действия" className={field}>
            {GROUPS.map((g) => (
              <option key={g.key} value={g.key}>
                {g.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-mute">
            С
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={field} />
          </label>
          <label className="flex items-center gap-2 text-sm text-mute">
            по
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={field} />
          </label>
          <button
            onClick={exportCsv}
            disabled={!entries || entries.length === 0}
            className="flex items-center gap-1.5 rounded-[10px] border border-line bg-surface px-3.5 py-2 text-sm text-mute transition-colors hover:border-brand/40 hover:text-ink disabled:opacity-50"
          >
            <Download size={15} aria-hidden />
            Экспорт
          </button>
        </div>

        <Card className="overflow-hidden">
          {error ? (
            <EmptyState icon={ShieldAlert} title="Не удалось загрузить журнал" text={error} />
          ) : entries === null ? (
            <div className="flex flex-col gap-3 p-5" aria-busy="true">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-[10px] bg-canvas" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="Записей нет"
              text="По этим фильтрам действий не было. Журнал ведётся с момента обновления CRM — более ранние действия в него не попали."
            />
          ) : (
            <ul className="divide-y divide-line">
              {entries.map((e) => {
                const href = entityHref(e.entityId);
                const risky = RISKY.has(e.action);
                return (
                  <li key={e.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-5 py-3 sm:px-6">
                    <span className="w-40 shrink-0 text-xs text-mute sm:pt-0.5">
                      {timeFmt.format(new Date(e.at))}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            risky ? "bg-warn-soft text-warn" : "bg-brand-soft text-brand-deep"
                          }`}
                        >
                          {ACTION_LABEL[e.action] ?? e.action}
                        </span>
                        <span className="font-medium">{e.userName}</span>
                      </p>
                      <p className="mt-1 text-sm text-mute">
                        {href ? (
                          <Link href={href} className="hover:text-brand-deep">
                            {e.details}
                          </Link>
                        ) : (
                          e.details
                        )}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        {entries && entries.length >= 500 && (
          <p className="mt-3 text-xs text-mute">
            Показаны последние 500 записей — сузьте период или фильтры, чтобы увидеть более ранние.
          </p>
        )}
      </div>
    </>
  );
}

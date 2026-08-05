"use client";

import { useMemo, useState } from "react";
import { Search, SearchX, X, Phone, Mail, ArrowRight } from "lucide-react";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import { clients, clientDetail, fmt, type Client } from "@/lib/data";

const statusTone: Record<Client["status"], "green" | "red" | "gray" | "blue"> =
  {
    active: "green",
    overdue: "red",
    closed: "gray",
    lead: "blue",
  };

const filters = [
  { key: "all", label: "Все" },
  { key: "active", label: "Активные" },
  { key: "lead", label: "В работе" },
  { key: "overdue", label: "Просрочка" },
  { key: "closed", label: "Закрытые" },
] as const;

export default function ClientsPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] =
    useState<(typeof filters)[number]["key"]>("all");
  const [selected, setSelected] = useState<string | null>(null);

  const list = useMemo(
    () =>
      clients.filter(
        (c) =>
          (filter === "all" || c.status === filter) &&
          c.name.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [query, filter]
  );

  return (
    <>
      <PageHeader
        title="Клиенты"
        subtitle="Реестр клиентов и статусы по сделкам"
        cta="+ Новый клиент"
      />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
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
              placeholder="Поиск по имени"
              className="w-full rounded-[10px] border border-line bg-surface py-2 pr-3 pl-9 text-sm outline-none focus:border-brand"
            />
          </label>
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label="Фильтр по статусу"
          >
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={`rounded-[10px] px-3.5 py-2 text-sm transition-colors ${
                  filter === f.key
                    ? "bg-brand font-medium text-white"
                    : "border border-line bg-surface text-mute hover:text-ink"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <Card className="overflow-hidden">
          {list.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Никого не нашли"
              text="Проверьте написание имени или сбросьте фильтр по статусу — список обновится сразу."
              action="Сбросить фильтры"
              onAction={() => {
                setQuery("");
                setFilter("all");
              }}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-mute">
                    <th className="px-5 py-3 font-medium">Клиент</th>
                    <th className="px-5 py-3 font-medium">Статус</th>
                    <th className="px-5 py-3 font-medium">Сделки</th>
                    <th className="px-5 py-3 font-medium">Портфель</th>
                    <th className="px-5 py-3 font-medium">
                      Ближайшее действие
                    </th>
                    <th className="px-5 py-3 font-medium">Срок</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {list.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelected(c.id)}
                      className="cursor-pointer transition-colors hover:bg-canvas"
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-mute">{c.phone}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={statusTone[c.status]}>
                          {c.statusLabel}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">{c.deals}</td>
                      <td className="px-5 py-3.5 font-medium">
                        {c.portfolio ? fmt(c.portfolio) : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-mute">{c.nextAction}</td>
                      <td
                        className={`px-5 py-3.5 ${
                          c.nextDate === "Сегодня"
                            ? "font-medium text-brand-deep"
                            : "text-mute"
                        }`}
                      >
                        {c.nextDate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <p className="mt-3 text-xs text-mute">
          Нажмите на строку, чтобы открыть карточку клиента.
        </p>
      </div>

      {/* Карточка клиента */}
      {selected && (
        <div className="fixed inset-0 z-40">
          <button
            aria-label="Закрыть карточку"
            className="absolute inset-0 bg-ink/30"
            onClick={() => setSelected(null)}
          />
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col overflow-y-auto bg-surface shadow-pop">
            <div className="flex items-start justify-between border-b border-line px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">
                  {clientDetail.name}
                </h2>
                <p className="mt-0.5 text-sm text-mute">
                  Клиент с {clientDetail.since} · {clientDetail.id}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                aria-label="Закрыть"
                className="rounded-[10px] p-2 text-mute hover:bg-canvas"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-5 px-6 py-5">
              <div className="rounded-[12px] bg-brand-soft p-4">
                <p className="text-xs font-medium text-brand-deep">
                  Ближайшее действие
                </p>
                <p className="mt-1 text-sm font-medium text-ink">
                  {clientDetail.nextAction}
                </p>
                <button className="mt-3 flex items-center gap-1.5 rounded-[10px] bg-brand px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-deep">
                  Принять платёж <ArrowRight size={15} aria-hidden />
                </button>
              </div>

              <div className="flex flex-col gap-2 text-sm">
                <p className="flex items-center gap-2.5 text-mute">
                  <Phone size={15} aria-hidden /> {clientDetail.phone}
                </p>
                <p className="flex items-center gap-2.5 text-mute">
                  <Mail size={15} aria-hidden /> {clientDetail.email}
                </p>
              </div>

              <section>
                <h3 className="mb-2 text-sm font-semibold">Активные сделки</h3>
                {clientDetail.deals.map((d) => (
                  <div
                    key={d.id}
                    className="rounded-[12px] border border-line p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{d.id}</p>
                      <Badge tone="green">{d.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-mute">
                      {fmt(d.amount)} · {d.months} месяцев ·{" "}
                      {fmt(d.monthly)}/мес
                    </p>
                    <div
                      className="mt-3 h-1.5 overflow-hidden rounded-full bg-line"
                      role="progressbar"
                      aria-valuenow={Math.round((d.paid / d.amount) * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Выплачено по сделке"
                    >
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${(d.paid / d.amount) * 100}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-mute">
                      Выплачено {fmt(d.paid)} из {fmt(d.amount)}
                    </p>
                  </div>
                ))}
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold">История платежей</h3>
                <ul className="divide-y divide-line">
                  {clientDetail.history.map((h) => (
                    <li
                      key={h.date}
                      className="flex items-center justify-between py-2.5 text-sm"
                    >
                      <span className="text-mute">{h.date}</span>
                      <span className="font-medium">{fmt(h.amount)}</span>
                      <Badge tone={h.status === "paid" ? "green" : "blue"}>
                        {h.status === "paid" ? "Оплачен" : "Ожидается"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

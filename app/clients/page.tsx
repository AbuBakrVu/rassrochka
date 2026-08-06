"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, SearchX } from "lucide-react";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import {
  clients,
  dealsOfClient,
  dealState,
  paidCount,
  type Client,
} from "@/lib/data";
import { buildSchedule, money } from "@/lib/schedule";

const statusTone: Record<Client["status"], "green" | "red" | "gray" | "blue"> = {
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

// Сводка по каждому клиенту считается из его сделок
const rows = clients.map((client) => {
  const list = dealsOfClient(client.id);
  const portfolio = list
    .filter((d) => dealState(d) === "active")
    .reduce((sum, d) => {
      const schedule = buildSchedule(
        d.amount,
        d.months,
        paidCount(d),
        d.openedAt
      );
      const paidSum = schedule
        .filter((p) => p.status === "paid")
        .reduce((s, p) => s + p.amount, 0);
      return sum + (d.amount - paidSum);
    }, 0);
  return { client, deals: list.length, portfolio };
});

export default function ClientsPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]["key"]>("all");

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = query.replace(/\D/g, "");
    return rows.filter(
      ({ client }) =>
        (filter === "all" || client.status === filter) &&
        (q === "" ||
          client.name.toLowerCase().includes(q) ||
          (digits.length >= 3 &&
            client.phone.replace(/\D/g, "").includes(digits)))
    );
  }, [query, filter]);

  return (
    <>
      <PageHeader
        title="Клиенты"
        subtitle="Реестр клиентов и статусы по сделкам"
        cta="+ Добавить"
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
              placeholder="Поиск по имени или телефону"
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
                    <th className="px-5 py-3 font-medium">Остаток</th>
                    <th className="px-5 py-3 font-medium">
                      Ближайшее действие
                    </th>
                    <th className="px-5 py-3 font-medium">Срок</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {list.map(({ client: c, deals, portfolio }) => (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/clients/${c.id}`)}
                      className="cursor-pointer transition-colors hover:bg-canvas"
                    >
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/clients/${c.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-medium hover:text-brand-deep"
                        >
                          {c.name}
                        </Link>
                        <p className="text-xs text-mute">{c.phone}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={statusTone[c.status]}>
                          {c.statusLabel}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">{deals}</td>
                      <td className="px-5 py-3.5 font-medium">
                        {portfolio ? money(portfolio) : "—"}
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
          Нажмите на строку, чтобы открыть карточку клиента со всеми сделками.
        </p>
      </div>
    </>
  );
}

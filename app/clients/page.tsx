"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, SearchX, Download, FileSpreadsheet } from "lucide-react";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import { dealsOfClient, dealState, paidCount, type Client } from "@/lib/data";
import { scheduleForDeal, paidTotal, money } from "@/lib/schedule";
import { useData } from "@/lib/store";
import { can } from "@/lib/permissions";
import { downloadCsv } from "@/lib/csv";
import SavedFilters from "@/components/saved-filters";
import { computeClientCredit } from "@/lib/credit";
import { todayIso } from "@/lib/status";

const statusTone: Record<Client["status"], "green" | "red" | "gray" | "blue"> = {
  active: "green",
  overdue: "red",
  closed: "gray",
  lead: "blue",
};

const riskText = { green: "text-good", yellow: "text-warn", red: "text-danger" } as const;
const riskDot = { green: "bg-good", yellow: "bg-warn", red: "bg-danger" } as const;

const filters = [
  { key: "all", label: "Все" },
  { key: "active", label: "Активные" },
  { key: "lead", label: "В работе" },
  { key: "overdue", label: "Просрочка" },
  { key: "closed", label: "Закрытые" },
] as const;

export default function ClientsPage() {
  const router = useRouter();
  const { clients, deals, paidPayments, employees, cash, clientDefaultLimit, user } = useData();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]["key"]>("all");
  // Менеджер — у клиента нет своего ответственного, фильтр оставляет тех,
  // у кого есть хоть одна сделка этого менеджера
  const [managerId, setManagerId] = useState("");

  // Сводка по каждому клиенту считается из его сделок
  const rows = useMemo(
    () =>
      clients.map((client) => {
        const list = dealsOfClient(deals, client.id);
        const portfolio = list
          .filter((d) => dealState(d) === "active")
          .reduce((sum, d) => {
            const schedule = scheduleForDeal(d, paidCount(d, paidPayments));
            const paidSum = paidTotal(schedule);
            return sum + (d.amount - paidSum);
          }, 0);
        return {
          client,
          deals: list.length,
          portfolio,
          risk: computeClientCredit(client, deals, paidPayments, cash, clientDefaultLimit).risk,
          managerIds: new Set(list.map((d) => String(d.managerId ?? ""))),
        };
      }),
    [clients, deals, paidPayments, cash, clientDefaultLimit]
  );

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = query.replace(/\D/g, "");
    return rows.filter(
      ({ client, managerIds }) =>
        (filter === "all" || client.status === filter) &&
        (managerId === "" || managerIds.has(managerId)) &&
        (q === "" ||
          client.name.toLowerCase().includes(q) ||
          (digits.length >= 3 &&
            client.phone.replace(/\D/g, "").includes(digits)))
    );
  }, [rows, query, filter, managerId]);

  const applyFilter = (p: Record<string, string>) => {
    setQuery(p.q ?? "");
    setFilter((filters.find((f) => f.key === p.status)?.key ?? "all"));
    setManagerId(p.manager ?? "");
  };

  const exportCsv = () => {
    downloadCsv(
      `клиенты-${todayIso()}.csv`,
      ["ID", "Имя", "Телефон", "Статус", "Сделок", "Остаток", "Ближайшее действие", "Срок"],
      list.map(({ client: c, deals, portfolio }) => [
        c.id,
        c.name,
        c.phone,
        c.statusLabel,
        deals,
        portfolio,
        c.nextAction,
        c.nextDate,
      ])
    );
  };

  return (
    <>
      <PageHeader
        title="Клиенты"
        subtitle="Реестр клиентов и статусы по сделкам"
        cta="+ Добавить"
        actions={
          can(user, "clients.edit") && (
            <Link
              href="/import"
              className="flex h-10 items-center gap-2 rounded-full bg-surface px-4 text-sm font-medium text-ink shadow-card hover:text-brand-deep"
            >
              <FileSpreadsheet size={15} aria-hidden /> Импорт из Excel
            </Link>
          )
        }
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
              className="w-full rounded-full border border-line bg-surface py-2 pr-3 pl-9 text-sm outline-none focus:border-brand"
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
                className={`rounded-full px-3.5 py-2 text-sm transition-colors ${
                  filter === f.key
                    ? "bg-brand font-medium text-on-brand"
                    : "border border-line bg-surface text-mute hover:text-ink"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <select
            value={managerId}
            onChange={(e) => setManagerId(e.target.value)}
            aria-label="Фильтр по менеджеру"
            className="rounded-full border border-line bg-surface px-3 py-2 text-sm text-mute hover:text-ink"
          >
            <option value="">Все менеджеры</option>
            {employees.map((e) => (
              <option key={e.id} value={String(e.id)}>
                {e.name}
              </option>
            ))}
          </select>
          <button
            onClick={exportCsv}
            disabled={list.length === 0}
            title="Выгрузить видимый список в CSV"
            className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-sm text-mute transition-colors hover:border-brand/40 hover:text-ink disabled:opacity-50"
          >
            <Download size={15} aria-hidden />
            Экспорт
          </button>
        </div>

        <div className="mb-4 empty:hidden">
          <SavedFilters
            page="clients"
            current={{ q: query.trim(), status: filter === "all" ? "" : filter, manager: managerId }}
            onApply={applyFilter}
            canSave={query.trim() !== "" || filter !== "all" || managerId !== ""}
          />
        </div>

        <Card className="overflow-hidden">
          {list.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Никого не нашли"
              text="Проверьте написание имени или сбросьте фильтр по статусу — список обновится сразу."
              action="Сбросить фильтры"
              onAction={() => applyFilter({})}
            />
          ) : (
            <>
            {/* Телефон: карточки вместо широкой таблицы */}
            <ul className="divide-y divide-line sm:hidden">
              {list.map(({ client: c, portfolio, risk }) => (
                <li key={c.id}>
                  <Link href={`/clients/${c.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-canvas">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-deep">
                      {c.name
                        .split(" ")
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join("")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="truncate text-xs text-mute">
                        {portfolio ? `остаток ${money(portfolio)}` : c.phone}
                        {c.nextAction !== "—" && ` · ${c.nextAction}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge tone={statusTone[c.status]}>{c.statusLabel}</Badge>
                      <span className={`text-xs font-medium ${riskText[risk.tone]}`}>
                        надёжность {risk.score}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-mute">
                    <th className="px-5 py-3 font-medium">Клиент</th>
                    <th className="px-5 py-3 font-medium">Статус</th>
                    <th className="px-5 py-3 font-medium">Надёжность</th>
                    <th className="px-5 py-3 font-medium">Сделки</th>
                    <th className="px-5 py-3 font-medium">Остаток</th>
                    <th className="px-5 py-3 font-medium">
                      Ближайшее действие
                    </th>
                    <th className="px-5 py-3 font-medium">Срок</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {list.map(({ client: c, deals, portfolio, risk }) => (
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
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 font-medium tabular-nums ${riskText[risk.tone]}`}
                          title={risk.label}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${riskDot[risk.tone]}`} aria-hidden />
                          {risk.score}
                          <span className="sr-only">— {risk.label}</span>
                        </span>
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
            </>
          )}
        </Card>
        <p className="mt-3 text-xs text-mute">
          Нажмите на строку, чтобы открыть карточку клиента со всеми сделками.
        </p>
      </div>
    </>
  );
}

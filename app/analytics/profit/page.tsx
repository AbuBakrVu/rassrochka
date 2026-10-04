"use client";

import { useState } from "react";
import Link from "next/link";
import { TrendingUp, HandCoins, PiggyBank, Info, Search } from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import AnalyticsTabs from "@/components/analytics-tabs";
import MonthBars from "@/components/month-bars";
import { useData } from "@/lib/store";
import { computeProfit, type DealProfit } from "@/lib/profit";
import { money } from "@/lib/schedule";
import { ruPlural } from "@/lib/data";

const pct = (v: number) => `${Math.round(v * 100)}%`;

const monthsText = (days: number) => {
  const m = Math.max(Math.round(days / 30), 1);
  return `${m} ${ruPlural(m, "месяц", "месяца", "месяцев")}`;
};

type Sort = "margin" | "markup" | "payback" | "opened";

const SORTS: { key: Sort; label: string }[] = [
  { key: "margin", label: "По марже" },
  { key: "markup", label: "По наценке" },
  { key: "payback", label: "По окупаемости" },
  { key: "opened", label: "Новые сверху" },
];

function sortDeals(rows: DealProfit[], sort: Sort) {
  const list = [...rows];
  if (sort === "margin") return list.sort((a, b) => b.margin - a.margin);
  if (sort === "markup") return list.sort((a, b) => b.markup - a.markup);
  if (sort === "opened") return list.sort((a, b) => b.deal.openedAt.localeCompare(a.deal.openedAt));
  return list.sort(
    (a, b) => Math.min(b.collected / (b.purchase || 1), 1) - Math.min(a.collected / (a.purchase || 1), 1)
  );
}

function PaybackCell({ r }: { r: DealProfit }) {
  const share = r.purchase ? Math.min(Math.max(r.collected / r.purchase, 0), 1) : 1;
  const done = !!r.paybackDate;
  return (
    <div className="min-w-36">
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
          <div
            className={`h-full rounded-full ${done ? "bg-good" : "bg-brand"}`}
            style={{ width: `${share * 100}%` }}
          />
        </div>
        <span className={`text-xs font-medium tabular-nums ${done ? "text-good" : ""}`}>{pct(share)}</span>
      </div>
      <p className="mt-0.5 text-xs text-mute">
        {done
          ? `окупилась за ${monthsText(r.paybackDays ?? 0)}`
          : r.paybackPlanned && r.paybackDays !== null
            ? `по графику — за ${monthsText(r.paybackDays)}`
            : "ещё не окупилась"}
      </p>
    </div>
  );
}

export default function ProfitPage() {
  const { deals, cash, coinvestors, coinvestorProfitTx } = useData();
  const p = computeProfit(deals, cash, coinvestors, coinvestorProfitTx);
  const [sort, setSort] = useState<Sort>("margin");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const q = query.trim().toLowerCase();
  const filtered = sortDeals(p.deals, sort).filter(
    (r) =>
      !q ||
      `${r.deal.id} ${r.deal.client} ${r.deal.product}`.toLowerCase().includes(q)
  );
  const visible = showAll ? filtered : filtered.slice(0, 15);
  const yearEarned = p.byMonth.reduce((s, m) => s + m.earned, 0);

  const kpis = [
    {
      label: "Вложено в товар",
      value: money(p.invested),
      note: `${p.deals.length} ${ruPlural(p.deals.length, "сделка", "сделки", "сделок")}, в работе ещё ${money(p.atWork)}`,
      cls: "",
    },
    {
      label: "Маржа по сделкам",
      value: money(p.margin),
      note: `средняя наценка ${pct(p.markup)}`,
      cls: "",
    },
    {
      label: "Прибыль получена",
      value: money(p.earned),
      note: `с ${money(p.collected)} полученных платежей`,
      cls: "text-good",
    },
    {
      label: "Чистая прибыль компании",
      value: money(p.net),
      note: p.coinvestorShare
        ? `после ${money(p.coinvestorShare)} доли соинвесторов`
        : "соинвесторам ничего не начислено",
      cls: "",
    },
  ];

  return (
    <>
      <PageHeader title="Аналитика" subtitle="Доходность: вложено, заработано и когда вернулось" />
      <AnalyticsTabs />
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((k) => (
            <Card key={k.label} className="p-5">
              <p className="text-sm text-mute">{k.label}</p>
              <p className={`mt-2 text-[26px] font-semibold tracking-tight ${k.cls}`}>{k.value}</p>
              <p className="mt-1 text-sm text-mute">{k.note}</p>
            </Card>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
          <Card className="p-5 sm:p-6">
            <div className="mb-1 flex items-center gap-2">
              <TrendingUp size={16} className="text-brand" aria-hidden />
              <h2 className="font-semibold">Прибыль по месяцам</h2>
            </div>
            <p className="mb-4 text-sm text-mute">
              Доля маржи в платежах, полученных за месяц · за 12 месяцев {money(yearEarned)}
            </p>
            <MonthBars
              bars={p.byMonth.map((m) => ({
                key: m.key,
                label: m.label,
                title: m.title,
                value: Math.round(m.earned),
                note: `получено платежей ${money(m.collected)}`,
              }))}
              format={money}
              emptyText="платежей не было"
              ariaLabel="Прибыль по месяцам за последний год"
            />
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="mb-1 flex items-center gap-2">
              <HandCoins size={16} className="text-brand" aria-hidden />
              <h2 className="font-semibold">Окупаемость</h2>
            </div>
            <p className="mb-4 text-sm text-mute">Когда к компании возвращается закупочная цена</p>
            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-mute">В среднем окупается за</dt>
                <dd className="text-lg font-semibold tracking-tight">
                  {p.avgPaybackDays === null ? "—" : monthsText(p.avgPaybackDays)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-mute">Окупилось сделок</dt>
                <dd className="font-medium">
                  {p.paidBack} из {p.deals.length}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-mute">Закупка ещё в работе</dt>
                <dd className="font-medium">{money(p.atWork)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-mute">Продано на сумму</dt>
                <dd className="font-medium">{money(p.sale)}</dd>
              </div>
            </dl>
          </Card>
        </div>

        <Card className="mt-4 overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 px-5 pt-5 sm:px-6">
            <h2 className="mr-auto font-semibold">Сделки</h2>
            <label className="relative">
              <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-mute" aria-hidden />
              <span className="sr-only">Поиск сделки</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Клиент, товар, номер"
                className="w-56 rounded-full border border-line bg-canvas py-2 pr-3 pl-9 text-sm outline-none focus:border-brand focus:bg-surface"
              />
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              aria-label="Сортировка"
              className="rounded-full border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-brand"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <p className="px-5 pt-1 pb-4 text-sm text-mute sm:px-6">
            Закупка, маржа и сколько денег уже вернулось по каждой выданной сделке
          </p>
          {filtered.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-mute sm:px-6">
              {p.deals.length ? "Ничего не нашли." : "Выданных сделок пока нет."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-mute">
                    <th className="px-5 py-2.5 font-medium sm:px-6">Сделка</th>
                    <th className="px-3 py-2.5 text-right font-medium">Закупка</th>
                    <th className="px-3 py-2.5 text-right font-medium">Продажа</th>
                    <th className="px-3 py-2.5 text-right font-medium">Маржа</th>
                    <th className="px-3 py-2.5 text-right font-medium">Получено</th>
                    <th className="px-3 py-2.5 font-medium">Окупаемость</th>
                    <th className="px-3 py-2.5 pr-5 text-right font-medium sm:pr-6">Прибыль</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visible.map((r) => (
                    <tr key={r.deal.id} className="hover:bg-canvas/60">
                      <td className="max-w-64 px-5 py-3 sm:px-6">
                        <Link href={`/deals/${r.deal.id}`} className="block truncate font-medium hover:text-brand">
                          {r.deal.product}
                        </Link>
                        <p className="truncate text-xs text-mute">
                          {r.deal.id} · {r.deal.client}
                          {r.deal.stage === "closed" && " · закрыта"}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{money(r.purchase)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{money(r.sale)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {money(r.margin)}
                        <p className="text-xs text-mute">{pct(r.markup)} к закупке</p>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{money(r.collected)}</td>
                      <td className="px-3 py-3">
                        <PaybackCell r={r} />
                      </td>
                      <td className="px-3 py-3 pr-5 text-right tabular-nums sm:pr-6">
                        <span className="font-medium text-good">{money(r.earned)}</span>
                        {r.coinvestorShare > 0 && (
                          <p className="text-xs text-mute">соинв. {money(r.coinvestorShare)}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filtered.length > 15 && (
            <div className="border-t border-line px-5 py-3 sm:px-6">
              <button
                onClick={() => setShowAll((v) => !v)}
                className="text-sm font-medium text-brand hover:text-brand-deep"
              >
                {showAll ? "Свернуть" : `Показать все ${filtered.length}`}
              </button>
            </div>
          )}
        </Card>

        <Card className="mt-4 overflow-hidden">
          <div className="flex items-center gap-2 px-5 pt-5 sm:px-6">
            <PiggyBank size={16} className="text-brand" aria-hidden />
            <h2 className="font-semibold">Доходность соинвесторов</h2>
          </div>
          <p className="px-5 pb-4 text-sm text-mute sm:px-6">
            Сколько заработал каждый рубль, вложенный соинвестором
          </p>
          {p.coinvestors.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-mute sm:px-6">Соинвесторов нет.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-mute">
                    <th className="px-5 py-2.5 font-medium sm:px-6">Соинвестор</th>
                    <th className="px-3 py-2.5 text-right font-medium">Капитал</th>
                    <th className="px-3 py-2.5 text-right font-medium">Начислено</th>
                    <th className="px-3 py-2.5 text-right font-medium">К выплате</th>
                    <th className="px-3 py-2.5 text-right font-medium">Доходность</th>
                    <th className="px-3 py-2.5 pr-5 text-right font-medium sm:pr-6">Годовых</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {p.coinvestors.map(({ coinvestor: c, roi, roiYear }) => (
                    <tr key={c.id}>
                      <td className="px-5 py-3 sm:px-6">
                        <Link href={`/coinvestors/${c.id}`} className="font-medium hover:text-brand">
                          {c.name}
                        </Link>
                        <p className="text-xs text-mute">
                          доля {c.profitSharePct}% прибыли{!c.active && " · неактивен"}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{money(c.capital)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{money(c.accrued)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{money(c.owed)}</td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums">{pct(roi)}</td>
                      <td className="px-3 py-3 pr-5 text-right tabular-nums sm:pr-6">
                        {roiYear === null ? <span className="text-mute">—</span> : pct(roiYear)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <p className="mt-4 flex items-start gap-2 text-xs text-mute">
          <Info size={13} className="mt-px shrink-0" aria-hidden />
          Закупочная цена восстанавливается из наценки сделки. Прибыль
          признаётся по мере оплаты: в каждом платеже та же доля маржи, что во
          всей сделке. Платежи — по записям кассы, с учётом первого взноса и
          отмен.
        </p>
      </div>
    </>
  );
}

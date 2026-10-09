"use client";

import { useState } from "react";
import {
  Wallet,
  CheckCircle2,
  XCircle,
  Receipt,
  TrendingUp,
  HandCoins,
  FilePlus2,
} from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import AnalyticsTabs from "@/components/analytics-tabs";
import { stages, paidCount, dealMargin, type Deal } from "@/lib/data";
import { scheduleForDeal, paidTotal, money } from "@/lib/schedule";
import { useData } from "@/lib/store";
import OverviewChart from "@/components/overview-chart";
import { todayIso } from "@/lib/derive";
import { PERIOD_LABEL, changePct, inRange, periodRanges, type PeriodKey, type Range } from "@/lib/period";

const shortDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
// «1–9 сент.» внутри месяца, «1 июл. – 20 авг.» через границу месяцев
const rangeLabel = (r: Range) =>
  r.from === r.to
    ? shortDay(r.from)
    : r.from.slice(0, 7) === r.to.slice(0, 7)
      ? `${Number(r.from.slice(8))}–${shortDay(r.to)}`
      : `${shortDay(r.from)} – ${shortDay(r.to)}`;

/** «+12% к 1 сент. – 9 сент.» — зелёным рост, красным падение. */
function Delta({ now, before, prev }: { now: number; before: number; prev: Range | null }) {
  if (!prev) return null;
  const pct = changePct(now, before);
  return (
    <p className="mt-1 text-sm text-mute">
      {pct === null ? (
        "в прошлом периоде — 0"
      ) : (
        <>
          <span className={`font-medium ${pct > 0 ? "text-good" : pct < 0 ? "text-danger" : ""}`}>
            {pct > 0 ? "+" : ""}
            {pct}%
          </span>{" "}
          к {rangeLabel(prev)}
        </>
      )}
    </p>
  );
}

const decidedStages = ["active", "closed", "rejected"] as const;

function activeRemaining(deals: Deal[], paidPayments: Record<string, number>) {
  return deals
    .filter((d) => d.stage === "active")
    .reduce((sum, d) => {
      const schedule = scheduleForDeal(d, paidCount(d, paidPayments));
      const paidSum = paidTotal(schedule);
      return sum + (d.amount - paidSum);
    }, 0);
}

function Bar({
  label,
  value,
  max,
  tone = "brand",
  suffix,
}: {
  label: string;
  value: number;
  max: number;
  tone?: "brand" | "danger" | "gray";
  suffix?: string;
}) {
  const pct = max ? Math.max((value / max) * 100, value > 0 ? 4 : 0) : 0;
  const bar =
    tone === "danger" ? "bg-danger" : tone === "gray" ? "bg-line" : "bg-brand";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="text-ink">{label}</span>
        <span className="font-medium">
          {value}
          {suffix}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-canvas">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { deals, paidPayments, cash } = useData();
  const [period, setPeriod] = useState<PeriodKey>("month");
  const { current: cur, previous: prev } = periodRanges(period, todayIso());
  const byStage = stages.map((s) => ({
    ...s,
    count: deals.filter((d) => d.stage === s.key).length,
  }));
  const maxStage = Math.max(...byStage.map((s) => s.count), 1);

  const closedDeals = deals.filter((d) => d.stage === "closed");

  // Показатели за период — по дате заявки и дате платежа. Воронка «по
  // этапам» ниже — снимок на сегодня, от периода не зависит
  const periodStats = (r: Range | null) => {
    const opened = deals.filter((d) => inRange(d.openedAt, r));
    const rejected = opened.filter((d) => d.stage === "rejected");
    const decided = opened.filter((d) => decidedStages.includes(d.stage as (typeof decidedStages)[number]));
    const issued = opened.filter((d) => d.stage === "active" || d.stage === "closed");
    return {
      rejected,
      decided: decided.length,
      approved: decided.length - rejected.length,
      issued: issued.length,
      issuedSum: issued.reduce((s, d) => s + d.amount + (d.downPayment ?? 0), 0),
      // Без сделок — 0, а не NaN
      avg: opened.length ? Math.round(opened.reduce((s, d) => s + d.amount, 0) / opened.length) : 0,
      count: opened.length,
      // Платежи клиентов; отмена — отдельная минусовая запись, она вычитается
      collected: cash.filter((t) => t.kind === "payment" && inRange(t.date, r)).reduce((s, t) => s + t.amount, 0),
    };
  };
  const now = periodStats(cur);
  const before = periodStats(prev);
  const rejectedDeals = now.rejected;
  const conversion = now.decided ? Math.round((now.approved / now.decided) * 100) : 0;

  const profit = deals
    .filter((d) => d.stage === "active" || d.stage === "closed")
    .reduce((s, d) => s + dealMargin(d.amount, d.markupPct, d.downPayment ?? 0), 0);

  const reasons = rejectedDeals.reduce<Record<string, number>>((acc, d) => {
    const reason = d.nextStep.replace(/^Отказ:\s*/, "");
    acc[reason] = (acc[reason] ?? 0) + 1;
    return acc;
  }, {});
  const reasonList = Object.entries(reasons).sort((a, b) => b[1] - a[1]);
  const maxReason = Math.max(...reasonList.map(([, n]) => n), 1);

  // Поступления по месяцам (раньше — на главной): платежи клиентов из кассы
  const year = new Date().getFullYear();
  const payments = cash.filter((t) => t.kind === "payment");
  const byMonth = (y: number) =>
    Array.from({ length: 12 }, (_, m) => {
      const prefix = `${y}-${String(m + 1).padStart(2, "0")}`;
      return payments.filter((t) => t.date.startsWith(prefix)).reduce((sum, t) => sum + t.amount, 0);
    });

  const kpis = [
    {
      label: "Портфель в работе",
      value: money(activeRemaining(deals, paidPayments)),
      note: <p className="mt-1 text-sm text-mute">остаток по активным сделкам на сегодня</p>,
      icon: Wallet,
    },
    {
      label: "Собрано",
      value: money(now.collected),
      note: <Delta now={now.collected} before={before.collected} prev={prev} />,
      icon: HandCoins,
    },
    {
      label: "Выдано",
      value: money(now.issuedSum),
      note: prev ? (
        <Delta now={now.issuedSum} before={before.issuedSum} prev={prev} />
      ) : (
        <p className="mt-1 text-sm text-mute">сделок: {now.issued}</p>
      ),
      icon: FilePlus2,
    },
    {
      label: "Одобрено заявок",
      value: `${now.approved} из ${now.decided}`,
      note: (
        <p className="mt-1 text-sm text-mute">
          конверсия {conversion}%
          {prev && before.decided > 0 && `, было ${Math.round((before.approved / before.decided) * 100)}%`}
        </p>
      ),
      icon: CheckCircle2,
    },
    {
      label: "Средний чек",
      value: money(now.avg),
      note: prev ? (
        <Delta now={now.avg} before={before.avg} prev={prev} />
      ) : (
        <p className="mt-1 text-sm text-mute">по {now.count} сделкам</p>
      ),
      icon: Receipt,
    },
  ];

  return (
    <>
      <PageHeader
        title="Аналитика"
        subtitle="Сборы и выдачи за период, воронка, отказы и поступления по месяцам"
      />
      <AnalyticsTabs />
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-8">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex gap-1 rounded-full border border-line/70 bg-surface p-1 shadow-card" role="tablist" aria-label="Период">
            {(Object.keys(PERIOD_LABEL) as PeriodKey[]).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={period === k}
                onClick={() => setPeriod(k)}
                className={`rounded-full px-4 py-2 text-sm font-medium ${period === k ? "bg-brand text-on-brand" : "text-mute hover:text-ink"}`}
              >
                {PERIOD_LABEL[k]}
              </button>
            ))}
          </div>
          <p className="text-sm text-mute">
            {cur && prev ? `${rangeLabel(cur)} · сравнение с ${rangeLabel(prev)}` : "За всё время, без сравнения"}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {kpis.map(({ label, value, note, icon: Icon }) => (
            <Card key={label} className="p-5">
              <div className="flex items-start justify-between">
                <p className="text-sm text-mute">{label}</p>
                <span className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-brand-soft text-brand">
                  <Icon size={17} aria-hidden />
                </span>
              </div>
              <p className="mt-2 text-[24px] font-semibold tracking-tight tabular-nums">
                {value}
              </p>
              {note}
            </Card>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
          <Card className="p-5 sm:p-6">
            <div className="mb-1 flex items-center gap-2">
              <TrendingUp size={16} className="text-brand" aria-hidden />
              <h2 className="font-semibold">Сделки по этапам</h2>
            </div>
            <p className="mb-4 text-sm text-mute">
              Сколько сделок сейчас находится на каждом шаге воронки
            </p>
            <div className="flex flex-col gap-4">
              {byStage.map((s) => (
                <Bar key={s.key} label={s.title} value={s.count} max={maxStage} />
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-4 border-t border-line pt-4 text-sm">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-line" aria-hidden />
                Закрыто успешно: <b className="font-semibold">{closedDeals.length}</b>
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-danger" aria-hidden />
                Отклонено: <b className="font-semibold">{deals.filter((d) => d.stage === "rejected").length}</b>
              </span>
              <span className="text-mute">
                Прибыль по активным и закрытым: {money(profit)}
              </span>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="mb-1 flex items-center gap-2">
              <XCircle size={16} className="text-danger" aria-hidden />
              <h2 className="font-semibold">Причины отказов</h2>
            </div>
            <p className="mb-4 text-sm text-mute">
              По {rejectedDeals.length} отклонённым заявкам
              {cur ? ` за ${PERIOD_LABEL[period].toLowerCase()}` : ""}
            </p>
            {reasonList.length === 0 ? (
              <p className="text-sm text-mute">Отказов за этот период не было.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {reasonList.map(([reason, count]) => (
                  <Bar
                    key={reason}
                    label={reason}
                    value={count}
                    max={maxReason}
                    tone="danger"
                  />
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card className="mt-4 p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Wallet size={16} className="text-brand" aria-hidden />
                <h2 className="font-semibold">Поступления</h2>
              </div>
              <div className="mt-1 flex gap-4 text-xs text-mute">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-brand" aria-hidden /> {year}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-orange" aria-hidden /> {year - 1}
                </span>
              </div>
            </div>
            <span className="text-sm text-mute">платежи клиентов по месяцам, этот год против прошлого</span>
          </div>
          <OverviewChart current={byMonth(year)} previous={byMonth(year - 1)} year={year} monthsShown={new Date().getMonth() + 1} />
        </Card>
      </div>
    </>
  );
}

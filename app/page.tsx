"use client";

import Link from "next/link";
import {
  Clock,
  Briefcase,
  AlertCircle,
  Users,
  ArrowRight,
} from "lucide-react";
import { PageHeader, Card, Badge } from "@/components/ui";
import { ruPlural, type RouteKind } from "@/lib/data";
import { money } from "@/lib/schedule";
import { useData } from "@/lib/store";
import { computeDashboard } from "@/lib/derive";

const dotTone: Record<RouteKind, string> = {
  overdue: "bg-danger",
  deadline: "bg-warn",
  review: "bg-warn",
  request: "bg-brand",
};

// Столбики по дням месяца: видно, в какие даты приходят деньги.
// Линия здесь была бы честной только при плотном графике платежей —
// на нескольких сделках она превращалась в две точки и полку.
function InflowChart({ points }: { points: { day: number; sum: number }[] }) {
  const days = 31;
  const w = 700;
  const h = 200;
  const max = Math.max(...points.map((p) => p.sum), 1);
  const slot = w / days;
  const barW = Math.min(slot * 0.55, 14);
  const byDay = new Map(points.map((p) => [p.day, p.sum]));

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-48 w-full sm:h-56"
      role="img"
      aria-label={`Ожидаемые поступления по дням августа, максимум за день ${money(max)}`}
    >
      {[0.25, 0.5, 0.75, 1].map((t) => (
        <line
          key={t}
          x1="0"
          x2={w}
          y1={h - h * t}
          y2={h - h * t}
          stroke="var(--color-line)"
          strokeWidth="1"
        />
      ))}
      {Array.from({ length: days }, (_, i) => {
        const day = i + 1;
        const sum = byDay.get(day);
        if (!sum) return null;
        const barH = Math.max((sum / max) * (h - 8), 4);
        return (
          <rect
            key={day}
            x={slot * i + (slot - barW) / 2}
            y={h - barH}
            width={barW}
            height={barH}
            rx="3"
            fill="var(--color-brand)"
          >
            <title>{`${day} августа — ${money(sum)}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

export default function Home() {
  const { deals, clients, paidPayments } = useData();
  const d = computeDashboard(deals, clients, paidPayments);

  const kpis = [
    {
      label: "К оплате сегодня",
      value: money(d.dueToday.sum),
      note: d.dueToday.count
        ? `${d.dueToday.count} ${ruPlural(d.dueToday.count, "платёж", "платежа", "платежей")} до 18:00`
        : "на сегодня платежей нет",
      noteClass: "text-mute",
      icon: Clock,
    },
    {
      label: "Портфель",
      value: money(d.portfolio),
      note: "остаток по активным сделкам",
      noteClass: "text-good",
      icon: Briefcase,
    },
    {
      label: "Просрочка",
      value: money(d.overdue.sum),
      note: d.overdue.count
        ? `${d.overdue.count} ${ruPlural(d.overdue.count, "сделка требует", "сделки требуют", "сделок требуют")} контакта`
        : "просрочек нет",
      noteClass: d.overdue.count ? "text-danger" : "text-mute",
      icon: AlertCircle,
    },
    {
      label: "Активные клиенты",
      value: String(d.activeClients),
      note: "с действующей рассрочкой",
      noteClass: "text-mute",
      icon: Users,
    },
  ];

  return (
    <>
      <PageHeader
        title="Главная"
        subtitle="Оперативный контроль портфеля"
        searchPlaceholder="Найти клиента или сделку"
        cta="+ Добавить"
      />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Добрый день, Алексей
            </h2>
            <p className="mt-1 text-sm text-mute">
              Здесь собраны только действия и цифры, которые требуют решения
              сегодня.
            </p>
          </div>
          <span className="rounded-[10px] border border-line bg-surface px-4 py-2 text-sm text-mute">
            Сегодня · 5 августа
          </span>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map(({ label, value, note, noteClass, icon: Icon }) => (
            <Card key={label} className="p-5">
              <div className="flex items-start justify-between">
                <p className="text-sm text-mute">{label}</p>
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-soft text-brand">
                  <Icon size={17} aria-hidden />
                </span>
              </div>
              <p className="mt-2 text-[26px] font-semibold tracking-tight">
                {value}
              </p>
              <p className={`mt-1 text-sm ${noteClass}`}>{note}</p>
            </Card>
          ))}
        </div>

        {/* График + приоритеты */}
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
          <Card className="p-5 sm:p-6">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-semibold">План поступлений</h3>
              <Link
                href="/analytics"
                className="flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-deep"
              >
                Аналитика <ArrowRight size={15} aria-hidden />
              </Link>
            </div>
            <p className="mb-4 text-sm text-mute">
              Ожидаемые оплаты по дням августа — всего {money(d.inflowTotal)}
            </p>
            {d.inflow.length === 0 ? (
              <p className="py-16 text-center text-sm text-mute">
                В августе платежей не запланировано.
              </p>
            ) : (
              <>
                <InflowChart points={d.inflow} />
                <div className="mt-2 flex justify-between text-xs text-mute">
                  {["1 авг", "8 авг", "15 авг", "22 авг", "31 авг"].map((x) => (
                    <span key={x}>{x}</span>
                  ))}
                </div>
              </>
            )}
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-semibold">Приоритеты</h3>
              <Link
                href="/route"
                className="flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-deep"
              >
                Все <ArrowRight size={15} aria-hidden />
              </Link>
            </div>
            <p className="mb-2 text-sm text-mute">Очередь на сегодня</p>
            <ul className="divide-y divide-line">
              {d.priorities.map((p) => (
                <li key={p.key} className="flex items-center gap-3 py-3.5">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${dotTone[p.kind]}`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/deals/${p.dealId}`}
                      className="block truncate text-sm font-medium hover:text-brand-deep"
                    >
                      {p.clientName}
                    </Link>
                    <p
                      className={`truncate text-sm ${
                        p.kind === "overdue" ? "text-danger" : "text-mute"
                      }`}
                    >
                      {p.text}
                    </p>
                  </div>
                  <span className="text-sm font-semibold whitespace-nowrap">
                    {money(p.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Заявки + контроль срока */}
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card className="p-5 sm:p-6">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-semibold">Новые заявки</h3>
              <Link
                href="/deals"
                className="flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-deep"
              >
                К списку <ArrowRight size={15} aria-hidden />
              </Link>
            </div>
            <p className="mb-2 text-sm text-mute">
              Быстрая квалификация без лишних экранов
            </p>
            {d.newRequests.length === 0 ? (
              <p className="py-6 text-sm text-mute">
                Новых заявок нет — все разобраны.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {d.newRequests.map((r) => (
                  <li key={r.dealId} className="flex items-center gap-3 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.name}</p>
                      <p className="truncate text-sm text-mute">{r.text}</p>
                    </div>
                    <Link
                      href={`/deals/${r.dealId}`}
                      className="rounded-[10px] bg-brand-soft px-3.5 py-2 text-sm font-medium text-brand-deep hover:bg-brand hover:text-white"
                    >
                      Проверить
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-semibold">Контроль срока</h3>
              <Link
                href="/route"
                className="flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-deep"
              >
                Открыть <ArrowRight size={15} aria-hidden />
              </Link>
            </div>
            <p className="mb-2 text-sm text-mute">
              Договоры с ближайшими событиями
            </p>
            {d.deadlines.length === 0 ? (
              <p className="py-6 text-sm text-mute">
                Ближайших дедлайнов нет.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {d.deadlines.map((x) => (
                  <li key={x.dealId} className="flex items-center gap-3 py-3.5">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/deals/${x.dealId}`}
                        className="block truncate text-sm font-medium hover:text-brand-deep"
                      >
                        {x.title}
                      </Link>
                      <p className="truncate text-sm text-mute">{x.text}</p>
                    </div>
                    <Badge tone="red">{x.badge}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

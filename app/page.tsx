"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Clock,
  Briefcase,
  AlertCircle,
  Users,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
} from "lucide-react";
import { PageHeader, Card, Badge } from "@/components/ui";
import { ruPlural, type RouteKind } from "@/lib/data";
import { money } from "@/lib/schedule";
import { useData } from "@/lib/store";
import { computeActive, computeDashboard, todayIso } from "@/lib/derive";

// Главная в стиле «бенто»: слева KPI с мини-графиками и план поступлений,
// справа — календарь платежей месяца и ближайшие оплаты, внизу очереди дел.

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const dotTone: Record<RouteKind, string> = {
  overdue: "bg-danger",
  deadline: "bg-warn",
  review: "bg-warn",
  request: "bg-brand",
};

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}

/** Путь столбика со скруглённой верхушкой и прямым основанием — столбик «стоит» на оси. */
function barPath(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

// ── Мини-графики в KPI ─────────────────────────────────────────────────

/** Поступления на 7 дней вперёд — столбики, сегодняшний выделен. */
function WeekBars({ days }: { days: { label: string; sum: number; today: boolean }[] }) {
  const max = Math.max(...days.map((d) => d.sum), 1);
  return (
    <div className="flex h-10 items-end gap-1" aria-hidden>
      {days.map((d, i) => (
        <span
          key={i}
          title={`${d.label} — ${money(d.sum)}`}
          className={`w-2 rounded-t-[3px] ${d.today ? "bg-brand" : "bg-brand/35"}`}
          style={{ height: `${d.sum ? Math.max((d.sum / max) * 100, 12) : 6}%` }}
        />
      ))}
    </div>
  );
}

/** Доля собранного — кольцо. */
function Ring({ pct }: { pct: number }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90" aria-hidden>
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--color-brand-soft)" strokeWidth="5" />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${(c * Math.min(pct, 100)) / 100} ${c}`}
      />
    </svg>
  );
}

// ── План поступлений ───────────────────────────────────────────────────

function InflowChart({
  points,
  daysInMonth,
  monthIndex,
  todayDay,
}: {
  points: Map<number, number>;
  daysInMonth: number;
  monthIndex: number;
  /** День месяца «сегодня», если показан текущий месяц. */
  todayDay: number | null;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 720;
  const h = 210;
  const max = Math.max(...points.values(), 1);
  const slot = w / daysInMonth;
  const barW = Math.min(slot * 0.5, 14);
  const hovered = hover !== null ? { day: hover, sum: points.get(hover) ?? 0 } : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-52 w-full sm:h-60"
        role="img"
        aria-label={`Ожидаемые поступления по дням, ${MONTHS[monthIndex].toLowerCase()}, максимум за день ${money(max)}`}
        onMouseLeave={() => setHover(null)}
      >
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1="0"
            x2={w}
            y1={h - h * t + 0.5}
            y2={h - h * t + 0.5}
            stroke="var(--color-line)"
            strokeDasharray="3 5"
          />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const sum = points.get(day) ?? 0;
          const x = slot * i;
          const barH = sum ? Math.max((sum / max) * (h - 12), 4) : 0;
          const isToday = todayDay === day;
          return (
            <g key={day} onMouseEnter={() => setHover(day)}>
              {/* Зона наведения шире столбика — по всей высоте колонки дня */}
              <rect x={x} y={0} width={slot} height={h} fill="transparent" />
              {hover === day && <rect x={x} y={0} width={slot} height={h} fill="var(--color-brand-soft)" opacity="0.6" rx="4" />}
              {sum > 0 && (
                <path
                  d={barPath(x + (slot - barW) / 2, h - barH, barW, barH, 4)}
                  fill={isToday || hover === day ? "var(--color-brand)" : "color-mix(in oklch, var(--color-brand) 55%, transparent)"}
                />
              )}
              {isToday && (
                <circle cx={x + slot / 2} cy={h - 3} r="3" fill="var(--color-brand)" stroke="var(--color-surface)" strokeWidth="2" />
              )}
            </g>
          );
        })}
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-[10px] border border-line bg-surface px-3 py-2 text-xs shadow-pop"
          style={{ left: `${((hovered.day - 0.5) / daysInMonth) * 100}%` }}
          role="status"
        >
          <p className="text-mute">
            {hovered.day} {MONTHS_GEN[monthIndex]}
          </p>
          <p className="font-semibold">{hovered.sum ? money(hovered.sum) : "платежей нет"}</p>
        </div>
      )}
      <div className="mt-2 flex justify-between text-xs text-mute">
        {[1, 8, 15, 22, daysInMonth].map((d) => (
          <span key={d}>
            {d} {MONTHS_SHORT[monthIndex]}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Страница ───────────────────────────────────────────────────────────

export default function Home() {
  const { deals, clients, paidPayments, user } = useData();
  const d = computeDashboard(deals, clients, paidPayments);
  const today = todayIso();
  const now = new Date(`${today}T00:00:00`);

  // Какой месяц показывают график и календарь: текущий или следующий
  const [monthOffset, setMonthOffset] = useState<0 | 1>(0);
  const monthStart = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const monthIndex = monthStart.getMonth();
  const monthPrefix = iso(monthStart).slice(0, 7);
  const daysInMonth = new Date(monthStart.getFullYear(), monthIndex + 1, 0).getDate();

  const active = computeActive(deals, paidPayments);

  // Все неоплаченные взносы активных сделок — основа графика, календаря и списка
  const unpaid = active.flatMap((c) =>
    c.schedule
      .filter((p) => p.status === "due")
      .map((p) => ({ deal: c.deal, iso: p.iso, amount: p.amount }))
  );

  const monthPoints = new Map<number, number>();
  for (const p of unpaid) {
    if (p.iso.startsWith(monthPrefix)) {
      const day = Number(p.iso.slice(8));
      monthPoints.set(day, (monthPoints.get(day) ?? 0) + p.amount);
    }
  }
  const monthTotal = [...monthPoints.values()].reduce((s, v) => s + v, 0);

  // Статус каждого дня месяца для календаря: просрочено / ожидается
  const dayStatus = new Map<number, { sum: number; overdue: boolean }>();
  for (const p of unpaid) {
    if (!p.iso.startsWith(monthPrefix)) continue;
    const day = Number(p.iso.slice(8));
    const prev = dayStatus.get(day) ?? { sum: 0, overdue: false };
    dayStatus.set(day, { sum: prev.sum + p.amount, overdue: prev.overdue || p.iso < today });
  }

  const upcoming = unpaid
    .filter((p) => p.iso >= today)
    .sort((a, b) => a.iso.localeCompare(b.iso))
    .slice(0, 5);

  const week = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const key = iso(day);
    return {
      label: `${day.getDate()} ${MONTHS_GEN[day.getMonth()]}`,
      sum: unpaid.filter((p) => p.iso === key).reduce((s, p) => s + p.amount, 0),
      today: i === 0,
    };
  });
  const weekSum = week.reduce((s, x) => s + x.sum, 0);

  const totalAmount = active.reduce((s, c) => s + c.deal.amount, 0);
  const collectedPct = totalAmount
    ? Math.round((active.reduce((s, c) => s + c.paidSum, 0) / totalAmount) * 100)
    : 0;
  const overduePct = d.portfolio ? Math.round((d.overdue.sum / d.portfolio) * 100) : 0;

  const activeClientNames = [
    ...new Map(active.map((c) => [c.deal.clientId, c.deal.client])).values(),
  ];

  const leadDays = (monthStart.getDay() + 6) % 7; // неделя с понедельника
  const todayDay = monthOffset === 0 ? now.getDate() : null;

  const monthTabs = [0, 1].map((off) => {
    const m = new Date(now.getFullYear(), now.getMonth() + off, 1).getMonth();
    return { off: off as 0 | 1, label: MONTHS[m] };
  });

  return (
    <>
      <PageHeader
        title="Главная"
        subtitle="Оперативный контроль портфеля"
        searchPlaceholder="Найти клиента или сделку"
        cta="+ Добавить"
      />
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {greeting()}, {user.name.split(" ")[0]}
            </h2>
            <p className="mt-1 text-sm text-mute">
              Только цифры и дела, которые требуют решения сегодня.
            </p>
          </div>
          <span className="flex items-center gap-2 rounded-full border border-line/70 bg-surface/80 px-4 py-2 text-sm text-mute shadow-card backdrop-blur-xl">
            <CalendarDays size={15} className="text-brand" aria-hidden />
            Сегодня · {now.getDate()} {MONTHS_GEN[now.getMonth()]}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          {/* ── Левая колонка ── */}
          <div className="flex min-w-0 flex-col gap-4">
            {/* KPI с мини-графиками */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
              <Card className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-mute">К оплате сегодня</p>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand">
                    <Clock size={15} aria-hidden />
                  </span>
                </div>
                <p className="mt-2 text-[26px] font-semibold tracking-tight">{money(d.dueToday.sum)}</p>
                <div className="mt-auto flex items-end justify-between gap-3 pt-2">
                  <p className="text-xs text-mute">
                    {d.dueToday.count
                      ? `${d.dueToday.count} ${ruPlural(d.dueToday.count, "платёж", "платежа", "платежей")}`
                      : "сегодня платежей нет"}
                    <br />
                    неделя: {money(weekSum)}
                  </p>
                  <WeekBars days={week} />
                </div>
              </Card>

              <Card className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-mute">Портфель</p>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand">
                    <Briefcase size={15} aria-hidden />
                  </span>
                </div>
                <p className="mt-2 text-[26px] font-semibold tracking-tight">{money(d.portfolio)}</p>
                <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                  <p className="text-xs text-mute">
                    остаток по активным сделкам
                    <br />
                    <span className="font-medium text-good">собрано {collectedPct}%</span>
                  </p>
                  <Ring pct={collectedPct} />
                </div>
              </Card>

              <Card className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-mute">Просрочка</p>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-danger-soft text-danger">
                    <AlertCircle size={15} aria-hidden />
                  </span>
                </div>
                <p className="mt-2 text-[26px] font-semibold tracking-tight">{money(d.overdue.sum)}</p>
                <div className="mt-auto pt-2">
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className={d.overdue.count ? "text-danger" : "text-mute"}>
                      {d.overdue.count
                        ? `${d.overdue.count} ${ruPlural(d.overdue.count, "сделка", "сделки", "сделок")} ждут контакта`
                        : "просрочек нет"}
                    </span>
                    <span className="text-mute">{overduePct}% портфеля</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-danger-soft" aria-hidden>
                    <div className="h-full rounded-full bg-danger" style={{ width: `${Math.min(overduePct, 100)}%` }} />
                  </div>
                </div>
              </Card>

              <Card className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-mute">Активные клиенты</p>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-brand">
                    <Users size={15} aria-hidden />
                  </span>
                </div>
                <p className="mt-2 text-[26px] font-semibold tracking-tight">{d.activeClients}</p>
                <div className="mt-auto flex items-center justify-between gap-3 pt-2">
                  <p className="text-xs text-mute">с действующей рассрочкой</p>
                  <div className="flex -space-x-2" aria-hidden>
                    {activeClientNames.slice(0, 4).map((name) => (
                      <span
                        key={name}
                        title={name}
                        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-brand-soft text-[11px] font-semibold text-brand-deep"
                      >
                        {initials(name)}
                      </span>
                    ))}
                    {activeClientNames.length > 4 && (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-brand text-[11px] font-semibold text-on-brand">
                        +{activeClientNames.length - 4}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            {/* План поступлений */}
            <Card className="p-5 sm:p-6">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">План поступлений</h3>
                  <p className="text-sm text-mute">
                    Ожидаемые оплаты по дням · {MONTHS[monthIndex].toLowerCase()} — всего{" "}
                    <span className="font-medium text-ink">{money(monthTotal)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="flex rounded-full border border-line/70 bg-canvas p-1"
                    role="group"
                    aria-label="Месяц"
                  >
                    {monthTabs.map((t) => (
                      <button
                        key={t.off}
                        onClick={() => setMonthOffset(t.off)}
                        aria-pressed={monthOffset === t.off}
                        className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                          monthOffset === t.off ? "bg-brand text-on-brand shadow-card" : "text-mute hover:text-ink"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <Link
                    href="/analytics"
                    className="flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-deep"
                  >
                    Аналитика <ArrowRight size={15} aria-hidden />
                  </Link>
                </div>
              </div>
              {monthPoints.size === 0 ? (
                <p className="py-20 text-center text-sm text-mute">
                  На {MONTHS[monthIndex].toLowerCase()} неоплаченных взносов нет.
                </p>
              ) : (
                <div className="mt-4">
                  <InflowChart
                    points={monthPoints}
                    daysInMonth={daysInMonth}
                    monthIndex={monthIndex}
                    todayDay={todayDay}
                  />
                </div>
              )}
            </Card>

            {/* Очереди дел */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="p-5">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="font-semibold">Приоритеты</h3>
                  <Link href="/route" className="flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-deep">
                    Все <ArrowRight size={15} aria-hidden />
                  </Link>
                </div>
                <p className="mb-1 text-sm text-mute">Очередь на сегодня</p>
                {d.priorities.length === 0 ? (
                  <p className="py-6 text-sm text-mute">Срочных дел нет.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {d.priorities.map((p) => (
                      <li key={p.key} className="flex items-center gap-3 py-3">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${dotTone[p.kind]}`} aria-hidden />
                        <div className="min-w-0 flex-1">
                          <Link href={`/deals/${p.dealId}`} className="block truncate text-sm font-medium hover:text-brand-deep">
                            {p.clientName}
                          </Link>
                          <p className={`truncate text-xs ${p.kind === "overdue" ? "text-danger" : "text-mute"}`}>
                            {p.text}
                          </p>
                        </div>
                        <span className="text-sm font-semibold whitespace-nowrap">{money(p.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="p-5">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="font-semibold">Новые заявки</h3>
                  <Link href="/deals" className="flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-deep">
                    К списку <ArrowRight size={15} aria-hidden />
                  </Link>
                </div>
                <p className="mb-3 text-sm text-mute">Быстрая квалификация</p>
                {d.newRequests.length === 0 ? (
                  <p className="py-6 text-sm text-mute">Новых заявок нет — все разобраны.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {d.newRequests.map((r, i) => (
                      <li key={r.dealId}>
                        {/* Первая заявка — акцентная карточка, как «выделенный» элемент в референсах */}
                        <Link
                          href={`/deals/${r.dealId}`}
                          className={`group flex items-center gap-3 rounded-[14px] px-3.5 py-3 transition-colors ${
                            i === 0
                              ? "bg-brand text-on-brand shadow-card hover:bg-brand-deep"
                              : "bg-canvas hover:bg-brand-soft"
                          }`}
                        >
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                              i === 0 ? "bg-on-brand/20" : "bg-brand-soft text-brand-deep"
                            }`}
                          >
                            {initials(r.name)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{r.name}</p>
                            <p className={`truncate text-xs ${i === 0 ? "opacity-80" : "text-mute"}`}>{r.text}</p>
                          </div>
                          <ArrowUpRight size={16} className="shrink-0 opacity-70" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="p-5">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="font-semibold">Контроль срока</h3>
                  <Link href="/route" className="flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-deep">
                    Открыть <ArrowRight size={15} aria-hidden />
                  </Link>
                </div>
                <p className="mb-1 text-sm text-mute">Договоры с ближайшими событиями</p>
                {d.deadlines.length === 0 ? (
                  <p className="py-6 text-sm text-mute">Ближайших дедлайнов нет.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {d.deadlines.map((x) => (
                      <li key={x.dealId} className="flex items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <Link href={`/deals/${x.dealId}`} className="block truncate text-sm font-medium hover:text-brand-deep">
                            {x.title}
                          </Link>
                          <p className="truncate text-xs text-mute">{x.text}</p>
                        </div>
                        <Badge tone="red">{x.badge}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>

          {/* ── Правая панель: календарь и ближайшие оплаты ── */}
          <Card className="flex flex-col gap-5 self-start p-5 xl:sticky xl:top-5">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">
                  {MONTHS[monthIndex]} {monthStart.getFullYear()}
                </h3>
                <Link href="/payments" className="flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-deep">
                  Платежи <ArrowRight size={15} aria-hidden />
                </Link>
              </div>
              <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
                {WEEKDAYS.map((w) => (
                  <span key={w} className="pb-1 text-mute">
                    {w}
                  </span>
                ))}
                {Array.from({ length: leadDays }, (_, i) => (
                  <span key={`lead-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const status = dayStatus.get(day);
                  const isToday = todayDay === day;
                  const label = status
                    ? `${day} ${MONTHS_GEN[monthIndex]}: ${money(status.sum)}${status.overdue ? ", просрочено" : ""}`
                    : `${day} ${MONTHS_GEN[monthIndex]}`;
                  return (
                    <span key={day} className="flex justify-center">
                      <span
                        title={label}
                        aria-label={label}
                        className={`relative flex h-8 w-8 items-center justify-center rounded-full ${
                          status?.overdue
                            ? "bg-danger font-semibold text-white"
                            : status
                              ? "bg-brand font-semibold text-on-brand"
                              : isToday
                                ? "font-semibold text-brand-deep"
                                : "text-ink"
                        } ${isToday ? "ring-2 ring-brand ring-offset-2 ring-offset-surface" : ""}`}
                      >
                        {day}
                      </span>
                    </span>
                  );
                })}
              </div>
              {/* Цвет дня всегда с подписью — легенда */}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-brand" aria-hidden /> ожидается оплата
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-danger" aria-hidden /> просрочено
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full ring-2 ring-brand" aria-hidden /> сегодня
                </span>
              </div>
            </div>

            <div className="border-t border-line pt-4">
              <h3 className="mb-2 font-semibold">Ближайшие оплаты</h3>
              {upcoming.length === 0 ? (
                <p className="py-4 text-sm text-mute">Предстоящих взносов нет.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {upcoming.map((p) => {
                    const date = new Date(`${p.iso}T00:00:00`);
                    const isToday = p.iso === today;
                    return (
                      <li key={`${p.deal.id}-${p.iso}`}>
                        <Link
                          href={`/deals/${p.deal.id}`}
                          className="flex items-center gap-3 rounded-[14px] px-2 py-2 transition-colors hover:bg-canvas"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-deep">
                            {initials(p.deal.client)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{p.deal.client}</p>
                            <p className="truncate text-xs text-mute">{p.deal.product}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold whitespace-nowrap">{money(p.amount)}</p>
                            <p className={`text-xs whitespace-nowrap ${isToday ? "font-medium text-brand" : "text-mute"}`}>
                              {isToday ? "сегодня" : `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`}
                            </p>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

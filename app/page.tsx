"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  HandCoins,
  FilePlus2,
  UserPlus,
  PhoneCall,
  Plus,
  ChevronRight,
  CalendarRange,
} from "lucide-react";
import { PageHeader, Card, Badge, PillButton, TickBar } from "@/components/ui";
import NewDealModal from "@/components/new-deal-modal";
import NewClientModal from "@/components/new-client-modal";
import AcceptPaymentModal from "@/components/accept-payment-modal";
import { ruPlural, type RouteKind } from "@/lib/data";
import { money } from "@/lib/schedule";
import { useData } from "@/lib/store";
import { can } from "@/lib/permissions";
import { cashBalance } from "@/lib/cash";
import { computeActive, computeDashboard, todayIso } from "@/lib/derive";

// Главная по мотивам финансового дашборда: стопка цветных карт с балансом
// кассы, плавный график поступлений «этот год против прошлого», план
// сборов месяца делениями, ближайшие оплаты аватарами, последние платежи и
// движение денег по дням. Ниже — очереди дел на сегодня.

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

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

/** Короткая сумма для осей: 1,2 млн / 350 тыс. */
const short = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(".", ",")} млн`
    : n >= 1000
      ? `${Math.round(n / 1000)} тыс`
      : String(Math.round(n));

// Цвета аватаров — по первой букве, чтобы у клиента всегда был один цвет
const AVATAR = [
  "from-brand-hi to-brand",
  "from-orange/80 to-orange",
  "from-lilac/80 to-lilac",
  "from-good/70 to-good",
];
const avatarTone = (name: string) => AVATAR[(name.codePointAt(0) ?? 0) % AVATAR.length];

/** Плавная кривая через точки (Catmull-Rom → кубические Безье). */
function smoothPath(pts: [number, number][]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/** Путь столбика со скруглённым верхом и прямым основанием. */
function barPath(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

// ── Стопка карт ────────────────────────────────────────────────────────

function WalletCard({
  balance,
  tabs,
  activeDeals,
  monthIncomePct,
  onAdd,
}: {
  balance: number;
  tabs: { label: string; value: number; cls: string; href: string }[];
  activeDeals: number;
  monthIncomePct: number | null;
  onAdd?: () => void;
}) {
  return (
    <Card className="relative flex flex-col overflow-hidden p-3">
      <div className="flex flex-col">
        {tabs.map((t, i) => (
          <Link
            key={t.label}
            href={t.href}
            // Наведённая карточка выезжает из колоды вверх — видно, что она «достаётся»
            className={`wallet-tab flex h-[64px] items-start justify-between rounded-t-[20px] px-5 pt-3.5 text-sm font-medium text-white ${t.cls}`}
            style={{ marginTop: i === 0 ? 0 : -20, zIndex: i }}
          >
            <span>{t.label}</span>
            <span className="tabular-nums">{money(t.value)}</span>
          </Link>
        ))}
      </div>
      {/* «Кармашек» с вырезом сверху — как кошелёк в референсе */}
      <div
        className="relative z-10 -mt-6 flex flex-1 flex-col rounded-[22px] bg-surface px-5 pt-9 pb-5 shadow-[0_-8px_24px_-14px_rgb(22_24_40/0.25)]"
        style={{
          WebkitMask: "radial-gradient(circle 46px at 50% -14px, transparent 45px, #000 46px)",
          mask: "radial-gradient(circle 46px at 50% -14px, transparent 45px, #000 46px)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="rounded-full border border-line px-2.5 py-0.5 text-xs">
            {activeDeals} {ruPlural(activeDeals, "активная сделка", "активные сделки", "активных сделок")}
          </span>
          {onAdd && (
            <button
              onClick={onAdd}
              aria-label="Новая сделка"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-on-brand"
            >
              <Plus size={18} aria-hidden />
            </button>
          )}
        </div>
        <p className="mt-auto pt-4 text-sm text-mute">
          Остаток в кассе
          {monthIncomePct !== null && (
            <span className={`ml-2 font-medium ${monthIncomePct >= 0 ? "text-good" : "text-danger"}`}>
              {monthIncomePct >= 0 ? "+" : ""}
              {monthIncomePct}% за месяц
            </span>
          )}
        </p>
        <p className="mt-1 text-[28px] font-medium tracking-tight tabular-nums">{money(balance)}</p>
      </div>
    </Card>
  );
}

// ── Обзор поступлений: две плавные линии ───────────────────────────────

function OverviewChart({
  current,
  previous,
  year,
  monthsShown,
}: {
  current: number[];
  previous: number[];
  year: number;
  /** Сколько месяцев текущего года уже наступило — дальше линия не рисуется. */
  monthsShown: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 760;
  const h = 200;
  const pad = 10;
  const max = Math.max(...current, ...previous, 1) * 1.15;
  const x = (i: number) => pad + ((w - pad * 2) * i) / 11;
  const y = (v: number) => h - (v / max) * (h - 10);
  const cur = current.slice(0, monthsShown).map((v, i) => [x(i), y(v)] as [number, number]);
  const prev = previous.map((v, i) => [x(i), y(v)] as [number, number]);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);

  return (
    <div className="flex gap-2">
      <div className="flex h-[200px] flex-col-reverse justify-between pb-0 text-right text-[11px] text-mute" aria-hidden>
        {ticks.map((t) => (
          <span key={t} className="leading-none">{t ? short(t) : "0"}</span>
        ))}
      </div>
      <div className="relative min-w-0 flex-1">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
          className="h-[200px] w-full overflow-visible"
          role="img"
          aria-label={`Поступления по месяцам: ${year} год против ${year - 1}`}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="ov-cur" x1="0" x2="1">
              <stop offset="0" stopColor="var(--color-brand)" stopOpacity="0.35" />
              <stop offset="0.25" stopColor="var(--color-brand)" />
              <stop offset="1" stopColor="var(--color-brand)" />
            </linearGradient>
            <linearGradient id="ov-prev" x1="0" x2="1">
              <stop offset="0" stopColor="var(--color-orange)" stopOpacity="0.35" />
              <stop offset="0.3" stopColor="var(--color-orange)" />
              <stop offset="1" stopColor="var(--color-orange)" stopOpacity="0.25" />
            </linearGradient>
          </defs>
          <path d={smoothPath(prev)} fill="none" stroke="url(#ov-prev)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          <path d={smoothPath(cur)} fill="none" stroke="url(#ov-cur)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          {Array.from({ length: 12 }, (_, i) => (
            <rect
              key={i}
              x={x(i) - (w - pad * 2) / 22}
              y={0}
              width={(w - pad * 2) / 11}
              height={h}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          ))}
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={0} y2={h} stroke="var(--color-line)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        {/* Точки поверх SVG — чтобы не растягивались вместе с ним */}
        {hover !== null && (
          <>
            {[
              { v: previous[hover], cls: "bg-orange" },
              ...(hover < monthsShown ? [{ v: current[hover], cls: "bg-brand" }] : []),
            ].map((d, i) => (
              <span
                key={i}
                className={`pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface ${d.cls}`}
                style={{ left: `${(x(hover) / w) * 100}%`, top: y(d.v) }}
              />
            ))}
            <div
              className="pointer-events-none absolute top-0 z-10 flex -translate-x-1/2 gap-4 rounded-[14px] bg-surface px-3.5 py-2.5 text-xs shadow-pop"
              style={{ left: `${Math.min(Math.max((x(hover) / w) * 100, 14), 86)}%` }}
              role="status"
            >
              <span>
                <span className="flex items-center gap-1.5 text-mute">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" /> {MONTHS[hover]} {year}
                </span>
                <span className="mt-0.5 block font-medium">
                  {hover < monthsShown ? money(current[hover]) : "—"}
                </span>
              </span>
              <span className="border-l border-line pl-4">
                <span className="flex items-center gap-1.5 text-mute">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange" /> {year - 1}
                </span>
                <span className="mt-0.5 block font-medium">{money(previous[hover])}</span>
              </span>
            </div>
          </>
        )}
        <div className="mt-2 flex justify-between text-[11px] text-mute">
          {MONTHS_SHORT.map((m) => (
            <span key={m} className="w-0 text-center whitespace-nowrap first:text-left">
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Движение денег: столбики по дням ───────────────────────────────────

function MovementBars({ days }: { days: { iso: string; inc: number }[] }) {
  const peak = days.reduce((best, d, i) => (d.inc > days[best].inc ? i : best), 0);
  const [hover, setHover] = useState<number | null>(null);
  const sel = hover ?? peak;
  const w = 420;
  const h = 110;
  const max = Math.max(...days.map((d) => d.inc), 1);
  const slot = w / days.length;
  const bw = slot * 0.72;
  const date = new Date(`${days[sel].iso}T00:00:00`);

  return (
    <div className="relative mt-6">
      <span
        className="pointer-events-none absolute -top-5 z-10 -translate-x-1/2 rounded-full bg-surface px-2.5 py-1 text-[11px] whitespace-nowrap shadow-pop"
        style={{ left: `${((sel + 0.5) / days.length) * 100}%` }}
        role="status"
      >
        {date.getDate()} {MONTHS_GEN[date.getMonth()]} · {money(days[sel].inc)}
      </span>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-28 w-full"
        role="img"
        aria-label="Поступления по дням за две недели"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="mv-hi" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--color-brand)" />
            <stop offset="1" stopColor="var(--color-brand)" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <line x1="0" x2={w} y1={6} y2={6} stroke="var(--color-line)" strokeDasharray="3 5" />
        {days.map((d, i) => {
          const bh = Math.max((d.inc / max) * (h - 16), 10);
          return (
            <g key={d.iso} onMouseEnter={() => setHover(i)}>
              <rect x={slot * i} y={0} width={slot} height={h} fill="transparent" />
              <path
                d={barPath(slot * i + (slot - bw) / 2, h - bh, bw, bh, 8)}
                fill={i === sel ? "url(#mv-hi)" : "color-mix(in srgb, var(--color-brand) 12%, var(--color-surface))"}
              />
            </g>
          );
        })}
        <line x1="0" x2={w} y1={h - 0.5} y2={h - 0.5} stroke="color-mix(in srgb, var(--color-brand) 30%, transparent)" />
      </svg>
    </div>
  );
}

// ── Страница ───────────────────────────────────────────────────────────

export default function Home() {
  const { deals, clients, paidPayments, user, cash, cashOpeningBalance } = useData();
  const d = computeDashboard(deals, clients, paidPayments);
  const today = todayIso();
  const now = new Date(`${today}T00:00:00`);
  const monthPrefix = today.slice(0, 7);
  const [modal, setModal] = useState<"deal" | "client" | "payment" | null>(null);
  const [payDealId, setPayDealId] = useState<string | undefined>(undefined);
  const canCreate = can(user, "deals.edit");

  const active = computeActive(deals, paidPayments);
  const unpaid = active.flatMap((c) =>
    c.schedule
      .filter((p) => p.status === "due")
      .map((p) => ({ deal: c.deal, iso: p.iso, amount: p.amount }))
  );

  // Платежи клиентов из кассы (без отменённых: отмена — отдельная минусовая запись)
  const payments = cash.filter((t) => t.kind === "payment");
  const paidIn = (prefix: string) =>
    payments.filter((t) => t.date.startsWith(prefix)).reduce((s, t) => s + t.amount, 0);

  // План сборов месяца: уже собрано + ещё ожидается в этом месяце
  const collectedMonth = paidIn(monthPrefix);
  const dueMonth = unpaid.filter((p) => p.iso.startsWith(monthPrefix)).reduce((s, p) => s + p.amount, 0);
  const planMonth = collectedMonth + dueMonth;
  const planPct = planMonth ? (collectedMonth / planMonth) * 100 : 0;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  // Касса и её изменение за месяц
  const balance = cashBalance(cashOpeningBalance, cash);
  const monthNet = cash.filter((t) => t.date.startsWith(monthPrefix)).reduce((s, t) => s + t.amount, 0);
  const startBalance = balance - monthNet;
  const monthPct = startBalance > 0 ? Math.round((monthNet / startBalance) * 1000) / 10 : null;

  // Поступления по месяцам: этот и прошлый год
  const year = now.getFullYear();
  const byMonth = (y: number) =>
    Array.from({ length: 12 }, (_, m) => paidIn(`${y}-${String(m + 1).padStart(2, "0")}`));

  // Ближайшие оплаты — по одному ближайшему взносу на сделку
  const seen = new Set<string>();
  const upcoming = unpaid
    .filter((p) => p.iso >= today)
    .sort((a, b) => a.iso.localeCompare(b.iso))
    .filter((p) => (seen.has(p.deal.id) ? false : (seen.add(p.deal.id), true)))
    .slice(0, 6);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const picked = upcoming.find((p) => p.deal.id === pickedId) ?? upcoming[0];

  // Движение денег за 14 дней
  const days = Array.from({ length: 14 }, (_, i) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13 + i);
    const key = iso(day);
    return { iso: key, inc: payments.filter((t) => t.date.startsWith(key)).reduce((s, t) => s + t.amount, 0) };
  });
  const from14 = days[0].iso;
  const moneyIn = cash.filter((t) => t.date >= from14 && t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const moneyOut = cash.filter((t) => t.date >= from14 && t.amount < 0).reduce((s, t) => s - t.amount, 0);

  const recent = [...payments]
    .filter((t) => t.amount > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  const dealById = new Map(deals.map((x) => [x.id, x]));

  return (
    <>
      <PageHeader
        title={`С возвращением, ${user.name.split(" ")[0]}!`}
        subtitle={`Сегодня ${now.getDate()} ${MONTHS_GEN[now.getMonth()]} — главное по портфелю и кассе`}
        searchPlaceholder="Найти клиента или сделку"
        actions={
          canCreate && (
            <>
              <PillButton primary icon={HandCoins} onClick={() => setModal("payment")}>
                Принять платёж
              </PillButton>
              <PillButton icon={FilePlus2} onClick={() => setModal("deal")}>
                Новая сделка
              </PillButton>
              <PillButton icon={UserPlus} onClick={() => setModal("client")} className="max-sm:hidden">
                Новый клиент
              </PillButton>
              <Link
                href="/collections"
                className="flex h-10 items-center gap-2 rounded-full bg-surface px-4 text-sm font-medium shadow-card hover:text-brand-deep max-sm:hidden"
              >
                <PhoneCall size={15} aria-hidden /> Просрочки
              </Link>
            </>
          )
        }
      />

      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-8">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <WalletCard
            balance={balance}
            activeDeals={active.length}
            monthIncomePct={monthPct}
            onAdd={canCreate ? () => setModal("deal") : undefined}
            tabs={[
              { label: "Портфель", value: d.portfolio, cls: "bg-gradient-to-b from-brand-hi to-brand", href: "/deals" },
              { label: "Ждём в этом месяце", value: dueMonth, cls: "bg-gradient-to-b from-orange/85 to-orange", href: "/payments" },
              { label: "Просрочка", value: d.overdue.sum, cls: "bg-gradient-to-b from-lilac/85 to-lilac", href: "/collections" },
            ]}
          />

          <Card className="min-w-0 p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3>Поступления</h3>
                <div className="mt-1 flex gap-4 text-xs text-mute">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-brand" aria-hidden /> {year}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-orange" aria-hidden /> {year - 1}
                  </span>
                </div>
              </div>
              <Link
                href="/analytics"
                className="flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-mute hover:text-ink"
              >
                Аналитика <ChevronRight size={13} aria-hidden />
              </Link>
            </div>
            <OverviewChart current={byMonth(year)} previous={byMonth(year - 1)} year={year} monthsShown={now.getMonth() + 1} />
          </Card>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <Card className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-mute">План сборов на {MONTHS[now.getMonth()].toLowerCase()}</p>
                <p className="mt-1 text-[28px] font-medium tracking-tight tabular-nums">
                  {money(planMonth)}
                </p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-mute">
                <CalendarRange size={18} aria-hidden />
              </span>
            </div>
            <p className="mt-4 mb-2 text-sm text-mute">
              С 1 по {lastDay} {MONTHS_GEN[now.getMonth()]}
            </p>
            <TickBar pct={planPct} label="Собрано от плана месяца" />
            <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-mute">
              <span>
                Собрано <span className="font-medium text-ink">{money(collectedMonth)}</span> · {Math.round(planPct)}%
              </span>
              <span>
                Осталось собрать <span className="font-medium text-ink">{money(dueMonth)}</span>
              </span>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h3>Ближайшие оплаты</h3>
              <Link href="/payments" className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-mute hover:text-ink">
                Все платежи
              </Link>
            </div>
            {upcoming.length === 0 || !picked ? (
              <p className="py-8 text-sm text-mute">Предстоящих взносов нет.</p>
            ) : (
              <>
                <div className="mt-4 flex items-center gap-2.5 overflow-x-auto pb-1">
                  {upcoming.map((p) => {
                    const on = p.deal.id === picked.deal.id;
                    return (
                      <button
                        key={p.deal.id}
                        onClick={() => setPickedId(p.deal.id)}
                        title={p.deal.client}
                        aria-pressed={on}
                        className={`shrink-0 rounded-full p-0.5 ${on ? "ring-2 ring-brand" : ""}`}
                      >
                        <span
                          className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white ${avatarTone(p.deal.client)}`}
                        >
                          {initials(p.deal.client)}
                        </span>
                      </button>
                    );
                  })}
                  <Link
                    href="/payments"
                    aria-label="Все платежи"
                    className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-mute hover:text-ink"
                  >
                    <ChevronRight size={18} aria-hidden />
                  </Link>
                </div>
                <div className="mt-4 flex items-end justify-between gap-3 border-b border-line pb-3">
                  <div className="min-w-0">
                    <p className="text-[24px] font-medium tracking-tight tabular-nums">{money(picked.amount)}</p>
                    <p className="truncate text-xs text-mute">
                      <Link href={`/deals/${picked.deal.id}`} className="hover:text-brand-deep">
                        {picked.deal.client}
                      </Link>{" "}
                      ·{" "}
                      {picked.iso === today
                        ? "сегодня"
                        : `${Number(picked.iso.slice(8))} ${MONTHS_GEN[Number(picked.iso.slice(5, 7)) - 1]}`}
                    </p>
                  </div>
                  {canCreate && (
                    <button
                      onClick={() => {
                        setPayDealId(picked.deal.id);
                        setModal("payment");
                      }}
                      className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-on-brand"
                    >
                      Принять
                    </button>
                  )}
                </div>
              </>
            )}
          </Card>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <Card className="p-5 sm:p-6">
            <div className="mb-2 flex items-center justify-between">
              <h3>Последние платежи</h3>
              <Link href="/cash" className="text-xs font-medium text-mute hover:text-ink">
                Все
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="py-8 text-sm text-mute">Платежей пока не было.</p>
            ) : (
              <ul className="divide-y divide-line">
                {recent.map((t) => {
                  const deal = t.dealId ? dealById.get(t.dealId) : undefined;
                  const date = new Date(`${t.date.slice(0, 10)}T00:00:00`);
                  return (
                    <li key={t.id} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] items-center gap-3 py-3 text-sm sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_minmax(0,0.8fr)]">
                      <span className="truncate">{deal?.client ?? t.title}</span>
                      <span className="truncate text-mute">
                        {date.getDate()} {MONTHS_GEN[date.getMonth()]}
                      </span>
                      <span className="text-right font-medium tabular-nums">{money(t.amount)}</span>
                      <span className="truncate text-right text-mute max-sm:hidden">
                        {t.dealId ? (
                          <Link href={`/deals/${t.dealId}`} className="hover:text-brand-deep">
                            {t.dealId}
                            {t.installmentNumber ? ` · взнос ${t.installmentNumber}` : ""}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h3>Движение денег</h3>
              <span className="rounded-full border border-line px-3 py-1.5 text-xs text-mute">14 дней</span>
            </div>
            <div className="mt-3 flex justify-between text-xs text-mute">
              <span>
                Приход
                <span className="mt-0.5 block text-lg font-medium text-ink tabular-nums">{money(moneyIn)}</span>
              </span>
              <span className="text-right">
                Расход
                <span className="mt-0.5 block text-lg font-medium text-ink tabular-nums">{money(moneyOut)}</span>
              </span>
            </div>
            <MovementBars days={days} />
          </Card>
        </div>

        <div className="mt-4">
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
      </div>

      {modal === "deal" && <NewDealModal onClose={() => setModal(null)} />}
      {modal === "client" && <NewClientModal onClose={() => setModal(null)} />}
      {modal === "payment" && (
        <AcceptPaymentModal
          initialDealId={payDealId}
          onClose={() => {
            setModal(null);
            setPayDealId(undefined);
          }}
        />
      )}
    </>
  );
}

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
import { PageHeader, Card, PillButton, TickBar } from "@/components/ui";
import NewDealModal from "@/components/new-deal-modal";
import NewClientModal from "@/components/new-client-modal";
import AcceptPaymentModal from "@/components/accept-payment-modal";
import { ruPlural, type RouteKind } from "@/lib/data";
import { money } from "@/lib/schedule";
import { useData } from "@/lib/store";
import { can } from "@/lib/permissions";
import { cashBalance } from "@/lib/cash";
import { computeActive, computeDashboard, todayIso } from "@/lib/derive";

// Главная — про «сегодня»: стопка карт с балансом кассы, приоритеты дня,
// план сборов месяца делениями (подробно — Аналитика → План/факт),
// ближайшие оплаты, новые заявки и последние платежи. Годовой график
// поступлений — в Аналитике → Обзор, движение денег — в Финансах.

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

const dotTone: Record<RouteKind, string> = {
  overdue: "bg-danger",
  deadline: "bg-warn",
  review: "bg-warn",
  request: "bg-brand",
};

const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

const AVATAR = [
  "from-brand-hi to-brand",
  "from-orange/80 to-orange",
  "from-lilac/80 to-lilac",
  "from-good/70 to-good",
];
const avatarTone = (name: string) => AVATAR[(name.codePointAt(0) ?? 0) % AVATAR.length];

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
  const canPay = can(user, "payments.accept");
  const payFor = (dealId: string) => {
    setPayDealId(dealId);
    setModal("payment");
  };

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


  // Ближайшие оплаты — по одному ближайшему взносу на сделку
  const seen = new Set<string>();
  const upcoming = unpaid
    .filter((p) => p.iso >= today)
    .sort((a, b) => a.iso.localeCompare(b.iso))
    .filter((p) => (seen.has(p.deal.id) ? false : (seen.add(p.deal.id), true)))
    .slice(0, 6);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const picked = upcoming.find((p) => p.deal.id === pickedId) ?? upcoming[0];

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
          (canCreate || canPay) && (
            <>
              {canPay && (
                <PillButton primary icon={HandCoins} onClick={() => setModal("payment")}>
                  Принять платёж
                </PillButton>
              )}
              {canCreate && (
                <PillButton icon={FilePlus2} onClick={() => setModal("deal")}>
                  Новая сделка
                </PillButton>
              )}
              {can(user, "clients.edit") && (
                <PillButton icon={UserPlus} onClick={() => setModal("client")} className="max-sm:hidden">
                  Новый клиент
                </PillButton>
              )}
              <Link
                href="/collections"
                className="flex h-10 items-center gap-2 rounded-full bg-surface px-4 text-sm font-medium shadow-card hover:text-brand-deep max-sm:hidden"
              >
                <PhoneCall size={15} aria-hidden /> Работа с долгом
              </Link>
            </>
          )
        }
      />

      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-8">
        {/* Главная — про сегодня: деньги, срочные дела, ближайшие оплаты.
            Годовые графики — в Аналитике, движение денег — в Финансах */}
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
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-semibold">Приоритеты</h3>
              <Link href="/collections" className="flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-deep">
                Работа с долгом <ArrowRight size={15} aria-hidden />
              </Link>
            </div>
            <p className="mb-1 text-sm text-mute">Просрочки, сроки подписания и заявки — по срочности</p>
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
                    {/* По просрочке — сразу принять оплату, не заходя в сделку */}
                    {canPay && p.kind === "overdue" && (
                      <button
                        onClick={() => payFor(p.dealId)}
                        aria-label={`Принять платёж от ${p.clientName}`}
                        className="rounded-full bg-brand-soft px-3 py-1.5 text-xs font-medium text-brand-deep hover:bg-brand hover:text-on-brand"
                      >
                        Принять
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
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
              <Link
                href="/analytics/plan"
                aria-label="План и факт сборов по менеджерам"
                title="План/факт по менеджерам и филиалам"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-mute hover:border-brand/40 hover:text-brand-deep"
              >
                <CalendarRange size={18} aria-hidden />
              </Link>
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
                  {canPay && (
                    <button
                      onClick={() => payFor(picked.deal.id)}
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

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          <Card className="p-5 sm:p-6">
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

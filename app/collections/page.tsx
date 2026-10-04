"use client";

import { useState } from "react";
import Link from "next/link";
import { PhoneCall, PhoneOff, CalendarClock, HandCoins, CheckCircle2 } from "lucide-react";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import ContactModal from "@/components/contact-modal";
import { useData } from "@/lib/store";
import { computeActive } from "@/lib/derive";
import { todayIso } from "@/lib/status";
import { money } from "@/lib/schedule";
import { ruPlural } from "@/lib/data";
import { buildQueue, OUTCOME_LABEL, type QueueItem, type QueueState } from "@/lib/collections";

// «Просрочки» — очередь звонков на сегодня: нарушенные обещания, перезвоны
// и остальные просроченные сделки по сроку и сумме. Итог каждого звонка
// записывается (contact_log), обещание оплатить само возвращает сделку в
// очередь, если к сроку денег не было.

const STATE_META: Record<QueueState, { label: string; tone: "red" | "yellow" | "blue" | "gray" | "green" }> = {
  broken: { label: "Обещание нарушено", tone: "red" },
  callback: { label: "Перезвонить сегодня", tone: "yellow" },
  new: { label: "Позвонить", tone: "blue" },
  done: { label: "Сегодня звонили", tone: "gray" },
  waiting: { label: "Ждём", tone: "green" },
};

const shortDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

export default function CollectionsPage() {
  const { deals, paidPayments, contacts, cash, clients, employees, user } = useData();
  const today = todayIso();
  const [mine, setMine] = useState(user.role !== "admin");
  const [tab, setTab] = useState<"today" | "waiting" | "done">("today");
  const [modal, setModal] = useState<QueueItem | null>(null);

  const overdue = computeActive(deals, paidPayments)
    .filter((c) => c.deal.statusTone === "red" && (!mine || c.deal.managerId === user.id))
    .map((c) => {
      const late = c.schedule.filter((p) => p.status === "due" && p.iso < today);
      return {
        dealId: c.deal.id,
        daysLate: late[0]
          ? Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${late[0].iso}T00:00:00Z`)) / 86_400_000)
          : 0,
        overdueSum: late.reduce((s, p) => s + p.amount, 0),
      };
    });

  const payments = cash
    .filter((t) => t.kind === "payment" && t.amount > 0 && t.dealId)
    .map((t) => ({ dealId: t.dealId, date: t.date }));
  const queue = buildQueue(overdue, contacts, payments, today);

  const groups = {
    today: queue.filter((q) => q.state === "broken" || q.state === "callback" || q.state === "new"),
    waiting: queue.filter((q) => q.state === "waiting"),
    done: queue.filter((q) => q.state === "done"),
  };
  const list = groups[tab];
  const broken = queue.filter((q) => q.state === "broken").length;

  const dealOf = (id: string) => deals.find((d) => d.id === id)!;
  const phoneOf = (id: string) => clients.find((c) => c.id === dealOf(id).clientId)?.phone;
  const managerOf = (id: string) => employees.find((e) => e.id === dealOf(id).managerId)?.name;

  return (
    <>
      <PageHeader title="Просрочки" subtitle="Кому позвонить сегодня и кто что обещал" />
      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-8">
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Позвонить сегодня", value: groups.today.length, icon: PhoneCall, cls: "" },
            { label: "Нарушили обещание", value: broken, icon: PhoneOff, cls: broken ? "text-danger" : "" },
            { label: "Ждём оплату", value: groups.waiting.length, icon: HandCoins, cls: "" },
            { label: "Сегодня звонили", value: groups.done.length, icon: CheckCircle2, cls: "" },
          ].map((k) => (
            <Card key={k.label} className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-mute">{k.label}</p>
                <k.icon size={16} className="text-mute" aria-hidden />
              </div>
              <p className={`mt-1 text-2xl font-semibold tracking-tight ${k.cls}`}>{k.value}</p>
            </Card>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex gap-1 rounded-full border border-line/70 bg-surface/80 p-1 shadow-card" role="tablist">
            {(
              [
                ["today", "На сегодня"],
                ["waiting", "Ждём"],
                ["done", "Сегодня звонили"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`rounded-full px-4 py-2 text-sm font-medium ${tab === key ? "bg-brand text-on-brand" : "text-mute hover:text-ink"}`}
              >
                {label} · {groups[key].length}
              </button>
            ))}
          </div>
          {user.role === "admin" && (
            <label className="ml-auto flex items-center gap-2 text-sm text-mute">
              <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="h-4 w-4 accent-[var(--color-brand)]" />
              Только мои сделки
            </label>
          )}
        </div>

        <Card className="overflow-hidden">
          {list.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title={tab === "today" ? "На сегодня звонков нет" : "Пусто"}
              text={
                tab === "today"
                  ? "Все просрочки обработаны: по ним есть обещание, назначен звонок или уже звонили сегодня."
                  : "Здесь появятся сделки, когда по ним запишут звонок."
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {list.map((q) => {
                const deal = dealOf(q.dealId);
                const meta = STATE_META[q.state];
                const phone = phoneOf(q.dealId);
                return (
                  <li key={q.dealId} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
                    <div className="min-w-0 flex-1 basis-56">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/deals/${deal.id}`} className="font-medium hover:text-brand">
                          {deal.client}
                        </Link>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </div>
                      <p className="text-xs text-mute">
                        {deal.id} · {deal.product}
                        {managerOf(q.dealId) && ` · ${managerOf(q.dealId)}`}
                      </p>
                      {q.last && (
                        <p className="mt-1 text-xs text-mute">
                          {shortDate(q.last.at)}: {OUTCOME_LABEL[q.last.outcome].toLowerCase()}
                          {q.promise?.dueDate && ` до ${shortDate(q.promise.dueDate)}`}
                          {q.promise?.amount && `, ${money(q.promise.amount)}`}
                          {q.last.outcome === "callback" && q.last.dueDate && ` на ${shortDate(q.last.dueDate)}`}
                          {q.last.note && ` — ${q.last.note}`}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-danger tabular-nums">{money(q.overdueSum)}</p>
                      <p className="text-xs text-mute">
                        {q.daysLate} {ruPlural(q.daysLate, "день", "дня", "дней")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {phone && phone !== "—" && (
                        <a
                          href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                          aria-label={`Позвонить ${deal.client}`}
                          className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-brand hover:border-brand"
                        >
                          <PhoneCall size={16} aria-hidden />
                        </a>
                      )}
                      <button
                        onClick={() => setModal(q)}
                        className="rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-on-brand shadow-card hover:bg-brand-deep"
                      >
                        Записать звонок
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {modal && (
        <ContactModal
          dealId={modal.dealId}
          clientName={dealOf(modal.dealId).client}
          phone={phoneOf(modal.dealId)}
          overdueSum={modal.overdueSum}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

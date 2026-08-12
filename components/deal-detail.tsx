"use client";

import { useEffect, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Package,
  Phone,
  MessageCircle,
  Pencil,
  Printer,
  FileText,
  FileSpreadsheet,
  ShieldCheck,
  CalendarDays,
  Check,
  History,
  SearchX,
} from "lucide-react";
import { Card, Badge, EmptyState } from "@/components/ui";
import DealActions from "@/components/deal-actions";
import { useData, type Employee } from "@/lib/store";
import { clientById, fmt, stages, paidCount, purchasePrice, type Deal } from "@/lib/data";
import { scheduleForDeal, money, longDate, type Installment } from "@/lib/schedule";
import { dealEvents } from "@/lib/events";
import CopyLinkButton from "@/components/copy-link";
import DealPrint, { type PrintMode } from "@/components/deal-print";

function BalanceChart({ schedule, amount }: { schedule: Installment[]; amount: number }) {
  const w = 640;
  const h = 180;
  const pad = 8;
  const pts = [
    { x: pad, y: pad, paid: true, v: amount },
    ...schedule.map((p, i) => ({
      x: pad + ((i + 1) / schedule.length) * (w - pad * 2),
      y: pad + (1 - p.remaining / amount) * (h - pad * 2),
      paid: p.status === "paid",
      v: p.remaining,
    })),
  ];
  const lastPaid = schedule.filter((p) => p.status === "paid").length;
  const solid = pts.slice(0, lastPaid + 1);
  const dashed = pts.slice(Math.max(lastPaid, 0));
  const path = (arr: typeof pts) =>
    arr.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-44 w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label="Динамика остатка по сделке"
    >
      {[0.25, 0.5, 0.75].map((t) => (
        <line
          key={t}
          x1={pad}
          x2={w - pad}
          y1={pad + t * (h - pad * 2)}
          y2={pad + t * (h - pad * 2)}
          stroke="var(--color-line)"
        />
      ))}
      {solid.length > 1 && (
        <path
          d={path(solid)}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      )}
      {dashed.length > 1 && (
        <path
          d={path(dashed)}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth="2"
          strokeDasharray="2 6"
          strokeLinecap="round"
          opacity="0.7"
        />
      )}
      {pts.slice(1).map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="4"
          fill={p.paid ? "var(--color-brand)" : "var(--color-surface)"}
          stroke="var(--color-brand)"
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}

export default function DealDetail({ id }: { id: string }) {
  const {
    deals, clients, paidPayments, events, templates, employees,
    acceptPayment, sendReminder, updateDeal, restructureDeal,
  } = useData();
  const router = useRouter();
  const deal = deals.find((d) => d.id === id);
  const [printMode, setPrintMode] = useState<PrintMode | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    const reset = () => setPrintMode(null);
    window.addEventListener("afterprint", reset);
    return () => window.removeEventListener("afterprint", reset);
  }, []);

  const print = (mode: PrintMode) => {
    flushSync(() => setPrintMode(mode));
    window.print();
  };

  if (!deal) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-8">
        <Card>
          <EmptyState
            icon={SearchX}
            title="Сделка не найдена"
            text={`Сделки с номером ${id} нет в системе — возможно, её удалили или ссылка неверна.`}
            action="Ко всем сделкам"
            onAction={() => router.push("/deals")}
          />
        </Card>
      </div>
    );
  }

  const client = clientById(clients, deal.clientId);
  const paid = paidCount(deal, paidPayments);
  const schedule = scheduleForDeal(deal, paid);
  const monthly = Math.round(deal.amount / deal.months);
  const paidSum = schedule
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const remaining = deal.amount - paidSum;
  const purchase = purchasePrice(deal.amount, deal.markupPct);
  const markup = deal.amount - purchase;
  const stageTitle =
    stages.find((s) => s.key === deal.stage)?.title ??
    (deal.stage === "closed" ? "Закрыта" : "Отклонена");
  const active = deal.stage === "active";
  const finished = deal.stage === "closed" || deal.stage === "rejected";
  const openedLabel = longDate(new Date(deal.openedAt));
  const nextPayment = schedule.find((p) => p.status !== "paid");

  const history = dealEvents(events, deal.id).map((e) => ({
    date: longDate(new Date(e.date)),
    text: e.text,
  }));

  const remind = () => {
    const template = templates.find((t) => t.isDefault) ?? templates[0];
    if (!template || !client) return;

    const firstName = client.name.split(" ")[1] ?? client.name;
    const text = template.body
      .replaceAll("{имя}", firstName)
      .replaceAll("{сумма}", money(nextPayment?.amount ?? monthly))
      .replaceAll("{товар}", deal.product)
      .replaceAll("{дата}", nextPayment?.date ?? "—");

    const phone = client.phone.replace(/\D/g, "");
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
    sendReminder(deal.id).catch(() => {});
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
      {/* Хлебные крошки */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href="/deals"
          className="flex items-center gap-1.5 rounded-[10px] border border-line bg-surface px-3.5 py-2 text-sm text-mute hover:text-ink"
        >
          <ArrowLeft size={15} aria-hidden /> Все сделки
        </Link>
        <span className="text-sm text-mute">
          Сделки · {stageTitle} · {deal.id}
        </span>
      </div>

      {/* Паспорт сделки */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-brand-soft text-brand sm:flex">
              <Package size={24} aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  Сделка {deal.id}
                </h1>
                <Badge tone={deal.statusTone}>{deal.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-mute">
                {deal.product} · {fmt(deal.amount)} на {deal.months} мес ·
                заключена {openedLabel} г.
              </p>
              {deal.description && (
                <p className="mt-1.5 text-sm text-ink">{deal.description}</p>
              )}
            </div>
          </div>
          {!finished && (
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 rounded-[10px] border border-line px-4 py-2.5 text-sm font-medium text-mute hover:text-ink"
            >
              <Pencil size={15} aria-hidden /> Редактировать
            </button>
          )}
        </div>

        {/* Ключевые цифры */}
        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-5 sm:grid-cols-4">
          {[
            ["Сумма сделки", fmt(deal.amount), ""],
            ["Месячный платёж", money(monthly), ""],
            ["Оплачено", money(paidSum), "text-good"],
            ["Остаток", money(remaining), ""],
          ].map(([label, value, cls]) => (
            <div key={label}>
              <p className="text-sm text-mute">{label}</p>
              <p className={`mt-0.5 text-lg font-semibold tracking-tight ${cls}`}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Сегментный прогресс */}
        <div className="mt-5">
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-sm font-medium">
              {paid} из {deal.months} платежей
            </p>
            <p className="text-sm text-mute">
              {Math.round((paid / deal.months) * 100)}% графика
            </p>
          </div>
          <div
            className="flex gap-1"
            role="progressbar"
            aria-valuenow={paid}
            aria-valuemin={0}
            aria-valuemax={deal.months}
            aria-label="Прогресс платежей"
          >
            {schedule.map((p) => (
              <span
                key={p.n}
                className={`h-2 flex-1 rounded-full ${
                  p.status === "paid" ? "bg-brand" : "bg-line"
                }`}
              />
            ))}
          </div>
        </div>
      </Card>

      {/* Следующий шаг — только пока по сделке есть что делать */}
      {finished ? (
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-card border border-line bg-surface px-5 py-4">
          <ShieldCheck size={18} className="shrink-0 text-mute" aria-hidden />
          <p className="text-sm text-mute">
            {deal.stage === "closed"
              ? `Сделка закрыта: все ${deal.months} платежей внесены, задолженности нет.`
              : `Заявка отклонена. ${deal.nextStep}.`}
          </p>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-card border border-line bg-brand-soft px-5 py-4">
          <CalendarDays size={18} className="shrink-0 text-brand" aria-hidden />
          <div className="min-w-0 flex-1 basis-52">
            <p className="text-sm font-medium text-brand-deep">Следующий шаг</p>
            <p className="text-sm text-ink">
              {deal.urgent
                ? deal.nextStep
                : nextPayment
                  ? `Платёж ${money(nextPayment.amount)} — ${nextPayment.date} г.`
                  : deal.nextStep}
            </p>
          </div>
          <DealActions
            dealId={deal.id}
            clientName={deal.client}
            remaining={remaining}
            monthly={monthly}
            canRestructure={active}
            primaryLabel={active ? "Принять платёж" : "Продолжить работу"}
            onPrimary={active ? () => acceptPayment(deal.id) : undefined}
            onRestructure={async (input) => {
              await restructureDeal(deal.id, input);
            }}
          />
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        {/* Левая колонка */}
        <div className="flex min-w-0 flex-col gap-4">
          {/* Экономика */}
          <Card className="p-5 sm:p-6">
            <h2 className="font-semibold">Экономика сделки</h2>
            <p className="mb-3 text-sm text-mute">
              Из чего складывается итоговая сумма
            </p>
            <dl className="divide-y divide-line text-sm">
              {[
                ["Закупочная цена", money(purchase)],
                [`Наценка рассрочки · ${deal.markupPct}%`, `+${money(markup)}`],
                ["Итоговая цена для клиента", fmt(deal.amount)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-2.5">
                  <dt className="text-mute">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between py-2.5">
                <dt className="font-medium">Ваша прибыль по сделке</dt>
                <dd className="font-semibold text-good">{money(markup)}</dd>
              </div>
            </dl>
            <div className="mt-2 rounded-[10px] bg-canvas px-3.5 py-2.5 text-sm text-mute">
              Получено уже {money(Math.round((markup * paid) / deal.months))} —{" "}
              {Math.round((paid / deal.months) * 100)}% от потенциальной прибыли
            </div>
          </Card>

          {/* Динамика остатка */}
          <Card className="p-5 sm:p-6">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-semibold">Динамика остатка</h2>
              <div className="flex items-center gap-4 text-xs text-mute">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-brand" aria-hidden />
                  Оплачено
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full border-2 border-brand bg-surface"
                    aria-hidden
                  />
                  Ожидается
                </span>
              </div>
            </div>
            <p className="mb-3 text-sm text-mute">
              Как остаток уменьшается с каждым платежом
            </p>
            <BalanceChart schedule={schedule} amount={deal.amount} />
            <div className="mt-1 flex justify-between text-xs text-mute">
              <span>{schedule[0].date.replace(" г.", "")}</span>
              <span>{schedule[schedule.length - 1].date}</span>
            </div>
          </Card>

          {/* График платежей */}
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6">
              <div>
                <h2 className="font-semibold">График платежей</h2>
                <p className="text-sm text-mute">
                  {deal.months} равных платежей, ежемесячно
                </p>
              </div>
              <button
                onClick={() => acceptPayment(deal.id)}
                disabled={paid >= deal.months}
                title="Принять ближайший платёж по графику"
                className="rounded-[10px] border border-line px-3.5 py-2 text-sm font-medium text-mute transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                + Добавить платёж
              </button>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-mute">
                    <th className="px-5 py-2.5 font-medium sm:px-6">№</th>
                    <th className="px-3 py-2.5 font-medium">Дата</th>
                    <th className="px-3 py-2.5 font-medium">Сумма</th>
                    <th className="px-3 py-2.5 font-medium">Остаток после</th>
                    <th className="px-3 py-2.5 font-medium">Статус</th>
                    <th className="px-5 py-2.5 sm:px-6" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {schedule.map((p) => (
                    <tr
                      key={p.n}
                      className={p.status === "due" && p.n === paid + 1 ? "bg-brand-soft/40" : ""}
                    >
                      <td className="px-5 py-3 text-mute sm:px-6">{p.n}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{p.date} г.</td>
                      <td className="px-3 py-3 font-medium whitespace-nowrap">
                        {money(p.amount)}
                      </td>
                      <td className="px-3 py-3 text-mute whitespace-nowrap">
                        {money(p.remaining)}
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={p.status === "paid" ? "green" : "gray"}>
                          {p.status === "paid" ? "Оплачен" : "Ожидается"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right sm:px-6">
                        {p.status !== "paid" && p.n === paid + 1 && (
                          <button
                            onClick={() => acceptPayment(deal.id)}
                            className="rounded-[10px] bg-brand-soft px-3 py-1.5 text-xs font-medium text-brand-deep hover:bg-brand hover:text-white"
                          >
                            Отметить оплату
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Правая колонка */}
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Клиент</h2>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
                {deal.client
                  .split(" ")
                  .map((w) => w[0])
                  .join("")}
              </span>
              <div className="min-w-0">
                <Link
                  href={`/clients/${deal.clientId}`}
                  className="block truncate font-medium hover:text-brand-deep"
                >
                  {deal.client}
                </Link>
                <p className="flex items-center gap-1.5 text-sm text-mute">
                  <Phone size={13} aria-hidden />
                  {client?.phone ?? "+7 921 000-00-00"}
                </p>
              </div>
            </div>
            {!finished && (
              <>
                <button
                  onClick={remind}
                  disabled={templates.length === 0 || !client}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-card hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-mute disabled:shadow-none"
                >
                  <MessageCircle size={16} aria-hidden />
                  Напомнить об оплате
                </button>
                <p className="mt-2 text-center text-xs text-mute">
                  Сообщение уйдёт в WhatsApp по шаблону из «Рассылок»
                </p>
                <div className="mt-4 border-t border-line pt-4">
                  <p className="text-sm font-medium">Кабинет клиента</p>
                  <p className="mt-0.5 mb-3 text-xs text-mute">
                    Персональная страница с графиком и остатком — отправьте её
                    клиенту
                  </p>
                  <CopyLinkButton path={`/pay/${deal.portalToken}`} />
                </div>
              </>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Поручители</h2>
              <ShieldCheck size={16} className="text-mute" aria-hidden />
            </div>
            {deal.guarantors.length === 0 ? (
              <p className="text-sm text-mute">
                По этой сделке поручители не привлекались.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {deal.guarantors.map((g, i) => (
                  <li key={g.id}>
                    <Link
                      href={`/clients/${g.id}`}
                      className="flex items-center justify-between rounded-[10px] px-2 py-1.5 text-sm hover:bg-canvas"
                    >
                      <span>{g.name}</span>
                      {i === 0 && (
                        <span className="text-xs text-mute">основной</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-1 font-semibold">Условия</h2>
            <dl className="divide-y divide-line text-sm">
              {[
                ["Срок", `${deal.months} месяцев`],
                ["Интервал", "Ежемесячно"],
                ["Тип платежей", "Равные"],
                ["Первый платёж", `${schedule[0].date} г.`],
                ["Ответственный", deal.manager],
                ...(deal.category ? [["Категория", deal.category]] : []),
                ...(deal.city ? [["Город", deal.city]] : []),
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-2.5">
                  <dt className="text-mute">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Документы</h2>
            <ul className="flex flex-col gap-2">
              {[
                {
                  icon: FileText,
                  title: "Договор рассрочки",
                  text: "Условия и полный график платежей",
                  mode: "contract" as PrintMode,
                },
                {
                  icon: FileSpreadsheet,
                  title: "Сводка по сделке",
                  text: paid > 0 ? "Детали и квитанция о платеже" : "Детали для клиента",
                  mode: "summary" as PrintMode,
                },
              ].map(({ icon: Icon, title, text, mode }) => (
                <li
                  key={title}
                  className="flex items-center gap-3 rounded-[10px] border border-line px-3.5 py-2.5"
                >
                  <Icon size={17} className="shrink-0 text-brand" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{title}</p>
                    <p className="truncate text-xs text-mute">{text}</p>
                  </div>
                  <button
                    onClick={() => print(mode)}
                    aria-label={`Печать «${title}»`}
                    className="rounded-lg p-1.5 text-mute hover:bg-canvas hover:text-ink"
                  >
                    <Printer size={15} />
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">История</h2>
              <History size={16} className="text-mute" aria-hidden />
            </div>
            <ol className="flex flex-col gap-3">
              {history.map((h, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                      i === 0
                        ? "bg-brand-soft text-brand"
                        : "bg-canvas text-mute"
                    }`}
                  >
                    <Check size={11} aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{h.text}</p>
                    <p className="text-xs text-mute">{h.date} г.</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      {printMode &&
        createPortal(
          <DealPrint
            mode={printMode}
            deal={deal}
            client={client}
            schedule={schedule}
            paid={paid}
            monthly={monthly}
            paidSum={paidSum}
            remaining={remaining}
          />,
          document.body
        )}

      {editOpen && (
        <EditDealModal
          deal={deal}
          paid={paid}
          employees={employees}
          onClose={() => setEditOpen(false)}
          onSubmit={async (input) => {
            await updateDeal(deal.id, input);
            setEditOpen(false);
          }}
        />
      )}
    </div>
  );
}

const editField =
  "w-full rounded-[10px] border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:bg-surface";

function EditDealModal({
  deal,
  paid,
  employees,
  onClose,
  onSubmit,
}: {
  deal: Deal;
  paid: number;
  employees: Employee[];
  onClose: () => void;
  onSubmit: (input: {
    product: string;
    nextStep: string;
    managerId: number;
    amount?: number;
    months?: number;
    markupPct?: number;
  }) => Promise<void>;
}) {
  const locked = paid > 0;
  const [product, setProduct] = useState(deal.product);
  const [nextStep, setNextStep] = useState(deal.nextStep);
  const [managerId, setManagerId] = useState(deal.managerId ?? employees[0]?.id ?? 0);
  const [amount, setAmount] = useState(String(deal.amount));
  const [months, setMonths] = useState(String(deal.months));
  const [markupPct, setMarkupPct] = useState(String(deal.markupPct));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready =
    product.trim() !== "" &&
    managerId > 0 &&
    (locked || (Number(amount) > 0 && Number(months) > 0 && Number(markupPct) >= 0));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        product: product.trim(),
        nextStep: nextStep.trim(),
        managerId,
        ...(locked
          ? {}
          : {
              amount: Number(amount),
              months: Number(months),
              markupPct: Number(markupPct),
            }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button aria-label="Закрыть окно" className="absolute inset-0 bg-ink/35" onClick={onClose} />
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-deal-title"
        className="relative w-full max-w-md rounded-t-card bg-surface shadow-pop sm:rounded-card"
      >
        <div className="border-b border-line px-5 py-4">
          <h2 id="edit-deal-title" className="font-semibold tracking-tight">
            Редактировать сделку {deal.id}
          </h2>
          {locked && (
            <p className="mt-1 text-sm text-mute">
              По сделке уже есть принятые платежи — сумма, срок и наценка
              заблокированы
            </p>
          )}
        </div>

        <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto px-5 py-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Товар</span>
            <input className={editField} value={product} onChange={(e) => setProduct(e.target.value)} />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Ответственный</span>
            <select
              className={editField}
              value={managerId}
              onChange={(e) => setManagerId(Number(e.target.value))}
            >
              {employees.filter((e) => e.active).map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Следующий шаг</span>
            <input className={editField} value={nextStep} onChange={(e) => setNextStep(e.target.value)} />
          </label>

          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Сумма</span>
              <input
                inputMode="numeric"
                disabled={locked}
                className={`${editField} disabled:opacity-50`}
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Срок, мес</span>
              <input
                inputMode="numeric"
                disabled={locked}
                className={`${editField} disabled:opacity-50`}
                value={months}
                onChange={(e) => setMonths(e.target.value.replace(/\D/g, ""))}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Наценка, %</span>
              <input
                inputMode="decimal"
                disabled={locked}
                className={`${editField} disabled:opacity-50`}
                value={markupPct}
                onChange={(e) => setMarkupPct(e.target.value.replace(/[^\d.]/g, ""))}
              />
            </label>
          </div>
        </div>

        <footer className="flex items-center gap-3 border-t border-line px-5 py-4">
          <p className="mr-auto text-sm" role="status" aria-live="polite">
            {error ? <span className="text-danger">{error}</span> : saving ? "Сохраняем…" : ""}
          </p>
          <button type="button" onClick={onClose} className="rounded-[10px] border border-line px-4 py-2.5 text-sm font-medium text-mute hover:text-ink">
            Отмена
          </button>
          <button
            type="submit"
            disabled={!ready || saving}
            className="rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-card hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-mute disabled:shadow-none"
          >
            Сохранить
          </button>
        </footer>
      </form>
    </div>
  );
}

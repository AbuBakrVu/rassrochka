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
import { scheduleForDeal, money, longDate } from "@/lib/schedule";
import { dealEvents } from "@/lib/events";
import { reminderStageFor, pickReminderTemplate, buildReminderText } from "@/lib/reminders";
import { todayIso } from "@/lib/status";
import CopyLinkButton from "@/components/copy-link";
import DealPrint, { type PrintMode } from "@/components/deal-print";

export default function DealDetail({ id }: { id: string }) {
  const {
    deals, clients, paidPayments, events, templates, employees, user,
    acceptPayment, undoLastPayment, sendReminder, updateDeal, restructureDeal,
    closeDeal, reassignDeal, deleteDeal,
  } = useData();
  const router = useRouter();
  const deal = deals.find((d) => d.id === id);
  const [printMode, setPrintMode] = useState<PrintMode | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
  // Не amount/months «в лоб» — после реструктуризации размер взноса
  // отличается от простого среднего
  const monthly =
    schedule.find((p) => p.status !== "paid")?.amount ??
    Math.round(deal.amount / deal.months);
  const paidSum = schedule
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const remaining = deal.amount - paidSum;
  const purchase = purchasePrice(deal.amount, deal.markupPct, deal.downPayment ?? 0);
  const markup = deal.amount + (deal.downPayment ?? 0) - purchase;
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
    if (!client) return;

    // Стадия лесенки — только чтобы не показать эту же сделку повторно
    // в очереди на /mailings; при ручной отправке шаблон под стадию
    // подбирается, если он настроен, иначе — как раньше.
    const daysUntil = nextPayment
      ? Math.round(
          (Date.parse(`${nextPayment.iso}T00:00:00Z`) - Date.parse(`${todayIso()}T00:00:00Z`)) /
            86_400_000
        )
      : null;
    const stage = daysUntil !== null ? reminderStageFor(daysUntil) : null;

    const template = stage
      ? pickReminderTemplate(templates, stage, deal)
      : (deal.reminderTemplateId && templates.find((t) => t.id === deal.reminderTemplateId)) ||
        templates.find((t) => t.isDefault) ||
        templates[0];
    if (!template) return;

    const text = buildReminderText(template, {
      client,
      product: deal.product,
      amount: nextPayment?.amount ?? monthly,
      date: nextPayment?.date ?? "—",
    });

    const phone = client.phone.replace(/\D/g, "");
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
    sendReminder(
      deal.id,
      stage && nextPayment ? { stage, dueDate: nextPayment.iso } : undefined
    ).catch(() => {});
  };

  const undoPayment = async () => {
    if (!confirm(`Отменить последний принятый платёж по сделке ${deal.id}?`)) return;
    setUndoing(true);
    try {
      await undoLastPayment(deal.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось отменить платёж");
    } finally {
      setUndoing(false);
    }
  };

  const removeDeal = async () => {
    if (!confirm(`Удалить сделку ${deal.id}? Действие необратимо.`)) return;
    setDeleting(true);
    try {
      await deleteDeal(deal.id);
      router.push("/deals");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось удалить сделку");
      setDeleting(false);
    }
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
            onCloseEarly={active ? async () => { await closeDeal(deal.id); } : undefined}
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
                ["Итоговая цена для клиента", fmt(deal.amount + (deal.downPayment ?? 0))],
                ...(deal.downPayment
                  ? [
                      ["Первоначальный взнос", `−${money(deal.downPayment)}`],
                      ["Сумма в рассрочку", fmt(deal.amount)],
                    ]
                  : []),
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
                        {user.role === "admin" && p.status === "paid" && p.n === paid && (
                          <button
                            onClick={undoPayment}
                            disabled={undoing}
                            title="Отменить этот платёж — например, если приняли по ошибке"
                            className="rounded-[10px] border border-line px-3 py-1.5 text-xs font-medium text-mute hover:border-danger/40 hover:text-danger disabled:opacity-50"
                          >
                            Отменить
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
                {templates.length > 1 && (
                  <label className="mt-2 block">
                    <span className="mb-1 block text-xs text-mute">Шаблон для этой сделки</span>
                    <select
                      value={deal.reminderTemplateId ?? ""}
                      onChange={async (e) => {
                        const value = e.target.value || null;
                        await updateDeal(deal.id, {
                          product: deal.product,
                          nextStep: deal.nextStep,
                          managerId: deal.managerId!,
                          reminderTemplateId: value,
                        });
                      }}
                      className="w-full rounded-[8px] border border-line bg-canvas px-2.5 py-1.5 text-xs outline-none focus:border-brand"
                    >
                      <option value="">Общий по умолчанию</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </label>
                )}
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
                ["Первоначальный взнос", deal.downPayment ? money(deal.downPayment) : "Без взноса"],
                ...(deal.category ? [["Категория", deal.category]] : []),
                ...(deal.city ? [["Город", deal.city]] : []),
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-2.5">
                  <dt className="text-mute">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-mute">Ответственный</dt>
                <dd className="font-medium">
                  {user.role === "admin" ? (
                    <select
                      value={deal.managerId ?? ""}
                      disabled={reassigning}
                      onChange={async (e) => {
                        const id = Number(e.target.value);
                        if (!id) return;
                        setReassigning(true);
                        try {
                          await reassignDeal(deal.id, id);
                        } catch (err) {
                          alert(err instanceof Error ? err.message : "Не удалось сменить ответственного");
                        } finally {
                          setReassigning(false);
                        }
                      }}
                      className="rounded-[8px] border border-line bg-canvas px-2 py-1 text-sm outline-none focus:border-brand"
                    >
                      {employees.filter((e) => e.active).map((e) => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  ) : (
                    deal.manager
                  )}
                </dd>
              </div>
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

      {user.role === "admin" && paid === 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-danger-soft bg-danger-soft/30 px-5 py-4">
          <div>
            <p className="text-sm font-medium text-danger">Удалить сделку</p>
            <p className="text-sm text-mute">
              Можно удалить, пока по сделке нет ни одного платежа — например,
              если завели по ошибке. Действие необратимо.
            </p>
          </div>
          <button
            onClick={removeDeal}
            disabled={deleting}
            className="rounded-[10px] border border-danger/40 px-4 py-2.5 text-sm font-medium text-danger hover:bg-danger hover:text-white disabled:opacity-50"
          >
            Удалить сделку
          </button>
        </div>
      )}

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

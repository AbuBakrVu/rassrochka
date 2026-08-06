import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Package,
  Phone,
  MessageCircle,
  Pencil,
  Download,
  FileText,
  FileSpreadsheet,
  ShieldCheck,
  CalendarDays,
  Check,
  History,
} from "lucide-react";
import { Card, Badge } from "@/components/ui";
import {
  deals,
  clientById,
  fmt,
  stages,
  paidCount,
  tokenByDeal,
} from "@/lib/data";
import {
  buildSchedule,
  money,
  longDate,
  type Installment,
} from "@/lib/schedule";
import CopyLinkButton from "@/components/copy-link";

export function generateStaticParams() {
  return deals.map((d) => ({ id: d.id }));
}

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

export default async function DealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deal = deals.find((d) => d.id === id);
  if (!deal) notFound();

  const client = clientById(deal.clientId);
  const paid = paidCount(deal);
  const schedule = buildSchedule(
    deal.amount,
    deal.months,
    paid,
    deal.openedAt
  );
  const monthly = Math.round(deal.amount / deal.months);
  const paidSum = schedule
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const remaining = deal.amount - paidSum;
  const markup = Math.round(deal.amount * 0.15);
  const purchase = deal.amount - markup;
  const stageTitle =
    stages.find((s) => s.key === deal.stage)?.title ??
    (deal.stage === "closed" ? "Закрыта" : "Отклонена");
  const active = deal.stage === "active";
  const finished = deal.stage === "closed" || deal.stage === "rejected";
  const openedLabel = longDate(new Date(deal.openedAt));
  const nextPayment = schedule.find((p) => p.status !== "paid");

  const history = [
    ...(paid > 0
      ? [
          {
            date: schedule[paid - 1].date,
            text: `Платёж ${paid} из ${deal.months} — ${money(schedule[paid - 1].amount)}`,
          },
        ]
      : []),
    ...(active
      ? [{ date: openedLabel, text: "Сделка переведена в «Активна»" }]
      : []),
    { date: openedLabel, text: "Сделка создана" },
  ];

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
            </div>
          </div>
          <button className="flex items-center gap-1.5 rounded-[10px] border border-line px-4 py-2.5 text-sm font-medium text-mute hover:text-ink">
            <Pencil size={15} aria-hidden /> Редактировать
          </button>
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
          <button className="flex items-center gap-1.5 rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-card hover:bg-brand-deep">
            {active ? "Принять платёж" : "Продолжить работу"}
            <ArrowRight size={15} aria-hidden />
          </button>
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
                ["Наценка рассрочки · 15%", `+${money(markup)}`],
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
              <button className="rounded-[10px] border border-line px-3.5 py-2 text-sm font-medium text-mute hover:text-ink">
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
                          <button className="rounded-[10px] bg-brand-soft px-3 py-1.5 text-xs font-medium text-brand-deep hover:bg-brand hover:text-white">
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
                <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-card hover:bg-brand-deep">
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
                  <CopyLinkButton path={`/pay/${tokenByDeal(deal.id)}`} />
                </div>
              </>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Поручители</h2>
              <ShieldCheck size={16} className="text-mute" aria-hidden />
            </div>
            <p className="text-sm text-mute">
              По этой сделке поручители не привлекались. Добавить можно при
              редактировании сделки.
            </p>
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
                  text: "Условия и график платежей",
                },
                {
                  icon: FileSpreadsheet,
                  title: "Сводка по сделке",
                  text: "Детали для клиента",
                },
              ].map(({ icon: Icon, title, text }) => (
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
                    aria-label={`Скачать «${title}»`}
                    className="rounded-lg p-1.5 text-mute hover:bg-canvas hover:text-ink"
                  >
                    <Download size={15} />
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
    </div>
  );
}

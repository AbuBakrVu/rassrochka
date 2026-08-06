import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  CalendarDays,
  MessageCircle,
  Wallet,
  Link2,
} from "lucide-react";
import { Card, Badge } from "@/components/ui";
import ClientDeals, { type DealCardData } from "@/components/client-deals";
import CopyLinkButton from "@/components/copy-link";
import {
  clients,
  clientById,
  dealsOfClient,
  dealState,
  paidCount,
  tokenByDeal,
  type Client,
} from "@/lib/data";
import { buildSchedule, money, longDate } from "@/lib/schedule";

export function generateStaticParams() {
  return clients.map((c) => ({ id: c.id }));
}

const statusTone: Record<Client["status"], "green" | "red" | "gray" | "blue"> = {
  active: "green",
  overdue: "red",
  closed: "gray",
  lead: "blue",
};

const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("");

export default async function ClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = clientById(id);
  if (!client) notFound();

  const clientDeals = dealsOfClient(client.id);

  // Считаем графики один раз и используем для карточек, сводки и истории
  const computed = clientDeals.map((deal) => {
    const paid = paidCount(deal);
    const schedule = buildSchedule(
      deal.amount,
      deal.months,
      paid,
      deal.openedAt
    );
    const paidSum = schedule
      .filter((p) => p.status === "paid")
      .reduce((s, p) => s + p.amount, 0);
    const next = schedule.find((p) => p.status === "due");
    return { deal, paid, schedule, paidSum, next };
  });

  const cards: DealCardData[] = computed.map(({ deal, paid, paidSum, next }) => ({
    id: deal.id,
    product: deal.product,
    amount: deal.amount,
    months: deal.months,
    state: dealState(deal),
    status: deal.status,
    statusTone: deal.statusTone,
    paid,
    remaining: deal.amount - paidSum,
    monthly: Math.round(deal.amount / deal.months),
    nextDate: next?.date ?? null,
    openedLabel: `с ${longDate(new Date(deal.openedAt))}`,
    nextStep: deal.nextStep,
    urgent: deal.urgent,
    manager: deal.manager,
  }));

  const activeDeals = computed.filter(({ deal }) => dealState(deal) === "active");
  const portfolio = activeDeals.reduce(
    (s, { deal, paidSum }) => s + (deal.amount - paidSum),
    0
  );
  const paidTotal = computed.reduce((s, c) => s + c.paidSum, 0);
  const closedCount = computed.filter(
    ({ deal }) => dealState(deal) === "closed"
  ).length;

  // История платежей — все оплаченные взносы по всем сделкам, свежие сверху
  const history = computed
    .flatMap(({ deal, schedule }) =>
      schedule
        .filter((p) => p.status === "paid")
        .map((p) => ({ ...p, dealId: deal.id, product: deal.product }))
    )
    .sort((a, b) => b.iso.localeCompare(a.iso))
    .slice(0, 8);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
      {/* Хлебные крошки */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href="/clients"
          className="flex items-center gap-1.5 rounded-[10px] border border-line bg-surface px-3.5 py-2 text-sm text-mute hover:text-ink"
        >
          <ArrowLeft size={15} aria-hidden /> Все клиенты
        </Link>
        <span className="text-sm text-mute">
          Клиенты · {client.name} · {client.id}
        </span>
      </div>

      {/* Паспорт клиента */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-semibold text-white">
              {initials(client.name)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  {client.name}
                </h1>
                <Badge tone={statusTone[client.status]}>
                  {client.statusLabel}
                </Badge>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-mute">
                <span className="flex items-center gap-1.5">
                  <Phone size={13} aria-hidden /> {client.phone}
                </span>
                <span className="flex items-center gap-1.5">
                  <Mail size={13} aria-hidden /> {client.email}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin size={13} aria-hidden /> {client.city}
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays size={13} aria-hidden /> клиент с{" "}
                  {client.since}
                </span>
              </div>
            </div>
          </div>
          <button className="flex items-center gap-2 rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-card hover:bg-brand-deep">
            <MessageCircle size={16} aria-hidden />
            Написать клиенту
          </button>
        </div>

        {/* Ключевые цифры */}
        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-5 sm:grid-cols-4">
          {[
            ["Остаток по рассрочкам", money(portfolio), ""],
            ["Выплачено всего", money(paidTotal), "text-good"],
            ["Активных сделок", String(activeDeals.length), ""],
            ["Закрытых сделок", String(closedCount), ""],
          ].map(([label, value, cls]) => (
            <div key={label}>
              <p className="text-sm text-mute">{label}</p>
              <p
                className={`mt-0.5 text-lg font-semibold tracking-tight ${cls}`}
              >
                {value}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Ближайшее действие */}
      {client.nextAction !== "—" && (
        <div
          className={`mt-4 flex flex-wrap items-center gap-4 rounded-card border px-5 py-4 ${
            client.status === "overdue"
              ? "border-danger-soft bg-danger-soft"
              : "border-line bg-brand-soft"
          }`}
        >
          <CalendarDays
            size={18}
            className={`shrink-0 ${
              client.status === "overdue" ? "text-danger" : "text-brand"
            }`}
            aria-hidden
          />
          <div className="min-w-0 flex-1 basis-52">
            <p
              className={`text-sm font-medium ${
                client.status === "overdue" ? "text-danger" : "text-brand-deep"
              }`}
            >
              Ближайшее действие · {client.nextDate}
            </p>
            <p className="text-sm text-ink">{client.nextAction}</p>
          </div>
          <button className="rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-card hover:bg-brand-deep">
            Выполнить
          </button>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        {/* Сделки с фильтрами */}
        <div className="min-w-0">
          <ClientDeals deals={cards} />
        </div>

        {/* Правая колонка */}
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <h2 className="mb-1 font-semibold">История платежей</h2>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-mute">
                Платежей пока не было — они появятся после первой оплаты.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {history.map((h) => (
                  <li
                    key={`${h.dealId}-${h.n}`}
                    className="flex items-center gap-3 py-2.5"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-good-soft text-good">
                      <Wallet size={15} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{h.date}</p>
                      <p className="truncate text-xs text-mute">
                        {h.dealId} · платёж {h.n}
                      </p>
                    </div>
                    <span className="text-sm font-semibold whitespace-nowrap">
                      {money(h.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-1 flex items-center gap-2">
              <Link2 size={16} className="text-brand" aria-hidden />
              <h2 className="font-semibold">Кабинет клиента</h2>
            </div>
            {activeDeals.length === 0 ? (
              <p className="mt-2 text-sm text-mute">
                Ссылка появится, когда у клиента будет активная рассрочка.
              </p>
            ) : (
              <>
                <p className="mb-3 text-sm text-mute">
                  Персональная страница с графиком и остатком — по одной на
                  каждую активную сделку.
                </p>
                <div className="flex flex-col gap-3">
                  {activeDeals.map(({ deal }) => (
                    <div key={deal.id}>
                      <p className="mb-1.5 truncate text-sm font-medium">
                        {deal.id} · {deal.product}
                      </p>
                      <CopyLinkButton path={`/pay/${tokenByDeal(deal.id)}`} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-1 font-semibold">Реквизиты</h2>
            <dl className="divide-y divide-line text-sm">
              {[
                ["Идентификатор", client.id],
                ["Телефон", client.phone],
                ["Почта", client.email],
                ["Город", client.city],
                ["Клиент с", client.since],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <dt className="text-mute">{k}</dt>
                  <dd className="truncate font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}

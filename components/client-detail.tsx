"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  CalendarDays,
  MessageCircle,
  Wallet,
  Link2,
  ShieldAlert,
  ShieldOff,
  SearchX,
} from "lucide-react";
import { Card, Badge, EmptyState } from "@/components/ui";
import ClientDeals, { type DealCardData } from "@/components/client-deals";
import CopyLinkButton from "@/components/copy-link";
import { ClientCreditCard } from "@/components/client-credit";
import { useData } from "@/lib/store";
import {
  clientById,
  dealsOfClient,
  dealState,
  paidCount,
  type Client,
} from "@/lib/data";
import { scheduleForDeal, money, longDate } from "@/lib/schedule";

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

export default function ClientDetail({ id }: { id: string }) {
  const { clients, deals, paidPayments, setClientBlacklisted } = useData();
  const router = useRouter();
  const client = clientById(clients, id);
  const [blacklistOpen, setBlacklistOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const removeFromBlacklist = async () => {
    if (!client || !confirm(`Убрать ${client.name} из чёрного списка?`)) return;
    setBusy(true);
    try {
      await setClientBlacklisted(client.id, false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось убрать из списка");
    } finally {
      setBusy(false);
    }
  };

  if (!client) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-8">
        <Card>
          <EmptyState
            icon={SearchX}
            title="Клиент не найден"
            text={`Клиента с номером ${id} нет в системе — возможно, его удалили или ссылка неверна.`}
            action="Ко всем клиентам"
            onAction={() => router.push("/clients")}
          />
        </Card>
      </div>
    );
  }

  const clientDeals = dealsOfClient(deals, client.id);

  // Считаем графики один раз и используем для карточек, сводки и истории
  const computed = clientDeals.map((deal) => {
    const paid = paidCount(deal, paidPayments);
    const schedule = scheduleForDeal(deal, paid);
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
    // next?.amount, а не amount/months «в лоб» — после реструктуризации
    // размер взноса отличается от простого среднего
    monthly: next?.amount ?? Math.round(deal.amount / deal.months),
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
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-semibold text-on-brand">
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
                {client.blacklistedAt && (
                  <Badge tone="red">В чёрном списке</Badge>
                )}
              </div>
              {client.blacklistedAt && client.blacklistReason && (
                <p className="mt-1 text-sm text-danger">{client.blacklistReason}</p>
              )}
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
          <div className="flex shrink-0 items-center gap-2">
            {client.blacklistedAt ? (
              <button
                onClick={removeFromBlacklist}
                disabled={busy}
                className="flex items-center gap-2 rounded-[10px] border border-line px-4 py-2.5 text-sm font-medium text-mute transition-colors hover:border-good/40 hover:text-good disabled:opacity-50"
              >
                <ShieldOff size={16} aria-hidden />
                Убрать из ЧС
              </button>
            ) : (
              <button
                onClick={() => setBlacklistOpen(true)}
                className="flex items-center gap-2 rounded-[10px] border border-line px-4 py-2.5 text-sm font-medium text-mute transition-colors hover:border-danger/40 hover:text-danger"
              >
                <ShieldAlert size={16} aria-hidden />
                В чёрный список
              </button>
            )}
            <button
              onClick={() =>
                window.open(
                  `https://wa.me/${client.phone.replace(/\D/g, "")}`,
                  "_blank",
                  "noopener,noreferrer"
                )
              }
              className="flex items-center gap-2 rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-on-brand shadow-card hover:bg-brand-deep"
            >
              <MessageCircle size={16} aria-hidden />
              Написать клиенту
            </button>
          </div>
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
          {client.nextDealId && (
            <button
              onClick={() => router.push(`/deals/${client.nextDealId}`)}
              className="rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-on-brand shadow-card hover:bg-brand-deep"
            >
              Выполнить
            </button>
          )}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        {/* Сделки с фильтрами */}
        <div className="min-w-0">
          <ClientDeals deals={cards} />
        </div>

        {/* Правая колонка */}
        <div className="flex flex-col gap-4">
          <ClientCreditCard client={client} />

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
            {activeDeals.length === 0 && closedCount === 0 ? (
              <p className="mt-2 text-sm text-mute">
                Ссылка появится, когда у клиента будет хотя бы одна сделка.
              </p>
            ) : (
              <>
                <p className="mb-3 text-sm text-mute">
                  Одна персональная ссылка на все сделки клиента — новую заводить
                  не нужно, она сама покажет актуальный список.
                </p>
                <CopyLinkButton path={`/pay/${client.portalToken}`} />
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
                ...(client.birthDate ? [["Дата рождения", client.birthDate]] : []),
                ...(client.passportSeries || client.passportNumber
                  ? [["Паспорт", `${client.passportSeries ?? ""} ${client.passportNumber ?? ""}`.trim()]]
                  : []),
                ...(client.passportIssuedBy ? [["Кем выдан", client.passportIssuedBy]] : []),
                ...(client.passportIssuedAt ? [["Когда выдан", client.passportIssuedAt]] : []),
                ...(client.registrationAddress
                  ? [["Адрес прописки", client.registrationAddress]]
                  : []),
                ...(client.livingAddress ? [["Адрес проживания", client.livingAddress]] : []),
                ...(client.inn ? [["ИНН", client.inn]] : []),
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

      {blacklistOpen && (
        <BlacklistModal
          clientName={client.name}
          onClose={() => setBlacklistOpen(false)}
          onSubmit={async (reason) => {
            await setClientBlacklisted(client.id, true, reason);
            setBlacklistOpen(false);
          }}
        />
      )}
    </div>
  );
}

function BlacklistModal({
  clientName,
  onClose,
  onSubmit,
}: {
  clientName: string;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit(reason.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button aria-label="Закрыть окно" className="absolute inset-0 bg-scrim" onClick={onClose} />
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="blacklist-title"
        className="relative w-full max-w-md rounded-t-card bg-surface shadow-pop sm:rounded-card"
      >
        <div className="border-b border-line px-5 py-4">
          <h2 id="blacklist-title" className="font-semibold tracking-tight">
            Добавить в чёрный список
          </h2>
          <p className="text-sm text-mute">{clientName}</p>
        </div>

        <div className="px-5 py-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">
              Причина (необязательно)
            </span>
            <textarea
              className="min-h-24 w-full resize-y rounded-[10px] border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:bg-surface"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Например: не платит третий месяц подряд"
              autoFocus
            />
          </label>
          <p className="mt-2 text-xs text-mute">
            Клиент останется в системе — просто менеджер увидит предупреждение
            при создании новой сделки с ним.
          </p>
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
            disabled={saving}
            className="rounded-[10px] bg-danger px-4 py-2.5 text-sm font-medium text-white shadow-card hover:opacity-90 disabled:cursor-not-allowed disabled:bg-line disabled:text-mute disabled:shadow-none"
          >
            Добавить в список
          </button>
        </footer>
      </form>
    </div>
  );
}

"use client";

import { BrandMark, useBrandName } from "@/components/branding";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  Phone,
  MessageCircle,
  CalendarDays,
  CalendarPlus,
  SearchX,
  ChevronDown,
  ReceiptText,
} from "lucide-react";
import { fmt } from "@/lib/data";
import { scheduleForDeal, longDate, money, type Installment } from "@/lib/schedule";
import { paymentTitle, receiptPath, type PaymentKind } from "@/lib/receipts";
import { todayIso } from "@/lib/status";

// Кабинет намеренно НЕ пользуется общим стором: заёмщик открывает страницу
// по ссылке без авторизации, и useData() отдал бы ему в браузер все сделки
// и всех клиентов компании. Здесь приходит только то, что относится к нему.
interface PortalPayment {
  id: string;
  kind: PaymentKind;
  installment?: number;
  date: string;
  amount: number;
}

interface PortalDealShape {
  id: string;
  payments: PortalPayment[];
  product: string;
  amount: number;
  months: number;
  openedAt: string;
  paid: number;
  originalMonths?: number;
  restructuredMonths?: number;
  restructuredFrom?: string;
}

// Токен сделки (старые ссылки, разосланные до появления клиентского токена)
interface SingleDealResponse extends PortalDealShape {
  kind: "deal";
  clientFirstName: string;
  managerName: string;
  managerPhone: string | null;
}

// Токен клиента — одна ссылка на все его активные и закрытые сделки
interface ClientResponse {
  kind: "client";
  clientFirstName: string;
  managerName: string;
  managerPhone: string | null;
  deals: (PortalDealShape & { stage: "active" | "closed" | string })[];
}

type PortalResponse = SingleDealResponse | ClientResponse;

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="flex max-w-sm flex-col items-center rounded-card border border-line bg-surface p-8 text-center shadow-card">
        {children}
      </div>
    </div>
  );
}

function Header({ subtitle, id }: { subtitle: string; id?: string }) {
  const brandName = useBrandName();
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <BrandMark className="h-10 w-10 rounded-[12px]" iconSize={17} />
        <div>
          <p className="text-sm font-semibold tracking-tight">{brandName}</p>
          <p className="text-xs text-mute">{subtitle}</p>
        </div>
      </div>
      {id && (
        <span className="rounded-lg bg-surface px-2.5 py-1 text-xs text-mute">{id}</span>
      )}
    </header>
  );
}

const DAY_MS = 86_400_000;

function ruDays(n: number) {
  const last = n % 10;
  if (n % 100 >= 11 && n % 100 <= 14) return `${n} дней`;
  if (last === 1) return `${n} день`;
  if (last >= 2 && last <= 4) return `${n} дня`;
  return `${n} дней`;
}

/** «Сегодня» / «Через 3 дня» / «Просрочен на 2 дня» — от даты взноса до сегодня. */
function dueLabel(iso: string): { text: string; overdue: boolean } {
  const days = Math.round(
    (Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${todayIso()}T00:00:00Z`)) / DAY_MS
  );
  if (days < 0) return { text: `Просрочен на ${ruDays(-days)}`, overdue: true };
  if (days === 0) return { text: "Сегодня", overdue: false };
  if (days === 1) return { text: "Завтра", overdue: false };
  return { text: `Через ${ruDays(days)}`, overdue: false };
}

/**
 * Главный вопрос клиента — «сколько и когда платить» — крупно, первым
 * экраном. Плюс кнопка, которая добавит все будущие платежи в календарь
 * телефона с напоминанием накануне.
 */
function NextPaymentHero({
  token,
  next,
  product,
}: {
  token: string;
  next: Installment;
  product?: string;
}) {
  const due = dueLabel(next.iso);

  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-mute">Следующий платёж</p>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            due.overdue ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand-deep"
          }`}
        >
          {due.text}
        </span>
      </div>
      <p className="mt-1 text-[32px] font-semibold tracking-tight">{money(next.amount)}</p>
      <p className="text-sm text-mute">
        до {next.date} г.{product ? ` · ${product}` : ""}
      </p>
      <a
        href={`/api/portal/${encodeURIComponent(token)}/calendar`}
        className="mt-4 flex items-center justify-center gap-2 rounded-[10px] border border-line px-3 py-2.5 text-sm font-medium hover:border-brand hover:text-brand-deep"
      >
        <CalendarPlus size={15} aria-hidden /> Добавить платежи в календарь
      </a>
    </section>
  );
}

/** Реально поступившие платежи со ссылкой на квитанцию по каждому. */
function PaymentHistory({
  token,
  deal,
}: {
  token: string;
  deal: PortalDealShape;
}) {
  if (deal.payments.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <h2 className="px-5 pt-4 pb-2 font-semibold">История платежей</h2>
      <ul className="divide-y divide-line">
        {[...deal.payments].reverse().map((p) => (
          <li key={p.id}>
            <Link
              href={receiptPath(token, p.id)}
              className="flex items-center gap-3 px-5 py-3 hover:bg-canvas"
            >
              <ReceiptText size={16} className="shrink-0 text-brand" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {paymentTitle(p.kind, p.installment, deal.months)}
                </p>
                <p className="text-xs text-mute">
                  {longDate(new Date(p.date))} г. · квитанция
                </p>
              </div>
              <span className="text-sm font-semibold whitespace-nowrap">{money(p.amount)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ContactSection({
  managerName,
  managerPhone,
}: {
  managerName: string;
  managerPhone: string | null;
}) {
  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card">
      <p className="text-sm font-medium">Вопрос по рассрочке?</p>
      <p className="mt-0.5 text-sm text-mute">
        {managerPhone
          ? `Напишите или позвоните ${managerName} — ответит в рабочее время.`
          : "Обратитесь к вашему менеджеру — контакт уточните у него."}
      </p>
      {managerPhone && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a
            href={`tel:${managerPhone.replace(/\D/g, "")}`}
            className="flex items-center justify-center gap-2 rounded-[10px] border border-line px-3 py-2.5 text-sm font-medium hover:border-brand hover:text-brand-deep"
          >
            <Phone size={15} aria-hidden /> Позвонить
          </a>
          <a
            href={`https://wa.me/${managerPhone.replace(/\D/g, "")}`}
            className="flex items-center justify-center gap-2 rounded-[10px] bg-brand px-3 py-2.5 text-sm font-medium text-on-brand hover:bg-brand-deep"
          >
            <MessageCircle size={15} aria-hidden /> Написать
          </a>
        </div>
      )}
    </section>
  );
}

/** Полный график одной сделки — общий для одиночного и клиентского режима. */
function DealSchedule({
  deal,
  token,
  showNext = true,
}: {
  deal: PortalDealShape;
  token: string;
  showNext?: boolean;
}) {
  const schedule = scheduleForDeal(deal, deal.paid);
  const next = schedule.find((p) => p.status === "due");

  return (
    <>
      {showNext && next && (
        <section className="flex items-center gap-3 rounded-card border border-line bg-brand-soft px-5 py-4">
          <CalendarDays size={18} className="shrink-0 text-brand" aria-hidden />
          <div>
            <p className="text-sm font-medium text-brand-deep">Ближайший платёж</p>
            <p className="text-sm">
              {money(next.amount)} — {next.date} г.
            </p>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <h2 className="px-5 pt-4 pb-2 font-semibold">График платежей</h2>
        <ol className="divide-y divide-line">
          {schedule.map((p) => {
            const isNext = next?.n === p.n;
            return (
              <li
                key={p.n}
                className={`flex items-center gap-3 px-5 py-3 ${isNext ? "bg-brand-soft/40" : ""}`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    p.status === "paid"
                      ? "bg-brand text-on-brand"
                      : isNext
                        ? "bg-brand-soft text-brand-deep"
                        : "bg-canvas text-mute"
                  }`}
                >
                  {p.status === "paid" ? <Check size={13} aria-hidden /> : p.n}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{p.date} г.</p>
                  <p className="text-xs text-mute">
                    {p.status === "paid"
                      ? "Оплачен"
                      : isNext
                        ? "Ближайший платёж"
                        : `Остаток после — ${money(p.remaining)}`}
                  </p>
                </div>
                <span className={`text-sm font-semibold whitespace-nowrap ${p.status === "paid" ? "text-mute" : ""}`}>
                  {money(p.amount)}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <PaymentHistory token={token} deal={deal} />
    </>
  );
}

function SingleDealView({ data, token }: { data: SingleDealResponse; token: string }) {
  const schedule = scheduleForDeal(data, data.paid);
  const paidSum = schedule.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const remaining = data.amount - paidSum;
  const next = schedule.find((p) => p.status === "due");

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6 sm:py-10">
      <Header subtitle="Моя рассрочка" id={data.id} />

      {next && <NextPaymentHero token={token} next={next} />}

      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <p className="text-sm text-mute">{data.clientFirstName}, ваш остаток по рассрочке</p>
        <p className="mt-1 text-[32px] font-semibold tracking-tight">{money(remaining)}</p>
        <p className="text-sm text-mute">
          из {fmt(data.amount)} · выплачено {money(paidSum)}
        </p>
        <div className="mt-4">
          <div className="mb-1.5 flex items-baseline justify-between text-sm">
            <span className="font-medium">
              {data.paid} из {data.months} платежей
            </span>
            <span className="text-mute">{Math.round((data.paid / data.months) * 100)}%</span>
          </div>
          <div className="flex gap-1" role="progressbar" aria-valuenow={data.paid} aria-valuemin={0} aria-valuemax={data.months} aria-label="Прогресс выплат">
            {schedule.map((p) => (
              <span key={p.n} className={`h-2 flex-1 rounded-full ${p.status === "paid" ? "bg-brand" : "bg-line"}`} />
            ))}
          </div>
        </div>
      </section>

      <DealSchedule deal={data} token={token} showNext={false} />
      <ContactSection managerName={data.managerName} managerPhone={data.managerPhone} />

      <p className="text-center text-xs text-mute">
        Ссылка персональная — не передавайте её другим. Данные на {longDate(new Date())} г.
      </p>
    </div>
  );
}

function DealCard({
  deal,
  token,
  showNext = true,
}: {
  deal: ClientResponse["deals"][number];
  token: string;
  showNext?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const schedule = scheduleForDeal(deal, deal.paid);
  const paidSum = schedule.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const remaining = deal.amount - paidSum;
  const next = schedule.find((p) => p.status === "due");

  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{deal.product}</p>
            {deal.stage === "closed" && (
              <span className="shrink-0 rounded-full bg-good-soft px-2 py-0.5 text-xs font-medium text-good">
                Выплачена
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-mute">
            {deal.id} ·{" "}
            {deal.stage === "closed"
              ? `выплачено ${money(deal.amount)}`
              : next
                ? `остаток ${money(remaining)} · платёж ${next.date} г.`
                : `остаток ${money(remaining)}`}
          </p>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-mute transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t border-line bg-canvas p-3">
          <DealSchedule deal={deal} token={token} showNext={showNext} />
        </div>
      )}
    </section>
  );
}

function ClientView({ data, token }: { data: ClientResponse; token: string }) {
  const active = data.deals.filter((d) => d.stage === "active");
  const closed = data.deals.filter((d) => d.stage !== "active");

  // Ближайший платёж среди всех активных сделок — его клиент видит первым
  const nearest = active
    .map((deal) => ({
      deal,
      next: scheduleForDeal(deal, deal.paid).find((p) => p.status === "due"),
    }))
    .filter((x): x is { deal: typeof x.deal; next: Installment } => !!x.next)
    .sort((a, b) => (a.next.iso < b.next.iso ? -1 : a.next.iso > b.next.iso ? 1 : 0))[0];

  const remaining = active.reduce((sum, deal) => {
    const schedule = scheduleForDeal(deal, deal.paid);
    const paidSum = schedule.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
    return sum + (deal.amount - paidSum);
  }, 0);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6 sm:py-10">
      <Header subtitle="Мои рассрочки" />

      {nearest && (
        <NextPaymentHero
          token={token}
          next={nearest.next}
          product={active.length > 1 ? nearest.deal.product : undefined}
        />
      )}

      {active.length > 0 && (
        <section className="rounded-card border border-line bg-surface p-5 shadow-card">
          <p className="text-sm text-mute">{data.clientFirstName}, общий остаток по всем рассрочкам</p>
          <p className="mt-1 text-[32px] font-semibold tracking-tight">{money(remaining)}</p>
          <p className="text-sm text-mute">
            {active.length} {active.length === 1 ? "активная сделка" : "активных сделки"}
          </p>
        </section>
      )}

      {active.length > 0 && (
        <div className="flex flex-col gap-3">
          {active.map((deal) => (
            // Одна активная сделка — её ближайший платёж уже крупно наверху
            <DealCard key={deal.id} deal={deal} token={token} showNext={active.length > 1} />
          ))}
        </div>
      )}

      {closed.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-mute">Закрытые сделки</p>
          {closed.map((deal) => (
            <DealCard key={deal.id} deal={deal} token={token} />
          ))}
        </div>
      )}

      <ContactSection managerName={data.managerName} managerPhone={data.managerPhone} />

      <p className="text-center text-xs text-mute">
        Ссылка персональная — не передавайте её другим. Данные на {longDate(new Date())} г.
      </p>
    </div>
  );
}

export default function ClientPortal({ token }: { token: string }) {
  const [data, setData] = useState<PortalResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "failed">("loading");

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/portal/${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) return setState("missing");
        if (!res.ok) return setState("failed");
        setData(await res.json());
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("failed");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === "loading") {
    return (
      <Centered>
        <div className="h-11 w-11 animate-pulse rounded-full bg-brand-soft" />
        <div className="mt-3 h-4 w-32 animate-pulse rounded bg-line" />
      </Centered>
    );
  }

  if (state === "failed") {
    return (
      <Centered>
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-danger-soft text-danger">
          <SearchX size={20} aria-hidden />
        </span>
        <p className="font-medium">Не удалось загрузить</p>
        <p className="mt-1 text-sm text-mute">Проверьте соединение и обновите страницу.</p>
      </Centered>
    );
  }

  if (state === "missing" || !data) {
    return (
      <Centered>
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand">
          <SearchX size={20} aria-hidden />
        </span>
        <p className="font-medium">Ссылка недействительна</p>
        <p className="mt-1 text-sm text-mute">
          Такой рассрочки нет в системе — уточните ссылку у менеджера.
        </p>
      </Centered>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      {data.kind === "client" ? (
        <ClientView data={data} token={token} />
      ) : (
        <SingleDealView data={data} token={token} />
      )}
    </div>
  );
}

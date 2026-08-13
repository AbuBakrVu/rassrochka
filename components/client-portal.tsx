"use client";

import { useEffect, useState } from "react";
import { Zap, Check, Phone, MessageCircle, CalendarDays, SearchX, ChevronDown } from "lucide-react";
import { fmt } from "@/lib/data";
import { scheduleForDeal, longDate, money } from "@/lib/schedule";

// Кабинет намеренно НЕ пользуется общим стором: заёмщик открывает страницу
// по ссылке без авторизации, и useData() отдал бы ему в браузер все сделки
// и всех клиентов компании. Здесь приходит только то, что относится к нему.
interface PortalDealShape {
  id: string;
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
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand text-white">
          <Zap size={17} aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold tracking-tight">Nasiya</p>
          <p className="text-xs text-mute">{subtitle}</p>
        </div>
      </div>
      {id && (
        <span className="rounded-lg bg-surface px-2.5 py-1 text-xs text-mute">{id}</span>
      )}
    </header>
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
            className="flex items-center justify-center gap-2 rounded-[10px] bg-brand px-3 py-2.5 text-sm font-medium text-white hover:bg-brand-deep"
          >
            <MessageCircle size={15} aria-hidden /> Написать
          </a>
        </div>
      )}
    </section>
  );
}

/** Полный график одной сделки — общий для одиночного и клиентского режима. */
function DealSchedule({ deal }: { deal: PortalDealShape }) {
  const schedule = scheduleForDeal(deal, deal.paid);
  const next = schedule.find((p) => p.status === "due");

  return (
    <>
      {next && (
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
                      ? "bg-brand text-white"
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
    </>
  );
}

function SingleDealView({ data }: { data: SingleDealResponse }) {
  const schedule = scheduleForDeal(data, data.paid);
  const paidSum = schedule.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const remaining = data.amount - paidSum;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6 sm:py-10">
      <Header subtitle="Моя рассрочка" id={data.id} />

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

      <DealSchedule deal={data} />
      <ContactSection managerName={data.managerName} managerPhone={data.managerPhone} />

      <p className="text-center text-xs text-mute">
        Ссылка персональная — не передавайте её другим. Данные на {longDate(new Date())} г.
      </p>
    </div>
  );
}

function DealCard({ deal }: { deal: ClientResponse["deals"][number] }) {
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
          <DealSchedule deal={deal} />
        </div>
      )}
    </section>
  );
}

function ClientView({ data }: { data: ClientResponse }) {
  const active = data.deals.filter((d) => d.stage === "active");
  const closed = data.deals.filter((d) => d.stage !== "active");

  const remaining = active.reduce((sum, deal) => {
    const schedule = scheduleForDeal(deal, deal.paid);
    const paidSum = schedule.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
    return sum + (deal.amount - paidSum);
  }, 0);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6 sm:py-10">
      <Header subtitle="Мои рассрочки" />

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
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      )}

      {closed.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-mute">Закрытые сделки</p>
          {closed.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
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
      {data.kind === "client" ? <ClientView data={data} /> : <SingleDealView data={data} />}
    </div>
  );
}

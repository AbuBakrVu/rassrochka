import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Zap, Check, Phone, MessageCircle, CalendarDays } from "lucide-react";
import { deals, clients, paidPayments, clientTokens, fmt } from "@/lib/data";
import { buildSchedule, money } from "@/lib/schedule";

export function generateStaticParams() {
  return Object.keys(clientTokens).map((token) => ({ token }));
}

export const metadata: Metadata = {
  title: "Моя рассрочка — Финора",
  description: "График платежей и остаток по рассрочке",
};

export default async function ClientPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const dealId = clientTokens[token];
  const deal = deals.find((d) => d.id === dealId);
  if (!deal) notFound();

  const client = clients.find((c) => c.name === deal.client);
  const firstName = deal.client.split(" ")[0];
  const paid = paidPayments[deal.id] ?? 0;
  const schedule = buildSchedule(deal.amount, deal.months, paid);
  const paidSum = schedule
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const remaining = deal.amount - paidSum;
  const next = schedule.find((p) => p.status === "due");

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6 sm:py-10">
        {/* Шапка */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand text-white">
              <Zap size={17} aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight">Финора</p>
              <p className="text-xs text-mute">Моя рассрочка</p>
            </div>
          </div>
          <span className="rounded-lg bg-surface px-2.5 py-1 text-xs text-mute">
            {deal.id}
          </span>
        </header>

        {/* Остаток */}
        <section className="rounded-card border border-line bg-surface p-5 shadow-card">
          <p className="text-sm text-mute">
            {firstName}, ваш остаток по рассрочке
          </p>
          <p className="mt-1 text-[32px] font-semibold tracking-tight">
            {money(remaining)}
          </p>
          <p className="text-sm text-mute">
            из {fmt(deal.amount)} · выплачено {money(paidSum)}
          </p>
          <div className="mt-4">
            <div className="mb-1.5 flex items-baseline justify-between text-sm">
              <span className="font-medium">
                {paid} из {deal.months} платежей
              </span>
              <span className="text-mute">
                {Math.round((paid / deal.months) * 100)}%
              </span>
            </div>
            <div
              className="flex gap-1"
              role="progressbar"
              aria-valuenow={paid}
              aria-valuemin={0}
              aria-valuemax={deal.months}
              aria-label="Прогресс выплат"
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
        </section>

        {/* Ближайший платёж */}
        {next && (
          <section className="flex items-center gap-3 rounded-card border border-line bg-brand-soft px-5 py-4">
            <CalendarDays size={18} className="shrink-0 text-brand" aria-hidden />
            <div>
              <p className="text-sm font-medium text-brand-deep">
                Ближайший платёж
              </p>
              <p className="text-sm">
                {money(next.amount)} — {next.date} г.
              </p>
            </div>
          </section>
        )}

        {/* График */}
        <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
          <h2 className="px-5 pt-4 pb-2 font-semibold">График платежей</h2>
          <ol className="divide-y divide-line">
            {schedule.map((p) => {
              const isNext = next?.n === p.n;
              return (
                <li
                  key={p.n}
                  className={`flex items-center gap-3 px-5 py-3 ${
                    isNext ? "bg-brand-soft/40" : ""
                  }`}
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
                  <span
                    className={`text-sm font-semibold whitespace-nowrap ${
                      p.status === "paid" ? "text-mute" : ""
                    }`}
                  >
                    {money(p.amount)}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Связь */}
        <section className="rounded-card border border-line bg-surface p-5 shadow-card">
          <p className="text-sm font-medium">Вопрос по рассрочке?</p>
          <p className="mt-0.5 text-sm text-mute">
            Напишите или позвоните — ответим в рабочее время.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a
              href="tel:+79210000000"
              className="flex items-center justify-center gap-2 rounded-[10px] border border-line px-3 py-2.5 text-sm font-medium hover:border-brand hover:text-brand-deep"
            >
              <Phone size={15} aria-hidden /> Позвонить
            </a>
            <a
              href="https://wa.me/79210000000"
              className="flex items-center justify-center gap-2 rounded-[10px] bg-brand px-3 py-2.5 text-sm font-medium text-white hover:bg-brand-deep"
            >
              <MessageCircle size={15} aria-hidden /> Написать
            </a>
          </div>
        </section>

        <p className="text-center text-xs text-mute">
          Ссылка персональная — не передавайте её другим.
          {client ? ` Данные на 5 августа 2026 г.` : ""}
        </p>
      </div>
    </div>
  );
}

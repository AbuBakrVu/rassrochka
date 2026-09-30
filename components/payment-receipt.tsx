"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Printer, SearchX, Zap } from "lucide-react";
import { longDate, money } from "@/lib/schedule";
import {
  PAYMENT_METHOD_TITLE,
  paymentTitle,
  receiptNumber,
  type PaymentKind,
} from "@/lib/receipts";

// Квитанция о платеже по ссылке из кабинета или из WhatsApp. Как и кабинет,
// не пользуется общим стором CRM — приходит только этот один платёж.
interface Receipt {
  id: string;
  companyName: string;
  payerName: string;
  dealId: string;
  product: string;
  kind: PaymentKind;
  installment?: number;
  months: number;
  date: string;
  amount: number;
  method: "cash" | "card" | "transfer" | null;
  remainingAfter: number;
  managerName: string;
}

export default function PaymentReceipt({ token, id }: { token: string; id: string }) {
  const [data, setData] = useState<Receipt | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "failed">("loading");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/portal/${encodeURIComponent(token)}/receipt/${encodeURIComponent(id)}`)
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
  }, [token, id]);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="h-11 w-11 animate-pulse rounded-full bg-brand-soft" />
      </div>
    );
  }

  if (state !== "ready" || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="flex max-w-sm flex-col items-center rounded-card border border-line bg-surface p-8 text-center shadow-card">
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand">
            <SearchX size={20} aria-hidden />
          </span>
          <p className="font-medium">
            {state === "failed" ? "Не удалось загрузить" : "Квитанция не найдена"}
          </p>
          <p className="mt-1 text-sm text-mute">
            {state === "failed"
              ? "Проверьте соединение и обновите страницу."
              : "Возможно, платёж был отменён — уточните у менеджера."}
          </p>
        </div>
      </div>
    );
  }

  const title = paymentTitle(data.kind, data.installment, data.months);
  const rows: [string, string][] = [
    ["Плательщик", data.payerName],
    ["Договор", `№ ${data.dealId}`],
    ["Товар", data.product],
    ["Назначение", title],
    ["Дата платежа", `${longDate(new Date(data.date))} г.`],
    ...(data.method ? [["Способ оплаты", PAYMENT_METHOD_TITLE[data.method]] as [string, string]] : []),
    ["Остаток долга после платежа", money(data.remainingAfter)],
    ["Принял", data.managerName],
  ];

  return (
    <div className="min-h-screen bg-canvas print:bg-white">
      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6 sm:py-10 print:max-w-none print:p-0">
        <div className="flex items-center justify-between print:hidden">
          <Link
            href={`/pay/${token}`}
            className="flex items-center gap-1.5 text-sm text-mute hover:text-ink"
          >
            <ArrowLeft size={15} aria-hidden /> Мои рассрочки
          </Link>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-[10px] border border-line bg-surface px-3.5 py-2 text-sm font-medium hover:border-brand hover:text-brand-deep"
          >
            <Printer size={15} aria-hidden /> Сохранить PDF
          </button>
        </div>

        <article className="rounded-card border border-line bg-surface p-6 shadow-card print:border-black/20 print:shadow-none">
          <header className="flex items-start justify-between gap-3 border-b border-line pb-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand text-white print:hidden">
                <Zap size={17} aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold tracking-tight">{data.companyName}</p>
                <p className="text-xs text-mute">Квитанция об оплате</p>
              </div>
            </div>
            <p className="text-right text-xs text-mute">
              № {receiptNumber(data.dealId, data.id)}
            </p>
          </header>

          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle2 size={28} className="text-good" aria-hidden />
            <p className="mt-2 text-sm text-mute">Платёж получен</p>
            <p className="mt-1 text-[32px] font-semibold tracking-tight">{money(data.amount)}</p>
          </div>

          <dl className="divide-y divide-line border-t border-line text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-4 py-2.5">
                <dt className="text-mute">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </article>

        <p className="text-center text-xs text-mute">
          Квитанция сформирована автоматически и подтверждает получение платежа
          по договору рассрочки.
        </p>
      </div>
    </div>
  );
}

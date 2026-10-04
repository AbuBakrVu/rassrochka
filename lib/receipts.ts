// Квитанции о платежах: подписи и ссылки, общие для CRM и кабинета клиента.
// Данные самой квитанции собирает сервер (loadPortalReceipt в lib/queries.ts).

import { money } from "./schedule";

export type PaymentKind = "installment" | "partial" | "down" | "payoff";

export const PAYMENT_METHOD_TITLE: Record<"cash" | "card" | "transfer", string> = {
  cash: "Наличные",
  card: "Банковская карта",
  transfer: "Перевод",
};

export function paymentTitle(kind: PaymentKind, installment: number | undefined, months: number) {
  if (kind === "down") return "Первоначальный взнос";
  if (kind === "payoff") return "Досрочное погашение остатка";
  if (kind === "partial") return `Часть взноса ${installment} из ${months}`;
  return `Взнос ${installment} из ${months}`;
}

/** Номер квитанции для человека: сделка + номер операции в кассе. */
export const receiptNumber = (dealId: string, paymentId: string) => `${dealId}-${paymentId}`;

export const receiptPath = (portalToken: string, paymentId: string) =>
  `/pay/${portalToken}/receipt/${paymentId}`;

/** Текст сообщения клиенту в WhatsApp со ссылкой на квитанцию. */
export function receiptMessage(input: {
  clientName: string;
  product: string;
  amount: number;
  title: string;
  url: string;
}) {
  const firstName = input.clientName.split(" ")[1] ?? input.clientName;
  return (
    `${firstName}, здравствуйте! Платёж ${money(input.amount)} по рассрочке «${input.product}» ` +
    `получен (${input.title.toLowerCase()}). Спасибо!\n\nКвитанция: ${input.url}`
  );
}

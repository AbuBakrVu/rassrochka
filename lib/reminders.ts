// Автоматическая лесенка напоминаний: считает, какой сделке пора напомнить
// об оплате и каким тоном — WhatsApp Business API у компании нет, поэтому
// отправка всё равно остаётся ручным кликом (см. app/api/deals/[id]/remind),
// а не фоновой рассылкой. Эта логика только решает «кому и что» показать
// в очереди на /mailings.

import type { Deal, Client, ReminderStage } from "./data";
import type { MessageTemplate } from "./store";
import { scheduleForDeal, money } from "./schedule";

const DAY_MS = 86_400_000;

/** Стадия по числу дней до ближайшего взноса (отрицательное — просрочка). null — напоминание сейчас не нужно. */
export function reminderStageFor(daysUntilDue: number): ReminderStage | null {
  if (daysUntilDue >= 1 && daysUntilDue <= 3) return "before";
  if (daysUntilDue === 0) return "due";
  if (daysUntilDue <= -1 && daysUntilDue >= -3) return "overdue_soft";
  if (daysUntilDue <= -4) return "overdue_hard";
  return null;
}

export function pickReminderTemplate(
  templates: MessageTemplate[],
  stage: ReminderStage,
  deal: Deal
): MessageTemplate | undefined {
  return (
    templates.find((t) => t.stage === stage) ??
    (deal.reminderTemplateId
      ? templates.find((t) => t.id === deal.reminderTemplateId)
      : undefined) ??
    templates.find((t) => t.isDefault) ??
    templates[0]
  );
}

export function buildReminderText(
  template: MessageTemplate,
  input: { client: Client; product: string; amount: number; date: string }
): string {
  const firstName = input.client.name.split(" ")[1] ?? input.client.name;
  return template.body
    .replaceAll("{имя}", firstName)
    .replaceAll("{сумма}", money(input.amount))
    .replaceAll("{товар}", input.product)
    .replaceAll("{дата}", input.date);
}

export interface ReminderQueueItem {
  dealId: string;
  clientId: string;
  clientName: string;
  phone: string;
  product: string;
  stage: ReminderStage;
  dueIso: string;
  dueLabel: string;
  amount: number;
  text: string;
}

const STAGE_ORDER: Record<ReminderStage, number> = {
  overdue_hard: 0,
  overdue_soft: 1,
  due: 2,
  before: 3,
};

/** Сделки, которым пора напомнить об оплате сегодня — уже отсортированы от самых срочных. */
export function computeReminderQueue(
  deals: Deal[],
  clients: Client[],
  paidPayments: Record<string, number>,
  templates: MessageTemplate[],
  today: string
): ReminderQueueItem[] {
  const items: ReminderQueueItem[] = [];

  for (const deal of deals) {
    if (deal.stage !== "active") continue;
    const client = clients.find((c) => c.id === deal.clientId);
    if (!client) continue;

    const schedule = scheduleForDeal(deal, paidPayments[deal.id] ?? 0);
    const next = schedule.find((p) => p.status === "due");
    if (!next) continue;

    const daysUntil = Math.round(
      (Date.parse(`${next.iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS
    );
    const stage = reminderStageFor(daysUntil);
    if (!stage) continue;

    // Эту стадию по этому же взносу уже напомнили — не дублируем
    if (deal.lastReminderStage === stage && deal.lastReminderDueDate === next.iso) continue;

    const template = pickReminderTemplate(templates, stage, deal);
    if (!template) continue;

    items.push({
      dealId: deal.id,
      clientId: client.id,
      clientName: client.name,
      phone: client.phone,
      product: deal.product,
      stage,
      dueIso: next.iso,
      dueLabel: next.date,
      amount: next.amount,
      text: buildReminderText(template, {
        client,
        product: deal.product,
        amount: next.amount,
        date: next.date,
      }),
    });
  }

  return items.sort((a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage]);
}

"use client";

// Очередь WhatsApp-напоминаний на сегодня — вкладка «Напоминания» в разделе
// «Работа с долгом». Лесенка (lib/reminders.ts) сама решает, кому и каким
// тоном пора напомнить; менеджер жмёт «Отправить», WhatsApp открывается с
// готовым текстом. Шаблоны — Настройки → Шаблоны сообщений.

import { useState } from "react";
import Link from "next/link";
import { Send, Bell } from "lucide-react";
import { Card, Badge, EmptyState } from "@/components/ui";
import { useData } from "@/lib/store";
import { REMINDER_STAGE_LABEL, type ReminderStage } from "@/lib/data";
import { computeReminderQueue, type ReminderQueueItem } from "@/lib/reminders";
import { todayIso } from "@/lib/status";

const STAGE_TONE: Record<ReminderStage, "blue" | "yellow" | "red"> = {
  before: "blue",
  due: "yellow",
  overdue_soft: "yellow",
  overdue_hard: "red",
};

export default function ReminderQueue({ mine }: { mine: boolean }) {
  const { deals, clients, paidPayments, templates, sendReminder, user } = useData();
  const [sendingKey, setSendingKey] = useState<string | null>(null);

  const queue = computeReminderQueue(
    mine ? deals.filter((d) => d.managerId === user.id) : deals,
    clients, paidPayments, templates, todayIso()
  );
  if (queue.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Bell}
          title="Напоминать сегодня некому"
          text="Лесенка напоминает за 1–3 дня до платежа, в день платежа и при просрочке. Каждый взнос — не больше одного раза на стадию."
        />
      </Card>
    );
  }

  const send = async (item: ReminderQueueItem) => {
    const key = item.dealId + item.stage;
    setSendingKey(key);
    const phone = item.phone.replace(/\D/g, "");
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(item.text)}`,
      "_blank",
      "noopener,noreferrer"
    );
    try {
      await sendReminder(item.dealId, { stage: item.stage, dueDate: item.dueIso });
    } catch {
      // окно WhatsApp уже открылось — тут только не даём кнопке зависнуть
    } finally {
      setSendingKey(null);
    }
  };

  return (
    <Card className="p-5">
      <div className="mb-1 flex items-center gap-2">
        <Bell size={16} className="text-brand" aria-hidden />
        <h2 className="font-semibold tracking-tight">Очередь напоминаний на сегодня</h2>
        <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-mute">
          {queue.length}
        </span>
      </div>
      <p className="mb-3 text-sm text-mute">
        Лесенка сама решает, кому пора напомнить и каким тоном — нажмите
        «Отправить», WhatsApp откроется с готовым сообщением. Тексты —{" "}
        <Link href="/settings?tab=templates" className="text-brand hover:text-brand-deep">
          Настройки → Шаблоны сообщений
        </Link>
        .
      </p>
      <div className="flex flex-col divide-y divide-line">
        {queue.map((item) => (
          <div
            key={item.dealId + item.stage}
            className="flex flex-wrap items-center justify-between gap-3 py-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge tone={STAGE_TONE[item.stage]}>{REMINDER_STAGE_LABEL[item.stage]}</Badge>
                <p className="truncate font-medium">{item.clientName}</p>
              </div>
              <p className="mt-1 truncate text-sm text-mute">
                {item.product} · {item.dueLabel} · {item.dealId}
              </p>
            </div>
            <button
              onClick={() => send(item)}
              disabled={sendingKey === item.dealId + item.stage}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-3.5 py-2 text-sm font-medium text-on-brand shadow-card hover:bg-brand-deep disabled:opacity-50"
            >
              <Send size={14} aria-hidden />
              Отправить
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}
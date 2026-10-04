// Вычисление статусов, которые раньше хранились полями мока.
//
// В прототипе Deal.status/statusTone/urgent и Client.status/statusLabel были
// просто записаны в lib/data.ts руками — из-за этого просрочку нельзя было
// посчитать, и computeAging приходилось опираться на цвет бейджа вместо дат
// (см. PROGRESS_PRO.md §5). Теперь это одна функция на всё приложение.

import { ruPlural, type Client, type Deal, type DealStage } from "./data";
import { buildSchedule, type ScheduleShape } from "./schedule";

const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Дата в формате ГГГГ-ММ-ДД по МЕСТНОМУ времени. Не toISOString(): тот
 * всегда в UTC, и с полуночи до 03:00 по Москве (во Владивостоке — до
 * 10:00) «сегодня» оказывалось вчерашним днём — сдвигались просрочки и
 * дата платежа. В браузере местное время — сотрудника, на сервере —
 * часового пояса компании (TZ в .env, см. docker-compose.yml).
 */
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayIso = () => isoDate(new Date());

/** Сколько дней просрочен ближайший неоплаченный взнос. 0 — просрочки нет. */
export function daysOverdue(
  input: {
    stage: DealStage;
    amount: number;
    months: number;
    paid: number;
    openedAt: string;
    restructure?: ScheduleShape;
  },
  today = todayIso()
): number {
  if (input.stage !== "active") return 0;

  const schedule = buildSchedule(
    input.amount,
    input.months,
    input.paid,
    input.openedAt,
    input.restructure
  );
  const next = schedule.find((p) => p.status === "due");
  if (!next) return 0;

  const diff = Math.floor(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${next.iso}T00:00:00Z`)) /
      DAY_MS
  );
  return diff > 0 ? diff : 0;
}

const STAGE_LABEL: Record<DealStage, string> = {
  new: "Новая",
  check: "Проверка",
  signing: "Подписание",
  active: "В графике",
  closed: "Закрыта",
  rejected: "Отклонена",
};

export interface DealStatus {
  status: string;
  statusTone: Deal["statusTone"];
  urgent: boolean;
}

export function computeDealStatus(
  input: {
    stage: DealStage;
    amount: number;
    months: number;
    paid: number;
    openedAt: string;
    deadline?: string | null;
    restructure?: ScheduleShape;
  },
  today = todayIso()
): DealStatus {
  const overdue = daysOverdue(input, today);

  // Дедлайн наступил или прошёл — сделку пора двигать руками
  const deadlineUrgent =
    !!input.deadline &&
    (input.stage === "signing" || input.stage === "check") &&
    input.deadline <= today;

  if (input.stage === "active") {
    if (overdue > 0) {
      return {
        status: `Просрочка ${overdue} ${ruPlural(overdue, "день", "дня", "дней")}`,
        statusTone: "red",
        urgent: true,
      };
    }
    return { status: STAGE_LABEL.active, statusTone: "green", urgent: false };
  }

  const tone: Deal["statusTone"] =
    input.stage === "rejected"
      ? "red"
      : input.stage === "closed"
        ? "gray"
        : input.stage === "check"
          ? "yellow"
          : "blue";

  return {
    status: STAGE_LABEL[input.stage],
    statusTone: tone,
    urgent: deadlineUrgent,
  };
}

// ── Статус клиента ─────────────────────────────────────────────────────
// Выводится из его сделок: раньше был отдельным полем, которое никто не
// пересчитывал при изменении сделок.

export interface ClientStatus {
  status: Client["status"];
  statusLabel: string;
}

export function computeClientStatus(deals: Deal[]): ClientStatus {
  if (deals.length === 0) {
    return { status: "lead", statusLabel: "Новая заявка" };
  }

  const overdue = deals.find(
    (d) => d.stage === "active" && d.statusTone === "red"
  );
  if (overdue) return { status: "overdue", statusLabel: overdue.status };

  if (deals.some((d) => d.stage === "active")) {
    return { status: "active", statusLabel: "В графике" };
  }

  // Заявка в работе: показываем этап самой продвинутой из них
  const pendingOrder: DealStage[] = ["signing", "check", "new"];
  for (const stage of pendingOrder) {
    if (deals.some((d) => d.stage === stage)) {
      return { status: "lead", statusLabel: STAGE_LABEL[stage] };
    }
  }

  if (deals.some((d) => d.stage === "closed")) {
    return { status: "closed", statusLabel: "Закрыта" };
  }
  return { status: "lead", statusLabel: "Отклонена" };
}

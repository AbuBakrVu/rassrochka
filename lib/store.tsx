"use client";

// Клиентский стор всего приложения. Бэкенда нет — источник правды это
// состояние в браузере, сохранённое в localStorage. Стартовые значения
// берутся из lib/data.ts (seedDeals/seedClients/seedPaidPayments), дальше
// всё живёт здесь: создание сделки/клиента, приём платежа.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  seedDeals,
  seedClients,
  seedPaidPayments,
  type Deal,
  type Client,
} from "./data";
import { buildSchedule, monthNames, money } from "./schedule";
import { buildSeedCash, purchasePrice } from "./cash";
import { buildSeedEvents, type DealEvent } from "./events";

const STORAGE_KEY = "finora-store-v3";

// Касса: стартовый остаток и лента операций. Закупка товара списывает
// деньги, платёж клиента возвращает — так виден реальный оборот.
export const CASH_OPENING_BALANCE = 1_240_000;

export type CashKind = "purchase" | "payment" | "adjustment";

export interface CashTx {
  id: string;
  kind: CashKind;
  amount: number; // отрицательная — расход, положительная — приход
  date: string; // ISO
  dealId?: string;
  title: string;
  note?: string;
}

interface StoredShape {
  deals: Deal[];
  clients: Client[];
  paidPayments: Record<string, number>;
  cash: CashTx[];
  events: DealEvent[];
}

// Ширина номера сохраняем как у самого длинного существующего id
// (клиенты C-101 → C-116, сделки R-0988 → R-1055), без лишних нулей.
function nextId(prefix: string, existing: string[]) {
  let max = 0;
  let width = 0;
  for (const id of existing) {
    const digits = id.replace(prefix, "");
    const n = parseInt(digits, 10);
    if (Number.isFinite(n)) {
      max = Math.max(max, n);
      width = Math.max(width, digits.length);
    }
  }
  return `${prefix}${String(max + 1).padStart(width, "0")}`;
}

const sinceLabel = (iso: string) => {
  const d = new Date(iso);
  return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
};

export interface NewDealInput {
  product: string;
  amount: number;
  months: number;
  openedAt: string;
  clientId: string;
  clientName: string;
  manager: string;
  markupPct: number;
}

export interface NewClientInput {
  lastName: string;
  firstName: string;
  phone: string;
}

export interface CashAdjustmentInput {
  amount: number; // положительная — внесение, отрицательная — изъятие
  title: string;
  date: string;
}

interface DataContextValue extends StoredShape {
  addDeal: (input: NewDealInput) => Deal;
  addClient: (input: NewClientInput) => Client;
  acceptPayment: (dealId: string) => void;
  addCashAdjustment: (input: CashAdjustmentInput) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoredShape>({
    deals: seedDeals,
    clients: seedClients,
    paidPayments: seedPaidPayments,
    cash: buildSeedCash(seedDeals, seedPaidPayments),
    events: buildSeedEvents(seedDeals, seedPaidPayments),
  });
  const [hydrated, setHydrated] = useState(false);

  // Подхватываем сохранённое состояние уже после монтирования —
  // на сервере и при первом клиентском рендере всегда затравка,
  // чтобы не словить hydration mismatch.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<StoredShape>;
        // Мержим с затравкой: сохранённое состояние может быть от более
        // ранней версии схемы и не содержать новых полей
        setState((seed) => ({
          deals: saved.deals ?? seed.deals,
          clients: saved.clients ?? seed.clients,
          paidPayments: saved.paidPayments ?? seed.paidPayments,
          cash: saved.cash ?? buildSeedCash(
            saved.deals ?? seed.deals,
            saved.paidPayments ?? seed.paidPayments
          ),
          events: saved.events ?? buildSeedEvents(
            saved.deals ?? seed.deals,
            saved.paidPayments ?? seed.paidPayments
          ),
        }));
      }
    } catch {
      // Битые данные в localStorage — остаёмся на затравке
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const addDeal = useCallback((input: NewDealInput): Deal => {
    let created!: Deal;
    setState((s) => {
      const id = nextId("R-", s.deals.map((d) => d.id));
      created = {
        id,
        clientId: input.clientId,
        client: input.clientName,
        product: input.product,
        amount: input.amount,
        months: input.months,
        openedAt: input.openedAt,
        stage: "new",
        status: "Новая",
        statusTone: "blue",
        nextStep: "Ответить сегодня",
        manager: input.manager,
        markupPct: input.markupPct,
      };
      // Закупка товара сразу уменьшает остаток кассы
      const tx: CashTx = {
        id: `${id}-purchase`,
        kind: "purchase",
        amount: -purchasePrice(created),
        date: created.openedAt,
        dealId: id,
        title: `Закупка товара · ${created.product}`,
        note: created.client,
      };
      const event: DealEvent = {
        id: `${id}-created`,
        dealId: id,
        date: created.openedAt,
        text: `Сделка создана · ответственный ${created.manager}`,
      };
      return {
        ...s,
        deals: [created, ...s.deals],
        cash: [...s.cash, tx],
        events: [...s.events, event],
      };
    });
    return created;
  }, []);

  const addClient = useCallback((input: NewClientInput): Client => {
    let created!: Client;
    setState((s) => {
      const id = nextId("C-", s.clients.map((c) => c.id));
      created = {
        id,
        name: `${input.lastName} ${input.firstName}`.trim(),
        phone: input.phone || "—",
        email: "—",
        city: "—",
        since: sinceLabel(new Date().toISOString()),
        status: "lead",
        statusLabel: "Новая заявка",
        nextAction: "Первичный звонок",
        nextDate: "Сегодня",
      };
      return { ...s, clients: [created, ...s.clients] };
    });
    return created;
  }, []);

  const acceptPayment = useCallback((dealId: string) => {
    setState((s) => {
      const deal = s.deals.find((d) => d.id === dealId);
      if (!deal) return s;
      const current = s.paidPayments[dealId] ?? 0;
      if (current >= deal.months) return s;
      const next = current + 1;

      // Принятый взнос приходит в кассу — сумму берём из графика,
      // чтобы последний платёж закрывал остаток без ошибок округления
      const schedule = buildSchedule(
        deal.amount,
        deal.months,
        next,
        deal.openedAt
      );
      const installment = schedule[next - 1];
      const tx: CashTx = {
        id: `${dealId}-p${next}`,
        kind: "payment",
        amount: installment.amount,
        date: installment.iso,
        dealId,
        title: `Платёж ${next} из ${deal.months} · ${deal.client}`,
        note: deal.product,
      };
      const event: DealEvent = {
        id: `${dealId}-p${next}`,
        dealId,
        date: installment.iso,
        text: `Платёж ${next} из ${deal.months} принят — ${money(installment.amount)}`,
      };

      return {
        ...s,
        paidPayments: { ...s.paidPayments, [dealId]: next },
        cash: [...s.cash, tx],
        events: [...s.events, event],
      };
    });
  }, []);

  const addCashAdjustment = useCallback((input: CashAdjustmentInput) => {
    setState((s) => ({
      ...s,
      cash: [
        ...s.cash,
        {
          id: `adj-${Date.now()}`,
          kind: "adjustment",
          amount: input.amount,
          date: input.date,
          title: input.title,
        },
      ],
    }));
  }, []);

  const value = useMemo<DataContextValue>(
    () => ({ ...state, addDeal, addClient, acceptPayment, addCashAdjustment }),
    [state, addDeal, addClient, acceptPayment, addCashAdjustment]
  );

  return (
    <DataContext.Provider value={value}>{children}</DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}

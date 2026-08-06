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
import { monthNames } from "./schedule";

const STORAGE_KEY = "finora-store-v1";

interface StoredShape {
  deals: Deal[];
  clients: Client[];
  paidPayments: Record<string, number>;
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
}

export interface NewClientInput {
  lastName: string;
  firstName: string;
  phone: string;
}

interface DataContextValue extends StoredShape {
  addDeal: (input: NewDealInput) => Deal;
  addClient: (input: NewClientInput) => Client;
  acceptPayment: (dealId: string) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoredShape>({
    deals: seedDeals,
    clients: seedClients,
    paidPayments: seedPaidPayments,
  });
  const [hydrated, setHydrated] = useState(false);

  // Подхватываем сохранённое состояние уже после монтирования —
  // на сервере и при первом клиентском рендере всегда затравка,
  // чтобы не словить hydration mismatch.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw) as StoredShape);
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
        manager: "АС",
      };
      return { ...s, deals: [created, ...s.deals] };
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
      const next = Math.min(current + 1, deal.months);
      return {
        ...s,
        paidPayments: { ...s.paidPayments, [dealId]: next },
      };
    });
  }, []);

  const value = useMemo<DataContextValue>(
    () => ({ ...state, addDeal, addClient, acceptPayment }),
    [state, addDeal, addClient, acceptPayment]
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

"use client";

// Клиентский стор всего приложения. Источник правды — Postgres на сервере;
// здесь лежит его копия, загруженная через /api/bootstrap, и функции
// изменения, которые ходят в API и обновляют копию ответом сервера.
//
// До этапа 3 данные жили в localStorage браузера. Формы, которые отдаёт API,
// специально совпадают с прежними (Deal с вычисленными statusTone/urgent,
// paidPayments картой), поэтому страницы, lib/derive.ts и buildRoute
// переезда не заметили.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Deal, Client, ReminderStage } from "./data";
import type { DealEvent } from "./events";

export interface CurrentUser {
  id: number;
  name: string;
  initials: string;
  email: string;
  role: string;
}

export type EmployeeRole = "admin" | "manager" | "accountant";

export interface Employee {
  id: number;
  name: string;
  initials: string;
  email: string;
  phone: string;
  role: EmployeeRole;
  since: string;
  active: boolean;
}

// Стартовый остаток кассы раньше был константой CASH_OPENING_BALANCE,
// одинаковой для всех. Теперь это настройка компании: приезжает в bootstrap
// как cashOpeningBalance и у каждой компании своя.

export type CashKind =
  | "purchase"
  | "payment"
  | "adjustment"
  | "payout"
  | "capital_deposit"
  | "capital_withdrawal";

export interface CashTx {
  id: string;
  kind: CashKind;
  amount: number; // отрицательная — расход, положительная — приход
  date: string; // ISO
  dealId?: string;
  coinvestorId?: string;
  title: string;
  note?: string;
  /** Номер взноса графика, который закрыла (или отменяет) эта запись. */
  installmentNumber?: number;
  /** Запись-отмена: id отменённого ею платежа. */
  reversesId?: string;
}

export interface Coinvestor {
  id: string;
  name: string;
  phone: string;
  profitSharePct: number;
  startedAt: string;
  active: boolean;
  /** Текущий вложенный капитал — сумма журнала coinvestorCapitalTx. */
  capital: number;
  /** Начислено прибыли за всё время. */
  accrued: number;
  /** Выплачено деньгами + реинвестировано. */
  settled: number;
  /** К выплате прямо сейчас = accrued - settled. */
  owed: number;
}

export interface CoinvestorCapitalTx {
  id: string;
  coinvestorId: string;
  kind: "deposit" | "withdrawal" | "reinvest";
  amount: number;
  date: string;
  note?: string;
}

export interface CoinvestorProfitTx {
  id: string;
  coinvestorId: string;
  dealId?: string;
  kind: "accrual" | "payout" | "reinvest";
  amount: number;
  date: string;
  note?: string;
}

export type SavedFilterPage = "clients" | "cash" | "deals";

export interface SavedFilter {
  id: string;
  page: SavedFilterPage;
  name: string;
  params: Record<string, string>;
}

export interface MessageTemplate {
  id: string;
  name: string;
  body: string;
  isDefault: boolean;
  /** Стадия лесенки напоминаний, за которую этот шаблон отвечает — необязательна. */
  stage?: ReminderStage | null;
}

interface Snapshot {
  user: CurrentUser;
  employees: Employee[];
  deals: Deal[];
  clients: Client[];
  paidPayments: Record<string, number>;
  cash: CashTx[];
  events: DealEvent[];
  coinvestors: Coinvestor[];
  coinvestorCapitalTx: CoinvestorCapitalTx[];
  coinvestorProfitTx: CoinvestorProfitTx[];
  templates: MessageTemplate[];
  savedFilters: SavedFilter[];
  cashOpeningBalance: number;
  hiddenNavItems: string[];
  /** Базовый лимит клиента без истории; 0 — автоматические лимиты выключены. */
  clientDefaultLimit: number;
}

const EMPTY: Snapshot = {
  user: { id: 0, name: "", initials: "", email: "", role: "manager" },
  employees: [],
  deals: [],
  clients: [],
  paidPayments: {},
  cash: [],
  events: [],
  coinvestors: [],
  coinvestorCapitalTx: [],
  coinvestorProfitTx: [],
  templates: [],
  savedFilters: [],
  cashOpeningBalance: 0,
  hiddenNavItems: [],
  clientDefaultLimit: 0,
};

export interface NewDealInput {
  product: string;
  amount: number;
  months: number;
  openedAt: string;
  clientId: string;
  clientName: string;
  managerId: number;
  markupPct: number;
  description?: string;
  category?: string;
  city?: string;
  guarantorIds?: string[];
  downPayment?: number;
  /** Менеджер подтвердил оформление сверх лимита клиента — пишется в журнал. */
  overLimit?: boolean;
}

export interface NewClientInput {
  lastName: string;
  firstName: string;
  middleName?: string;
  phone: string;
  birthDate?: string;
  passportSeries?: string;
  passportNumber?: string;
  issuedBy?: string;
  issuedAt?: string;
  registrationAddress?: string;
  livingAddress?: string;
  inn?: string;
}

export interface UpdateDealInput {
  product: string;
  nextStep: string;
  managerId: number;
  amount?: number;
  months?: number;
  markupPct?: number;
  reminderTemplateId?: string | null;
}

export interface RestructureDealInput {
  months: number;
  from: string;
  reason: string;
  comment?: string;
}

export interface CashAdjustmentInput {
  amount: number;
  title: string;
  date: string;
}

export interface AcceptPaymentOptions {
  /** Фактическая дата поступления денег — по умолчанию сегодня. */
  date?: string;
  method?: "cash" | "card" | "transfer";
  /** Фактически внесённая сумма — по умолчанию очередной взнос по графику. */
  amount?: number;
}

export interface NewEmployeeInput {
  name: string;
  email: string;
  phone: string;
  role: EmployeeRole;
}

export interface UpdateEmployeeInput {
  name: string;
  phone: string;
  role: EmployeeRole;
}

export interface NewCoinvestorInput {
  name: string;
  phone: string;
  profitSharePct: number;
  startedAt: string;
  openingCapital?: number;
}

export interface UpdateCoinvestorInput {
  name: string;
  phone: string;
  profitSharePct: number;
}

export interface CoinvestorPayoutInput {
  amount: number;
  date: string;
}

export interface CoinvestorReinvestInput {
  amount: number;
  date: string;
}

export interface CoinvestorCapitalInput {
  direction: "deposit" | "withdrawal";
  amount: number;
  date: string;
  note?: string;
}

export interface TemplateInput {
  name: string;
  body: string;
  stage?: ReminderStage | null;
}

interface DataContextValue extends Snapshot {
  addDeal: (input: NewDealInput) => Promise<Deal>;
  updateDeal: (dealId: string, input: UpdateDealInput) => Promise<Deal>;
  restructureDeal: (dealId: string, input: RestructureDealInput) => Promise<Deal>;
  reassignDeal: (dealId: string, managerId: number) => Promise<Deal>;
  setDealStage: (dealId: string, stage: "new" | "check" | "active") => Promise<Deal>;
  closeDeal: (dealId: string) => Promise<Deal>;
  rejectDeal: (dealId: string, reason: string) => Promise<Deal>;
  holidayDeal: (dealId: string, months: number, reason: string) => Promise<Deal>;
  deleteDeal: (dealId: string) => Promise<void>;
  addEmployee: (input: NewEmployeeInput) => Promise<{ password: string }>;
  updateEmployee: (id: number, input: UpdateEmployeeInput) => Promise<void>;
  setEmployeeActive: (id: number, active: boolean) => Promise<void>;
  setHiddenNavItems: (hrefs: string[]) => Promise<void>;
  setClientDefaultLimit: (limit: number) => Promise<void>;
  setClientCreditLimit: (clientId: string, limit: number | null) => Promise<void>;
  /** Настройки → Оформление: меняет только переданные поля, возвращает новое состояние. */
  saveBranding: (input: {
    color?: string | null;
    logo?: string | null;
  }) => Promise<{ color: string | null; logoVersion: string | null }>;
  logout: () => Promise<void>;
  addClient: (input: NewClientInput) => Promise<Client>;
  setClientBlacklisted: (
    clientId: string,
    blacklisted: boolean,
    reason?: string
  ) => Promise<void>;
  acceptPayment: (dealId: string, options?: AcceptPaymentOptions) => Promise<void>;
  undoLastPayment: (dealId: string) => Promise<void>;
  addCashAdjustment: (input: CashAdjustmentInput) => Promise<void>;
  addCoinvestor: (input: NewCoinvestorInput) => Promise<Coinvestor>;
  updateCoinvestor: (id: string, input: UpdateCoinvestorInput) => Promise<void>;
  setCoinvestorActive: (id: string, active: boolean) => Promise<void>;
  deleteCoinvestor: (id: string) => Promise<void>;
  recordCoinvestorPayout: (id: string, input: CoinvestorPayoutInput) => Promise<void>;
  reinvestCoinvestorProfit: (id: string, input: CoinvestorReinvestInput) => Promise<void>;
  adjustCoinvestorCapital: (id: string, input: CoinvestorCapitalInput) => Promise<void>;
  addTemplate: (input: TemplateInput) => Promise<MessageTemplate>;
  updateTemplate: (id: string, input: TemplateInput) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  setDefaultTemplate: (id: string) => Promise<void>;
  sendReminder: (
    dealId: string,
    stageInfo?: { stage: ReminderStage; dueDate: string }
  ) => Promise<void>;
  bulkUpdateDeals: (
    ids: string[],
    change: { action: "stage"; stage: "new" | "check" | "active" } | { action: "manager"; managerId: number }
  ) => Promise<BulkResult>;
  saveFilter: (page: SavedFilterPage, name: string, params: Record<string, string>) => Promise<void>;
  deleteFilter: (id: string) => Promise<void>;
  /** Перечитать всё состояние с сервера. */
  refresh: () => Promise<void>;
}

export interface BulkResult {
  ok: string[];
  failed: { id: string; error: string }[];
}

const DataContext = createContext<DataContextValue | null>(null);

// ── Обращение к API ────────────────────────────────────────────────────

async function api<T>(path: string, body?: unknown, method?: string): Promise<T> {
  const res = await fetch(path, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // Сессия протухла посреди работы — отправляем на вход, а не показываем
  // невнятную ошибку поверх пустых страниц
  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    window.location.href = `/login?next=${encodeURIComponent(location.pathname)}`;
    throw new Error("Требуется вход");
  }

  if (!res.ok) {
    // Роуты отдают { error }, но при падении прокси придёт что угодно
    const message = await res
      .json()
      .then((d) => (d as { error?: string }).error)
      .catch(() => null);
    const err = new Error(message ?? `Запрос ${path} завершился ошибкой ${res.status}`);
    // 404 на bootstrap означает не «нет данных», а «нет такой компании»
    if (res.status === 404) err.name = "TenantMissing";
    throw err;
  }

  return res.json() as Promise<T>;
}

interface BootstrapResponse
  extends Omit<Snapshot, "cashOpeningBalance" | "hiddenNavItems" | "clientDefaultLimit"> {
  settings: { cashOpeningBalance: number; hiddenNavItems: string[]; clientDefaultLimit?: number };
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Snapshot>(EMPTY);
  const [status, setStatus] = useState<
    "loading" | "ready" | "failed" | "no-tenant"
  >("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await api<BootstrapResponse>("/api/bootstrap");
    setState({
      user: data.user,
      employees: data.employees,
      deals: data.deals,
      clients: data.clients,
      paidPayments: data.paidPayments,
      cash: data.cash,
      events: data.events,
      coinvestors: data.coinvestors,
      coinvestorCapitalTx: data.coinvestorCapitalTx,
      coinvestorProfitTx: data.coinvestorProfitTx,
      templates: data.templates,
      savedFilters: data.savedFilters,
      cashOpeningBalance: data.settings.cashOpeningBalance,
      hiddenNavItems: data.settings.hiddenNavItems,
      clientDefaultLimit: data.settings.clientDefaultLimit ?? 0,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Первая загрузка данных — ровно то, для чего нужен эффект: состояние
    // меняется после ответа сервера, а не синхронно при отрисовке
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
      .then(() => !cancelled && setStatus("ready"))
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setStatus(err.name === "TenantMissing" ? "no-tenant" : "failed");
      });

    return () => {
      cancelled = true;
    };
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  // Мутации возвращают созданную сущность, но производных величин меняется
  // больше (касса, история, статус клиента), поэтому после записи проще
  // перечитать состояние целиком, чем сращивать его по кускам вручную.
  // При нынешних объёмах это один быстрый запрос.

  const addDeal = useCallback(
    async (input: NewDealInput): Promise<Deal> => {
      const deal = await api<Deal>("/api/deals", {
        product: input.product,
        amount: input.amount,
        months: input.months,
        markupPct: input.markupPct,
        openedAt: input.openedAt,
        clientId: input.clientId,
        managerId: input.managerId,
        description: input.description,
        category: input.category,
        city: input.city,
        overLimit: input.overLimit,
        guarantorIds: input.guarantorIds,
        downPayment: input.downPayment,
      });
      await load();
      return deal;
    },
    [load]
  );

  const updateDeal = useCallback(
    async (dealId: string, input: UpdateDealInput): Promise<Deal> => {
      const deal = await api<Deal>(
        `/api/deals/${encodeURIComponent(dealId)}`,
        input,
        "PATCH"
      );
      await load();
      return deal;
    },
    [load]
  );

  const restructureDeal = useCallback(
    async (dealId: string, input: RestructureDealInput): Promise<Deal> => {
      const deal = await api<Deal>(
        `/api/deals/${encodeURIComponent(dealId)}/restructure`,
        input
      );
      await load();
      return deal;
    },
    [load]
  );

  const reassignDeal = useCallback(
    async (dealId: string, managerId: number): Promise<Deal> => {
      const deal = await api<Deal>(
        `/api/deals/${encodeURIComponent(dealId)}/manager`,
        { managerId }
      );
      await load();
      return deal;
    },
    [load]
  );

  const setDealStage = useCallback(
    async (dealId: string, stage: "new" | "check" | "active"): Promise<Deal> => {
      const deal = await api<Deal>(
        `/api/deals/${encodeURIComponent(dealId)}/stage`,
        { stage },
        "PATCH"
      );
      await load();
      return deal;
    },
    [load]
  );

  const closeDeal = useCallback(
    async (dealId: string): Promise<Deal> => {
      const deal = await api<Deal>(`/api/deals/${encodeURIComponent(dealId)}/close`, {});
      await load();
      return deal;
    },
    [load]
  );

  const holidayDeal = useCallback(
    async (dealId: string, months: number, reason: string): Promise<Deal> => {
      const deal = await api<Deal>(`/api/deals/${encodeURIComponent(dealId)}/holiday`, { months, reason });
      await load();
      return deal;
    },
    [load]
  );

  const rejectDeal = useCallback(
    async (dealId: string, reason: string): Promise<Deal> => {
      const deal = await api<Deal>(`/api/deals/${encodeURIComponent(dealId)}/reject`, { reason });
      await load();
      return deal;
    },
    [load]
  );

  const deleteDeal = useCallback(
    async (dealId: string) => {
      await api(`/api/deals/${encodeURIComponent(dealId)}`, undefined, "DELETE");
      await load();
    },
    [load]
  );

  const addClient = useCallback(
    async (input: NewClientInput): Promise<Client> => {
      const client = await api<Client>("/api/clients", input);
      await load();
      return client;
    },
    [load]
  );

  const setClientBlacklisted = useCallback(
    async (clientId: string, blacklisted: boolean, reason?: string) => {
      await api(
        `/api/clients/${encodeURIComponent(clientId)}/blacklist`,
        { blacklisted, reason },
        "PATCH"
      );
      await load();
    },
    [load]
  );

  const acceptPayment = useCallback(
    async (dealId: string, options?: AcceptPaymentOptions) => {
      await api(`/api/deals/${encodeURIComponent(dealId)}/payment`, options ?? {});
      await load();
    },
    [load]
  );

  const undoLastPayment = useCallback(
    async (dealId: string) => {
      await api(`/api/deals/${encodeURIComponent(dealId)}/undo-payment`, {});
      await load();
    },
    [load]
  );

  const addCashAdjustment = useCallback(
    async (input: CashAdjustmentInput) => {
      await api("/api/cash", input);
      await load();
    },
    [load]
  );

  const addCoinvestor = useCallback(
    async (input: NewCoinvestorInput): Promise<Coinvestor> => {
      const investor = await api<Coinvestor>("/api/coinvestors", input);
      await load();
      return investor;
    },
    [load]
  );

  const updateCoinvestor = useCallback(
    async (id: string, input: UpdateCoinvestorInput) => {
      await api(`/api/coinvestors/${encodeURIComponent(id)}`, input, "PATCH");
      await load();
    },
    [load]
  );

  const setCoinvestorActive = useCallback(
    async (id: string, active: boolean) => {
      await api(`/api/coinvestors/${encodeURIComponent(id)}`, { active }, "PATCH");
      await load();
    },
    [load]
  );

  const deleteCoinvestor = useCallback(
    async (id: string) => {
      await api(`/api/coinvestors/${encodeURIComponent(id)}`, undefined, "DELETE");
      await load();
    },
    [load]
  );

  const recordCoinvestorPayout = useCallback(
    async (id: string, input: CoinvestorPayoutInput) => {
      await api(`/api/coinvestors/${encodeURIComponent(id)}/payout`, input);
      await load();
    },
    [load]
  );

  const reinvestCoinvestorProfit = useCallback(
    async (id: string, input: CoinvestorReinvestInput) => {
      await api(`/api/coinvestors/${encodeURIComponent(id)}/reinvest`, input);
      await load();
    },
    [load]
  );

  const adjustCoinvestorCapital = useCallback(
    async (id: string, input: CoinvestorCapitalInput) => {
      await api(`/api/coinvestors/${encodeURIComponent(id)}/capital`, input);
      await load();
    },
    [load]
  );

  const addTemplate = useCallback(
    async (input: TemplateInput): Promise<MessageTemplate> => {
      const template = await api<MessageTemplate>("/api/templates", input);
      await load();
      return template;
    },
    [load]
  );

  const updateTemplateFn = useCallback(
    async (id: string, input: TemplateInput) => {
      await api(`/api/templates/${encodeURIComponent(id)}`, input, "PATCH");
      await load();
    },
    [load]
  );

  const deleteTemplateFn = useCallback(
    async (id: string) => {
      await api(`/api/templates/${encodeURIComponent(id)}`, undefined, "DELETE");
      await load();
    },
    [load]
  );

  const setDefaultTemplate = useCallback(
    async (id: string) => {
      await api(`/api/templates/${encodeURIComponent(id)}/default`, {});
      await load();
    },
    [load]
  );

  const sendReminder = useCallback(
    async (dealId: string, stageInfo?: { stage: ReminderStage; dueDate: string }) => {
      await api(`/api/deals/${encodeURIComponent(dealId)}/remind`, stageInfo ?? {});
      await load();
    },
    [load]
  );

  const addEmployee = useCallback(
    async (input: NewEmployeeInput) => {
      const res = await api<{ id: number; password: string }>("/api/employees", input);
      await load();
      return { password: res.password };
    },
    [load]
  );

  const updateEmployee = useCallback(
    async (id: number, input: UpdateEmployeeInput) => {
      await api(`/api/employees/${id}`, input, "PATCH");
      await load();
    },
    [load]
  );

  const setEmployeeActive = useCallback(
    async (id: number, active: boolean) => {
      await api(`/api/employees/${id}`, { active }, "PATCH");
      await load();
    },
    [load]
  );

  const setHiddenNavItems = useCallback(
    async (hrefs: string[]) => {
      await api("/api/settings/nav", { hidden: hrefs }, "PATCH");
      await load();
    },
    [load]
  );

  const setClientDefaultLimit = useCallback(
    async (limit: number) => {
      await api("/api/settings/credit", { defaultLimit: limit }, "PATCH");
      await load();
    },
    [load]
  );

  const setClientCreditLimit = useCallback(
    async (clientId: string, limit: number | null) => {
      await api(`/api/clients/${encodeURIComponent(clientId)}/limit`, { limit }, "PATCH");
      await load();
    },
    [load]
  );

  const saveBranding = useCallback(
    (input: { color?: string | null; logo?: string | null }) =>
      api<{ color: string | null; logoVersion: string | null }>(
        "/api/settings/branding",
        input,
        "PATCH"
      ),
    []
  );

  const bulkUpdateDeals = useCallback(
    async (
      ids: string[],
      change: { action: "stage"; stage: "new" | "check" | "active" } | { action: "manager"; managerId: number }
    ): Promise<BulkResult> => {
      const result = await api<BulkResult>("/api/deals/bulk", { ids, ...change });
      await load();
      return result;
    },
    [load]
  );

  const saveFilter = useCallback(
    async (page: SavedFilterPage, name: string, params: Record<string, string>) => {
      await api("/api/saved-filters", { page, name, params });
      await load();
    },
    [load]
  );

  const deleteFilter = useCallback(
    async (id: string) => {
      await api(`/api/saved-filters/${encodeURIComponent(id)}`, undefined, "DELETE");
      await load();
    },
    [load]
  );

  const logout = useCallback(async () => {
    await api("/api/auth/logout", {});
    window.location.href = "/login";
  }, []);

  const value = useMemo<DataContextValue>(
    () => ({
      ...state,
      addDeal,
      updateDeal,
      restructureDeal,
      reassignDeal,
      setDealStage,
      closeDeal,
      rejectDeal,
      holidayDeal,
      deleteDeal,
      addClient,
      setClientBlacklisted,
      acceptPayment,
      undoLastPayment,
      addCashAdjustment,
      addCoinvestor,
      updateCoinvestor,
      setCoinvestorActive,
      deleteCoinvestor,
      recordCoinvestorPayout,
      reinvestCoinvestorProfit,
      adjustCoinvestorCapital,
      addTemplate,
      updateTemplate: updateTemplateFn,
      deleteTemplate: deleteTemplateFn,
      setDefaultTemplate,
      sendReminder,
      addEmployee,
      updateEmployee,
      setEmployeeActive,
      setHiddenNavItems,
      setClientDefaultLimit,
      setClientCreditLimit,
      saveBranding,
      bulkUpdateDeals,
      saveFilter,
      deleteFilter,
      logout,
      refresh,
    }),
    [state, addDeal, updateDeal, restructureDeal, reassignDeal, setDealStage, closeDeal, rejectDeal, holidayDeal, deleteDeal, addClient, setClientBlacklisted, acceptPayment, undoLastPayment, addCashAdjustment,
     addCoinvestor, updateCoinvestor, setCoinvestorActive, deleteCoinvestor,
     recordCoinvestorPayout, reinvestCoinvestorProfit, adjustCoinvestorCapital,
     addTemplate, updateTemplateFn, deleteTemplateFn, setDefaultTemplate, sendReminder,
     addEmployee, updateEmployee, setEmployeeActive, setHiddenNavItems,
     setClientDefaultLimit, setClientCreditLimit, saveBranding, bulkUpdateDeals, saveFilter, deleteFilter, logout, refresh]
  );

  // Пока состояние не загружено, страницы не рендерим: иначе каждая из них
  // мигнула бы пустым состоянием («сделок нет», «клиентов нет»), а раньше
  // данные были доступны мгновенно и ни одна страница загрузку не умеет.
  if (status === "loading") return <BootstrapSkeleton />;
  if (status === "no-tenant") return <UnknownCompany message={error} />;
  if (status === "failed") return <BootstrapError message={error} />;

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

function BootstrapSkeleton() {
  return (
    <div className="min-h-screen bg-canvas p-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Загрузка данных</span>
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div className="h-9 w-56 animate-pulse rounded-[10px] bg-line" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-card bg-surface" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-card bg-surface" />
      </div>
    </div>
  );
}

function UnknownCompany({ message }: { message: string | null }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="max-w-md rounded-card border border-line bg-surface p-8 text-center shadow-card">
        <p className="font-medium">Компания не найдена</p>
        <p className="mt-1 text-sm text-mute">
          {message ?? "По этому адресу компании нет."} Проверьте адрес или
          обратитесь к администратору.
        </p>
        <a
          href="/company"
          className="mt-4 inline-block rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-deep"
        >
          Ввести адрес компании
        </a>
      </div>
    </div>
  );
}

function BootstrapError({ message }: { message: string | null }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="max-w-md rounded-card border border-line bg-surface p-8 text-center shadow-card">
        <p className="font-medium">Не удалось загрузить данные</p>
        <p className="mt-1 text-sm text-mute">
          {message ?? "Сервер не отвечает."} Проверьте соединение и обновите
          страницу.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-deep"
        >
          Обновить
        </button>
      </div>
    </div>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}

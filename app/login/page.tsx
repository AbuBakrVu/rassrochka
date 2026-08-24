"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Zap, Check } from "lucide-react";
import { PT_Serif, JetBrains_Mono } from "next/font/google";

// Витрина входа — единственное место в интерфейсе с этой парой шрифтов,
// сознательно: сцена «тетрадь долгов» (см. LedgerCard ниже), пилот перед
// возможным переносом на остальные экраны.
const ptSerif = PT_Serif({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-pt-serif",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-jetbrains-mono",
});

const field =
  "w-full rounded-[10px] border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:bg-surface";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Не удалось войти");
        setBusy(false);
        return;
      }

      // Смена пароля обязательна — туда и отправляем, минуя next
      router.replace(data.user?.mustChangePassword ? "/settings/password" : next);
      router.refresh();
    } catch {
      setError("Сервер не отвечает");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm">
      <div className="mb-8 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand text-white">
          <Zap size={18} aria-hidden />
        </span>
        <p className="font-semibold tracking-tight">Nasiya</p>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">Вход в систему</h1>
      <p className="mt-1.5 text-sm text-mute">
        Введите рабочую почту и пароль, чтобы открыть личный кабинет.
      </p>

      <label className="mt-6 mb-3 block">
        <span className="mb-1.5 block text-sm font-medium">Рабочая почта</span>
        <input
          className={field}
          type="email"
          autoComplete="username"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Пароль</span>
        <input
          className={field}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || !email || !password}
        className="mt-5 w-full rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-card transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-mute disabled:shadow-none"
      >
        {busy ? "Входим…" : "Войти"}
      </button>

      <p className="mt-4 text-center text-xs text-mute">
        Забыли пароль — обратитесь к администратору вашей компании
      </p>
    </form>
  );
}

// Сегодняшняя дата для датлайна на странице тетради — тот же формат,
// что и в остальном интерфейсе (lib/schedule.ts longDate), но без
// импорта: витрина не должна зависеть от рабочих данных компании.
const monthNames = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
function todayLabel() {
  const d = new Date();
  return `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()} г.`;
}

interface LedgerRow {
  name: string;
  amount: string;
  state: "paid" | "overdue" | "due";
}

const LEDGER_ROWS: LedgerRow[] = [
  { name: "Абрамов Никита", amount: "12 000 ₽", state: "paid" },
  { name: "Котова Марина", amount: "96 000 ₽", state: "overdue" },
  { name: "Юсупов Дилшод", amount: "5 000 ₽", state: "due" },
];

/** Разворот тетради долгов — сцена входа. Настоящий текст, не иконки: это
 *  единственное место в продукте, где стоит один раз показать характер. */
function LedgerCard() {
  return (
    <div
      className="relative w-[300px] -rotate-2 rounded-[6px] bg-[var(--color-ledger-paper)] px-6 pt-5 pb-7 text-left shadow-[0_24px_50px_rgba(0,0,0,0.35)]"
      style={{
        backgroundImage:
          "repeating-linear-gradient(to bottom, transparent, transparent 27px, var(--color-ledger-paper-line) 28px)",
      }}
    >
      {/* Красная поля-линия, как в разлинованных бухгалтерских тетрадях */}
      <span className="absolute top-0 bottom-0 left-9 w-px bg-[var(--color-ledger-stamp)]/35" aria-hidden />

      <p
        className={`${jetbrainsMono.variable} pl-6 text-[11px] tracking-[0.08em] text-ink/50 uppercase`}
        style={{ fontFamily: "var(--font-jetbrains-mono)" }}
      >
        {todayLabel()}
      </p>
      <div className="mt-1 mb-4 h-px pl-6">
        <div className="h-px bg-ink/15" />
      </div>

      <ul className="flex flex-col gap-3.5 pl-6">
        {LEDGER_ROWS.map((row, i) => (
          <li
            key={row.name}
            className={`${ptSerif.variable} flex items-baseline gap-2 opacity-0`}
            style={{
              animation: "ledger-row-in 0.5s ease-out forwards",
              animationDelay: `${300 + i * 180}ms`,
            }}
          >
            {row.state === "paid" ? (
              <Check size={13} className="mb-0.5 shrink-0 text-good" aria-hidden />
            ) : (
              <span
                className={`mb-0.5 h-[13px] w-[13px] shrink-0 rounded-full border ${
                  row.state === "overdue" ? "border-[var(--color-ledger-stamp)]" : "border-ink/30"
                }`}
                aria-hidden
              />
            )}
            <span
              className="truncate text-[15px] text-ink italic"
              style={{ fontFamily: "var(--font-pt-serif)" }}
            >
              {row.name}
            </span>
            <span className="flex-1 border-b border-dotted border-ink/25 translate-y-[-3px]" aria-hidden />
            <span
              className={`shrink-0 text-[13px] tabular-nums ${
                row.state === "overdue" ? "text-[var(--color-ledger-stamp)]" : "text-ink/80"
              }`}
              style={{ fontFamily: "var(--font-jetbrains-mono)" }}
            >
              {row.amount}
            </span>
          </li>
        ))}
      </ul>

      {/* Штамп — единственный по-настоящему декоративный элемент во всём
          интерфейсе, и только здесь: печать на странице, а не иконка. */}
      <div
        className="absolute -right-4 -bottom-4 flex h-[74px] w-[74px] rotate-[-8deg] items-center justify-center rounded-full border-2 border-double border-[var(--color-ledger-stamp)] bg-[var(--color-ledger-paper)] text-center opacity-0 mix-blend-multiply"
        style={{
          animation: "ledger-stamp-in 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards",
          animationDelay: "850ms",
        }}
        aria-hidden
      >
        <span className="leading-tight text-[var(--color-ledger-stamp)]">
          <span
            className="block text-[10px] font-bold tracking-[0.14em]"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            NASIYA
          </span>
          <span
            className="mt-0.5 block text-[9px] tracking-[0.05em]"
            style={{ fontFamily: "var(--font-pt-serif)" }}
          >
            рассрочка
          </span>
        </span>
      </div>
    </div>
  );
}

function BrandPanel() {
  return (
    <div className="relative hidden shrink-0 items-center justify-center overflow-hidden bg-[var(--color-ledger-panel)] px-10 lg:flex lg:w-[44%]">
      <div className="relative z-10 flex flex-col items-center text-center">
        <LedgerCard />
        <h2
          className={`${ptSerif.variable} mt-10 max-w-[19rem] text-[28px] leading-[1.2] text-white`}
          style={{ fontFamily: "var(--font-pt-serif)" }}
        >
          Тетрадь долгов, которая сама считает
        </h2>
        <p className="mt-3 max-w-xs text-sm text-white/55">
          Кто должен, сколько и когда — видно сразу, без пересчёта на бумаге.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-canvas">
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
      <BrandPanel />
    </div>
  );
}

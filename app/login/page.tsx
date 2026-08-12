"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Zap } from "lucide-react";

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

/** Декоративная витрина справа — карточка сделки и график поступлений, в тон общей палитре сайта. */
function BrandIllustration() {
  return (
    <svg viewBox="0 0 360 300" className="w-full max-w-[320px]" aria-hidden>
      <defs>
        <linearGradient id="lg-card" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#eaf2fd" />
        </linearGradient>
      </defs>

      <circle cx="70" cy="240" r="90" fill="#ffffff" opacity="0.08" />
      <circle cx="310" cy="40" r="60" fill="#ffffff" opacity="0.08" />

      {/* Карточка сделки */}
      <g transform="translate(30,40)">
        <rect width="230" height="150" rx="16" fill="url(#lg-card)" />
        <rect x="20" y="22" width="90" height="10" rx="5" fill="#175ba9" opacity="0.35" />
        <rect x="20" y="40" width="60" height="8" rx="4" fill="#77869c" opacity="0.35" />
        <rect x="20" y="70" width="190" height="1" fill="#e3ebf5" />

        {/* Столбики графика поступлений */}
        <g fill="#2f80ed">
          <rect x="20" y="118" width="14" height="16" rx="3" opacity="0.55" />
          <rect x="42" y="104" width="14" height="30" rx="3" opacity="0.7" />
          <rect x="64" y="94" width="14" height="40" rx="3" opacity="0.85" />
          <rect x="86" y="112" width="14" height="22" rx="3" opacity="0.6" />
          <rect x="108" y="86" width="14" height="48" rx="3" />
        </g>
        <circle cx="175" cy="108" r="26" fill="none" stroke="#2f80ed" strokeWidth="8" opacity="0.25" />
        <circle
          cx="175"
          cy="108"
          r="26"
          fill="none"
          stroke="#2f80ed"
          strokeWidth="8"
          strokeDasharray="120 163"
          strokeLinecap="round"
        />
      </g>

      {/* Плавающая карточка платежа */}
      <g transform="translate(190,190)">
        <rect width="140" height="60" rx="14" fill="#ffffff" />
        <circle cx="24" cy="30" r="14" fill="#e7f6ee" />
        <path d="M18 30l4 4 8-8" stroke="#1e8e5a" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="48" y="18" width="70" height="9" rx="4.5" fill="#172640" opacity="0.55" />
        <rect x="48" y="34" width="50" height="8" rx="4" fill="#77869c" opacity="0.4" />
      </g>
    </svg>
  );
}

function BrandPanel() {
  return (
    <div className="relative hidden shrink-0 items-center justify-center overflow-hidden bg-brand px-10 lg:flex lg:w-[42%]">
      <div className="relative z-10 flex flex-col items-center text-center">
        <BrandIllustration />
        <h2 className="mt-8 text-xl font-semibold text-white">
          Рассрочки под контролем
        </h2>
        <p className="mt-2 max-w-xs text-sm text-white/80">
          Сделки, платежи и клиенты — в одном окне, без таблиц и путаницы.
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

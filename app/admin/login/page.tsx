"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

const field =
  "w-full rounded-[10px] border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:bg-surface";

function LoginForm() {
  const router = useRouter();
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
      const res = await fetch("/api/admin/auth/login", {
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

      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Сервер не отвечает");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm">
      <div className="mb-8 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-ink text-white">
          <ShieldCheck size={18} aria-hidden />
        </span>
        <p className="font-semibold tracking-tight">Панель владельца</p>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">Управление компаниями</h1>
      <p className="mt-1.5 text-sm text-mute">
        Служебный доступ — только для владельца платформы Nasiya.
      </p>

      <label className="mt-6 mb-3 block">
        <span className="mb-1.5 block text-sm font-medium">Почта</span>
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
        className="mt-5 w-full rounded-[10px] bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-card transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:bg-line disabled:text-mute disabled:shadow-none"
      >
        {busy ? "Входим…" : "Войти"}
      </button>
    </form>
  );
}

/** Декоративная витрина справа — карточки компаний под общим контуром, в тон общей палитре сайта. */
function AdminIllustration() {
  return (
    <svg viewBox="0 0 360 300" className="w-full max-w-[320px]" aria-hidden>
      <circle cx="70" cy="240" r="90" fill="#ffffff" opacity="0.08" />
      <circle cx="310" cy="40" r="60" fill="#ffffff" opacity="0.08" />

      {/* Карточки компаний в стопке */}
      <g>
        <rect x="55" y="70" width="230" height="64" rx="14" fill="#ffffff" opacity="0.5" />
        <rect x="45" y="86" width="240" height="70" rx="14" fill="#ffffff" opacity="0.75" />
        <rect x="35" y="104" width="250" height="86" rx="16" fill="#ffffff" />

        <circle cx="66" cy="147" r="16" fill="#eaf2fd" />
        <rect x="58" y="140" width="16" height="14" rx="3" fill="#175ba9" opacity="0.55" />
        <rect x="92" y="130" width="120" height="10" rx="5" fill="#172640" opacity="0.55" />
        <rect x="92" y="148" width="80" height="8" rx="4" fill="#77869c" opacity="0.4" />
        <rect x="230" y="136" width="42" height="20" rx="10" fill="#e7f6ee" />
        <rect x="240" y="143" width="22" height="6" rx="3" fill="#1e8e5a" opacity="0.7" />
      </g>

      {/* Плавающая карточка "+ добавить" */}
      <g transform="translate(190,205)">
        <rect width="140" height="56" rx="14" fill="#ffffff" />
        <circle cx="26" cy="28" r="14" fill="#eaf2fd" />
        <path d="M26 21v14M19 28h14" stroke="#175ba9" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="50" y="17" width="72" height="9" rx="4.5" fill="#172640" opacity="0.55" />
        <rect x="50" y="33" width="50" height="8" rx="4" fill="#77869c" opacity="0.4" />
      </g>
    </svg>
  );
}

function BrandPanel() {
  return (
    <div className="relative hidden shrink-0 items-center justify-center overflow-hidden bg-ink px-10 lg:flex lg:w-[42%]">
      <div className="relative z-10 flex flex-col items-center text-center">
        <AdminIllustration />
        <h2 className="mt-8 text-xl font-semibold text-white">
          Все компании — в одном месте
        </h2>
        <p className="mt-2 max-w-xs text-sm text-white/70">
          Создавайте компании, открывайте и закрывайте им доступ, следите за
          сотрудниками — без ручных SQL-запросов.
        </p>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen bg-canvas">
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <LoginForm />
      </div>
      <BrandPanel />
    </div>
  );
}

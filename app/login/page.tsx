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
    <form
      onSubmit={submit}
      className="w-full max-w-sm rounded-card border border-line bg-surface p-6 shadow-card sm:p-8"
    >
      <div className="mb-6 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand text-white">
          <Zap size={18} aria-hidden />
        </span>
        <div>
          <p className="font-semibold tracking-tight">Финора</p>
          <p className="text-xs text-mute">Вход в систему</p>
        </div>
      </div>

      <label className="mb-3 block">
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

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}

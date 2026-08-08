"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import { useData } from "@/lib/store";

const field =
  "w-full rounded-[10px] border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:bg-surface";

export default function PasswordPage() {
  const { user, refresh } = useData();
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mismatch = repeat !== "" && next !== repeat;
  const ready = current !== "" && next.length >= 8 && next === repeat;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;

    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error ?? "Не удалось сменить пароль");
      setBusy(false);
      return;
    }

    setDone(true);
    await refresh();
    setTimeout(() => router.push("/"), 1200);
  };

  return (
    <>
      <PageHeader title="Смена пароля" subtitle={user.email} />
      <div className="mx-auto max-w-md px-4 py-6 sm:px-8">
        <Card className="p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound size={16} className="text-brand" aria-hidden />
            <h2 className="font-semibold">Новый пароль</h2>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Текущий пароль</span>
              <input
                className={field}
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">
                Новый пароль <span className="text-xs text-mute">от 8 символов</span>
              </span>
              <input
                className={field}
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Ещё раз</span>
              <input
                className={field}
                type="password"
                autoComplete="new-password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
              />
              {mismatch && (
                <span className="mt-1 block text-xs text-danger">Пароли не совпадают</span>
              )}
            </label>

            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!ready || busy || done}
              className="mt-1 rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-card hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-mute disabled:shadow-none"
            >
              {done ? "Пароль изменён" : busy ? "Сохраняем…" : "Сменить пароль"}
            </button>

            <p className="text-xs text-mute">
              Остальные ваши сессии на других устройствах будут завершены.
            </p>
          </form>
        </Card>
      </div>
    </>
  );
}

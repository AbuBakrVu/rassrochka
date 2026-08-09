"use client";

// Панель владельца платформы: список компаний, создание новых, включение/
// отключение доступа. Намеренно не использует lib/store.tsx — тот
// провайдер держит данные одной компании, а здесь речь обо всех сразу.

import { useEffect, useState } from "react";
import { ShieldCheck, Plus, LogOut, Building2 } from "lucide-react";
import { APP_DOMAIN } from "@/lib/tenant-host";

interface Company {
  slug: string;
  name: string;
  active: boolean;
  createdAt: string;
}

const field =
  "w-full rounded-[10px] border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:bg-surface";

export default function AdminPage() {
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [issued, setIssued] = useState<{ slug: string; email: string; password: string } | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/admin/companies");
    if (res.status === 401) {
      window.location.href = "/admin/login";
      return;
    }
    if (!res.ok) {
      setError("Не удалось загрузить список компаний");
      return;
    }
    setCompanies(await res.json());
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (slug: string, active: boolean) => {
    setBusySlug(slug);
    try {
      const res = await fetch(`/api/admin/companies/${slug}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Не удалось изменить доступ");
        return;
      }
      await load();
    } finally {
      setBusySlug(null);
    }
  };

  const logout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  };

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-ink text-white">
            <ShieldCheck size={18} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold tracking-tight">Панель владельца</h1>
            <p className="text-sm text-mute">{APP_DOMAIN}</p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-card hover:bg-brand-deep"
          >
            <Plus size={16} aria-hidden /> Создать компанию
          </button>
          <button
            onClick={logout}
            aria-label="Выйти"
            className="rounded-[10px] border border-line p-2.5 text-mute hover:text-ink"
          >
            <LogOut size={16} aria-hidden />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        {error && <p className="mb-4 text-sm text-danger">{error}</p>}

        {companies === null ? (
          <p className="text-sm text-mute">Загрузка…</p>
        ) : companies.length === 0 ? (
          <div className="flex flex-col items-center rounded-card border border-line bg-surface px-6 py-16 text-center">
            <Building2 size={28} className="mb-3 text-mute" aria-hidden />
            <p className="font-medium">Компаний пока нет</p>
            <p className="mt-1 text-sm text-mute">
              Первая появится после того, как вы её создадите
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-mute">
                  <th className="px-5 py-3 font-medium">Компания</th>
                  <th className="px-3 py-3 font-medium">Адрес</th>
                  <th className="px-3 py-3 font-medium">Статус</th>
                  <th className="px-3 py-3 font-medium">Создана</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {companies.map((c) => (
                  <tr key={c.slug}>
                    <td className="px-5 py-3.5 font-medium">{c.name}</td>
                    <td className="px-3 py-3.5">
                      <a
                        href={`https://${c.slug}.${APP_DOMAIN}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand hover:text-brand-deep"
                      >
                        {c.slug}.{APP_DOMAIN}
                      </a>
                    </td>
                    <td className="px-3 py-3.5">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          c.active
                            ? "bg-good-soft text-good"
                            : "bg-canvas text-mute"
                        }`}
                      >
                        {c.active ? "Активна" : "Доступ закрыт"}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-mute">
                      {new Date(c.createdAt).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => toggle(c.slug, !c.active)}
                        disabled={busySlug === c.slug}
                        className="rounded-[8px] border border-line px-3 py-1.5 text-xs text-mute transition-colors hover:border-brand/40 hover:text-ink disabled:opacity-50"
                      >
                        {c.active ? "Закрыть доступ" : "Открыть доступ"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createOpen && (
        <CreateCompanyModal
          onClose={() => setCreateOpen(false)}
          onCreated={(data) => {
            setCreateOpen(false);
            setIssued(data);
            load();
          }}
        />
      )}

      {issued && <IssuedModal data={issued} onClose={() => setIssued(null)} />}
    </div>
  );
}

function CreateCompanyModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (data: { slug: string; email: string; password: string }) => void;
}) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  const ready = cleanSlug.length >= 2 && name.trim() !== "" && adminEmail.trim() !== "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || saving) return;

    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/companies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: cleanSlug,
        name: name.trim(),
        adminName: adminName.trim() || undefined,
        adminEmail: adminEmail.trim(),
      }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error ?? "Не удалось создать компанию");
      setSaving(false);
      return;
    }

    onCreated({ slug: cleanSlug, email: adminEmail.trim(), password: data.password });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button aria-label="Закрыть окно" className="absolute inset-0 bg-ink/35" onClick={onClose} />
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-t-card bg-surface shadow-pop sm:rounded-card"
      >
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-semibold tracking-tight">Новая компания</h2>
          <p className="text-sm text-mute">Получит пустую CRM и своего администратора</p>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Название</span>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="ООО Акме" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Адрес (поддомен)</span>
            <div className="flex items-center rounded-[10px] border border-line bg-canvas focus-within:border-brand focus-within:bg-surface">
              <input
                className="w-full min-w-0 bg-transparent px-3.5 py-2.5 text-sm outline-none"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="acme"
              />
              <span className="shrink-0 pr-3.5 text-sm text-mute">.{APP_DOMAIN}</span>
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Имя администратора</span>
            <input className={field} value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Иван Петров" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Почта администратора</span>
            <input className={field} type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="director@acme.ru" />
          </label>
        </div>

        <footer className="flex items-center gap-3 border-t border-line px-5 py-4">
          <p className="mr-auto text-sm" role="status" aria-live="polite">
            {error ? <span className="text-danger">{error}</span> : saving ? "Создаём…" : ""}
          </p>
          <button type="button" onClick={onClose} className="rounded-[10px] border border-line px-4 py-2.5 text-sm font-medium text-mute hover:text-ink">
            Отмена
          </button>
          <button
            type="submit"
            disabled={!ready || saving}
            className="rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-card hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-mute disabled:shadow-none"
          >
            Создать
          </button>
        </footer>
      </form>
    </div>
  );
}

function IssuedModal({
  data,
  onClose,
}: {
  data: { slug: string; email: string; password: string };
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <button aria-label="Закрыть окно" className="absolute inset-0 bg-ink/35" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-sm rounded-card bg-surface p-6 text-center shadow-pop">
        <p className="font-semibold tracking-tight">Компания создана</p>
        <p className="mt-1 text-sm text-mute">
          {data.slug}.{APP_DOMAIN} · {data.email}
        </p>
        <p className="my-4 rounded-[10px] bg-canvas px-4 py-3 font-mono text-lg font-semibold tracking-wide">
          {data.password}
        </p>
        <p className="text-xs text-mute">
          Пароль показан один раз — передайте его клиенту по защищённому каналу.
        </p>
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-deep"
        >
          Записал
        </button>
      </div>
    </div>
  );
}

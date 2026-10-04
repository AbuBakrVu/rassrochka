"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldAlert, ShieldOff, Search } from "lucide-react";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { useData } from "@/lib/store";

export default function BlacklistPage() {
  const router = useRouter();
  const { clients, setClientBlacklisted } = useData();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      clients
        .filter((c) => !!c.blacklistedAt)
        .sort((a, b) => (b.blacklistedAt ?? "").localeCompare(a.blacklistedAt ?? "")),
    [clients]
  );

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = query.replace(/\D/g, "");
    return rows.filter(
      (c) =>
        q === "" ||
        c.name.toLowerCase().includes(q) ||
        (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits))
    );
  }, [rows, query]);

  const remove = async (id: string, name: string) => {
    if (!confirm(`Убрать ${name} из чёрного списка?`)) return;
    setBusy(id);
    try {
      await setClientBlacklisted(id, false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось убрать из списка");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Чёрный список"
        subtitle="Клиенты, которых менеджер отметил как проблемных по оплате"
      />
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        {rows.length === 0 ? (
          <Card>
            <EmptyState
              icon={ShieldAlert}
              title="Список пуст"
              text="Добавить клиента можно с его карточки — кнопка «В чёрный список»."
              action="Ко всем клиентам"
              onAction={() => router.push("/clients")}
            />
          </Card>
        ) : (
          <>
            <label className="relative mb-4 block max-w-xs">
              <Search
                size={16}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-mute"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по имени или телефону"
                className="w-full rounded-[14px] border border-line bg-surface py-2 pr-3 pl-9 text-sm outline-none focus:border-brand"
              />
            </label>

            <Card className="overflow-hidden">
              {list.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="Никого не нашли"
                  text="Проверьте написание имени или номера телефона."
                  action="Сбросить поиск"
                  onAction={() => setQuery("")}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs text-mute">
                        <th className="px-5 py-3 font-medium">Клиент</th>
                        <th className="px-5 py-3 font-medium">Причина</th>
                        <th className="px-5 py-3 font-medium">В списке с</th>
                        <th className="px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {list.map((c) => (
                        <tr key={c.id} className="hover:bg-canvas">
                          <td className="px-5 py-3.5">
                            <Link
                              href={`/clients/${c.id}`}
                              className="font-medium hover:text-brand-deep"
                            >
                              {c.name}
                            </Link>
                            <p className="text-xs text-mute">{c.phone}</p>
                          </td>
                          <td className="px-5 py-3.5 text-mute">
                            {c.blacklistReason || "—"}
                          </td>
                          <td className="px-5 py-3.5 text-mute">
                            {c.blacklistedAt
                              ? new Date(c.blacklistedAt).toLocaleDateString("ru-RU")
                              : "—"}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => remove(c.id, c.name)}
                              disabled={busy === c.id}
                              className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-mute transition-colors hover:border-good/40 hover:text-good disabled:opacity-50"
                            >
                              <ShieldOff size={13} aria-hidden />
                              Убрать
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </>
  );
}

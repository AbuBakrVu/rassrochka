"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookUser, Search } from "lucide-react";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import { dealsOfClient } from "@/lib/data";
import { useData } from "@/lib/store";

export default function RegistryPage() {
  const router = useRouter();
  const { clients, deals } = useData();
  const [query, setQuery] = useState("");

  const rows = useMemo(
    () =>
      clients
        .filter((c) => c.status === "closed")
        .map((client) => ({
          client,
          dealsCount: dealsOfClient(deals, client.id).length,
        })),
    [clients, deals]
  );

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = query.replace(/\D/g, "");
    return rows.filter(
      ({ client }) =>
        q === "" ||
        client.name.toLowerCase().includes(q) ||
        (digits.length >= 3 && client.phone.replace(/\D/g, "").includes(digits))
    );
  }, [rows, query]);

  return (
    <>
      <PageHeader
        title="Реестр клиентов"
        subtitle="Полный архив клиентов с историей по всем сделкам"
      />
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        {rows.length === 0 ? (
          <Card>
            <EmptyState
              icon={BookUser}
              title="Архив пока пуст"
              text="Здесь появятся закрытые клиенты. Активные клиенты доступны в разделе «Клиенты»."
              action="Перейти к клиентам"
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
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs text-mute">
                        <th className="px-5 py-3 font-medium">Клиент</th>
                        <th className="px-5 py-3 font-medium">Статус</th>
                        <th className="px-5 py-3 font-medium">Сделок всего</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {list.map(({ client: c, dealsCount }) => (
                        <tr
                          key={c.id}
                          onClick={() => router.push(`/clients/${c.id}`)}
                          className="cursor-pointer transition-colors hover:bg-canvas"
                        >
                          <td className="px-5 py-3.5">
                            <Link
                              href={`/clients/${c.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-medium hover:text-brand-deep"
                            >
                              {c.name}
                            </Link>
                            <p className="text-xs text-mute">{c.phone}</p>
                          </td>
                          <td className="px-5 py-3.5">
                            <Badge tone="gray">{c.statusLabel}</Badge>
                          </td>
                          <td className="px-5 py-3.5">{dealsCount}</td>
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

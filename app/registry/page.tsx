"use client";

import { BookUser } from "lucide-react";
import StubPage from "@/components/stub";

export default function Page() {
  return (
    <StubPage
      title="Реестр клиентов"
      subtitle="Полный архив клиентов с историей по всем сделкам"
      icon={BookUser}
      emptyTitle="Архив пока пуст"
      emptyText="Здесь появятся закрытые и архивные клиенты. Активные клиенты доступны в разделе «Клиенты»."
      action="Перейти к клиентам"
    />
  );
}
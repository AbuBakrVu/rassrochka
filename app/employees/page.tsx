"use client";

import { UserCog } from "lucide-react";
import StubPage from "@/components/stub";

export default function Page() {
  return (
    <StubPage
      title="Сотрудники"
      subtitle="Менеджеры, роли и права доступа"
      icon={UserCog}
      emptyTitle="В команде пока только вы"
      emptyText="Пригласите менеджеров и распределите сделки — у каждого будет своя очередь задач на день."
      action="Пригласить сотрудника"
    />
  );
}
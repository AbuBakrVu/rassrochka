"use client";

import { Send } from "lucide-react";
import StubPage from "@/components/stub";

export default function Page() {
  return (
    <StubPage
      title="Рассылки"
      subtitle="Напоминания об оплате и уведомления клиентам"
      icon={Send}
      emptyTitle="Рассылок пока нет"
      emptyText="Создайте первую рассылку — например, напоминание за день до платежа. Шаблоны подставят имя и сумму автоматически."
      action="Создать рассылку"
    />
  );
}
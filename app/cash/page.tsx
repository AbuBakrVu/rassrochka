"use client";

import { Wallet } from "lucide-react";
import StubPage from "@/components/stub";

export default function Page() {
  return (
    <StubPage
      title="Кассы"
      subtitle="Наличные и безналичные точки приёма платежей"
      icon={Wallet}
      emptyTitle="Кассы не настроены"
      emptyText="Подключите кассу или расчётный счёт — платежи будут разноситься по точкам приёма автоматически."
      action="Добавить кассу"
    />
  );
}
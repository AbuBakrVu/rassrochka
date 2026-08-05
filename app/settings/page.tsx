"use client";

import { Settings } from "lucide-react";
import StubPage from "@/components/stub";

export default function Page() {
  return (
    <StubPage
      title="Настройки"
      subtitle="Компания, интеграции и параметры рассрочки"
      icon={Settings}
      emptyTitle="Настройки появятся здесь"
      emptyText="Раздел в разработке: параметры графиков платежей, штрафов и интеграций будут доступны в следующей версии."
      action=""
    />
  );
}
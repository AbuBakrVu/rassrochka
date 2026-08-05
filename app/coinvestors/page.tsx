"use client";

import { Handshake } from "lucide-react";
import StubPage from "@/components/stub";

export default function Page() {
  return (
    <StubPage
      title="Соинвесторы"
      subtitle="Партнёры и распределение долей по сделкам"
      icon={Handshake}
      emptyTitle="Соинвесторы не добавлены"
      emptyText="Добавьте партнёра, чтобы делить портфель по долям и видеть выплаты каждого в отчётах."
      action="Добавить соинвестора"
    />
  );
}
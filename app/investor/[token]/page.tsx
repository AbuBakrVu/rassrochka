import type { Metadata } from "next";
import InvestorPortal from "@/components/investor-portal";

export const metadata: Metadata = {
  title: "Кабинет соинвестора — Nasiya",
  description: "Капитал, начисления и выплаты соинвестора",
};

export default async function InvestorPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InvestorPortal token={token} />;
}

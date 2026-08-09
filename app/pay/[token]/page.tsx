import type { Metadata } from "next";
import ClientPortal from "@/components/client-portal";

export const metadata: Metadata = {
  title: "Моя рассрочка — Nasiya",
  description: "График платежей и остаток по рассрочке",
};

export default async function ClientPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ClientPortal token={token} />;
}

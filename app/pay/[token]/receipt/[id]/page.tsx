import type { Metadata } from "next";
import PaymentReceipt from "@/components/payment-receipt";

export const metadata: Metadata = {
  title: "Квитанция об оплате — Nasiya",
  description: "Квитанция о платеже по рассрочке",
};

export default async function PaymentReceiptPage({
  params,
}: {
  params: Promise<{ token: string; id: string }>;
}) {
  const { token, id } = await params;
  return <PaymentReceipt token={token} id={id} />;
}

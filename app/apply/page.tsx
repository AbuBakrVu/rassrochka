import type { Metadata } from "next";
import ApplyForm from "@/components/apply-form";

export const metadata: Metadata = {
  title: "Рассрочка — калькулятор и заявка",
  description: "Посчитайте ежемесячный платёж и оставьте заявку на рассрочку",
};

// Онлайн-заявка и калькулятор для клиентов. Цена и срок подставляются из
// ссылки: /apply?price=45000&months=6&product=Телефон — так компания может
// ставить кнопку «Купить в рассрочку» у товара на своём сайте.
export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const price = Number(one(sp.price).replace(/\D/g, ""));
  const months = Number(one(sp.months));
  return (
    <ApplyForm
      initialPrice={price > 0 ? price : undefined}
      initialMonths={months > 0 ? months : undefined}
      initialProduct={one(sp.product).slice(0, 200)}
      embedded={one(sp.embed) === "1"}
    />
  );
}

import { redirect } from "next/navigation";

// Рассылки разделены: очередь напоминаний — вкладка в «Работе с долгом», шаблоны — в Настройках.
export default function Page() {
  redirect("/collections?tab=reminders");
}

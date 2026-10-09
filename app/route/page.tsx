import { redirect } from "next/navigation";

// «Маршрут дня» убран: те же дела — блок «Приоритеты» на главной и колокольчик уведомлений.
export default function Page() {
  redirect("/");
}

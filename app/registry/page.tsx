import { redirect } from "next/navigation";

// Реестр клиентов теперь — вкладка «Архив» в разделе «Клиенты»; старые ссылки ведут туда.
export default function Page() {
  redirect("/clients?filter=archive");
}

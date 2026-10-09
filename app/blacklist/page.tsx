import { redirect } from "next/navigation";

// Чёрный список теперь — вкладка раздела «Клиенты»; старые ссылки ведут туда.
export default function Page() {
  redirect("/clients?filter=blacklist");
}

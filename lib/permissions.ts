// Права сотрудников: разделы, которые он видит, и действия, которые может
// делать. Общий файл для сервера (app/api/_lib/handler.ts проверяет права
// каждого запроса) и интерфейса (меню, кнопки) — без серверных зависимостей.
//
// Администратор может всё, включая то, что правами не описывается:
// настройки компании, сотрудники и роли, удаление сделок, отмена платежей.
// Встроенные «Менеджер» и «Бухгалтер» — фиксированные наборы ниже, свои
// роли администратор собирает галочками в Настройки → Роли.

export type Permission =
  // Разделы
  | "dashboard"
  | "analytics"
  | "deals"
  | "clients"
  | "payments"
  | "collections"
  | "mailings"
  | "cash"
  | "coinvestors"
  | "employees"
  | "journal"
  // Действия
  | "deals.edit"
  | "payments.accept"
  | "clients.edit"
  | "clients.personal"
  | "cash.edit";

export type BuiltinRole = "admin" | "manager" | "accountant";
export type RoleKind = BuiltinRole | "custom";

interface PermissionInfo {
  key: Permission;
  label: string;
  hint?: string;
}

/** Порядок и подписи — для формы роли в настройках. */
export const PERMISSION_GROUPS: { title: string; items: PermissionInfo[] }[] = [
  {
    title: "Разделы",
    items: [
      { key: "dashboard", label: "Главная" },
      { key: "analytics", label: "Аналитика", hint: "включая план/факт сборов и доходность" },
      { key: "deals", label: "Сделки" },
      { key: "clients", label: "Клиенты", hint: "реестр и чёрный список" },
      { key: "payments", label: "Платежи", hint: "календарь платежей" },
      { key: "collections", label: "Просрочки" },
      { key: "mailings", label: "Рассылки" },
      { key: "cash", label: "Финансы", hint: "касса и прогноз" },
      { key: "coinvestors", label: "Соинвесторы", hint: "просмотр и управление" },
      { key: "employees", label: "Сотрудники", hint: "только просмотр" },
      { key: "journal", label: "Журнал действий" },
    ],
  },
  {
    title: "Действия",
    items: [
      { key: "deals.edit", label: "Оформлять и вести сделки", hint: "создание, этапы, график, отказ, звонки" },
      { key: "payments.accept", label: "Принимать платежи" },
      { key: "clients.edit", label: "Заводить и править клиентов", hint: "документы, согласие, чёрный список" },
      { key: "clients.personal", label: "Видеть паспорт и контакты клиентов" },
      { key: "cash.edit", label: "Ручные операции по кассе", hint: "вместе с ними видит доходность соинвесторов" },
    ],
  },
];

export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

export const isPermission = (v: unknown): v is Permission =>
  typeof v === "string" && (ALL_PERMISSIONS as string[]).includes(v);

/** Прежние права встроенных ролей — не меняются от введения своих. */
const BUILTIN: Record<BuiltinRole, readonly Permission[]> = {
  admin: ALL_PERMISSIONS,
  manager: [
    "dashboard", "analytics", "deals", "clients", "payments", "collections", "mailings",
    "cash", "employees",
    "deals.edit", "payments.accept", "clients.edit", "clients.personal",
  ],
  accountant: ["analytics", "cash", "cash.edit"],
};

export const ROLE_LABEL: Record<BuiltinRole, string> = {
  admin: "Администратор",
  manager: "Менеджер",
  accountant: "Бухгалтер",
};

/** Полный набор прав сотрудника; у своей роли — то, что отмечено в ней. */
export function permissionsFor(role: RoleKind, custom?: readonly string[] | null): Permission[] {
  if (role === "custom") return (custom ?? []).filter(isPermission);
  return [...BUILTIN[role]];
}

export function can(user: { permissions: readonly string[] }, permission: Permission): boolean {
  return user.permissions.includes(permission);
}

/** Какое право открывает раздел меню. "/settings" открыт всем (смена пароля). */
export const SECTION_PERMISSION: Record<string, Permission | null> = {
  "/": "dashboard",
  "/analytics": "analytics",
  "/deals": "deals",
  "/clients": "clients",
  "/payments": "payments",
  "/route": "deals",
  "/collections": "collections",
  "/mailings": "mailings",
  "/coinvestors": "coinvestors",
  "/cash": "cash",
  "/registry": "clients",
  "/blacklist": "clients",
  "/employees": "employees",
  "/journal": "journal",
  "/import": "clients.edit",
  "/settings": null,
};

/** Можно ли открыть страницу — по самому длинному совпавшему разделу. */
export function canOpen(user: { permissions: readonly string[] }, pathname: string): boolean {
  const section = Object.keys(SECTION_PERMISSION)
    .filter((href) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/")))
    .sort((a, b) => b.length - a.length)[0];
  if (section === undefined) return true;
  const perm = SECTION_PERMISSION[section];
  return perm === null || can(user, perm);
}

/** Куда вести сотрудника, которому закрыта открытая им страница. */
export function homeFor(user: { permissions: readonly string[] }): string {
  const order = ["/", "/deals", "/clients", "/cash", "/analytics", "/payments", "/collections", "/coinvestors"];
  return order.find((href) => canOpen(user, href)) ?? "/settings";
}

/** Подпись роли сотрудника: встроенная или название своей. */
export function roleTitle(
  employee: { role: RoleKind; roleId?: number },
  roles: readonly { id: number; name: string }[]
): string {
  if (employee.role !== "custom") return ROLE_LABEL[employee.role];
  return roles.find((r) => r.id === employee.roleId)?.name ?? "Своя роль";
}

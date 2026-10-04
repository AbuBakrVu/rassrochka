"use client";

// Экспорт таблиц в CSV — открывается Excel без плагинов. Разделитель ";",
// не запятая: в русской локали Excel запятая — десятичный разделитель,
// и CSV с запятыми у пользователя разъедется по одному столбцу.

function escapeCell(value: string | number): string {
  let s = String(value);
  // Текст, который Excel принял бы за формулу (=, +, @, «-» не перед
  // цифрой), — со знаком-апострофом впереди: иначе клиент с именем
  // «=HYPERLINK(...)» выполнит формулу у того, кто откроет выгрузку
  if (typeof value === "string" && /^([=+@\t\r]|-(?!\d))/.test(s)) s = `'${s}`;
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(";"));
  // BOM — иначе Excel на Windows показывает кракозябры вместо кириллицы
  const csv = "﻿" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Файл календаря (.ics) с будущими платежами — клиент одним нажатием
// добавляет их в календарь телефона, и телефон сам напоминает за день.

import { money } from "./schedule";

export interface CalendarPayment {
  uid: string;
  iso: string; // дата платежа, ГГГГ-ММ-ДД
  amount: number;
  product: string;
  dealId: string;
}

// RFC 5545: запятая, точка с запятой и обратный слэш экранируются
const esc = (s: string) => s.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");

const compact = (iso: string) => iso.replaceAll("-", "");

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function buildPaymentsCalendar(
  payments: CalendarPayment[],
  companyName: string,
  portalUrl: string
): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nasiya//Рассрочка//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(`Платежи · ${companyName}`)}`,
  ];

  for (const p of payments) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${p.uid}@nasiya`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(p.iso)}`,
      `DTEND;VALUE=DATE:${compact(nextDay(p.iso))}`,
      `SUMMARY:${esc(`Платёж по рассрочке — ${money(p.amount)}`)}`,
      `DESCRIPTION:${esc(`${p.product}, договор № ${p.dealId}.\nГрафик и остаток: ${portalUrl}`)}`,
      "TRANSP:TRANSPARENT",
      // Напоминание накануне в 9:00 (событие на весь день начинается в 0:00)
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(`Завтра платёж ${money(p.amount)}`)}`,
      "TRIGGER:-PT15H",
      "END:VALARM",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  // Строки длиннее 75 октетов по стандарту переносятся; календари
  // телефонов длинные строки читают и так, но делаем по правилам
  return lines.map(fold).join("\r\n") + "\r\n";
}

function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const len = new TextEncoder().encode(ch).length;
    // первая строка — 75 октетов, продолжения — 74 плюс ведущий пробел
    if (size + len > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += len;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

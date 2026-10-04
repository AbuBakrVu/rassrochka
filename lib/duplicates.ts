// Поиск дублей клиента: тот же телефон (последние 10 цифр — «8…» и «+7…»
// считаются одним номером) или тот же паспорт (серия и номер). Чистая
// функция — проверяется тестом lib/duplicates.test.ts.

export interface DuplicateCandidate {
  id: string;
  name: string;
  phone: string;
  passportSeries?: string;
  passportNumber?: string;
}

export type DuplicateReason = "phone" | "passport";

/** Ключ телефона для сравнения: последние 10 цифр, иначе null. */
export function phoneKey(phone: string | undefined): string | null {
  const d = (phone ?? "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
}

export function findDuplicates<T extends DuplicateCandidate>(
  clients: T[],
  input: { phone?: string; passportSeries?: string; passportNumber?: string }
): { client: T; reasons: DuplicateReason[] }[] {
  const phone = phoneKey(input.phone);
  const series = (input.passportSeries ?? "").replace(/\D/g, "");
  const number = (input.passportNumber ?? "").replace(/\D/g, "");
  const passport = series.length === 4 && number.length === 6 ? series + number : null;

  return clients
    .map((client) => {
      const reasons: DuplicateReason[] = [];
      if (phone && phoneKey(client.phone) === phone) reasons.push("phone");
      const theirs = `${client.passportSeries ?? ""}${client.passportNumber ?? ""}`.replace(/\D/g, "");
      if (passport && theirs === passport) reasons.push("passport");
      return { client, reasons };
    })
    .filter((d) => d.reasons.length > 0);
}

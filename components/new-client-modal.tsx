"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, Users } from "lucide-react";
import { useData } from "@/lib/store";
import type { Client } from "@/lib/data";
import { findDuplicates } from "@/lib/duplicates";

// Маска +7 (999) 999-99-99
function maskPhone(raw: string) {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("8")) d = "7" + d.slice(1);
  if (!d.startsWith("7")) d = "7" + d;
  d = d.slice(0, 11);
  const [, a = "", b = "", c = "", e = ""] =
    /^7(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})$/.exec(d) ?? [];
  let out = "+7";
  if (a) out += ` (${a}`;
  if (a.length === 3) out += ")";
  if (b) out += ` ${b}`;
  if (c) out += `-${c}`;
  if (e) out += `-${e}`;
  return out;
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">
        {label}
        {required && (
          <span className="ml-1 text-danger" aria-hidden>
            *
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

const input =
  "w-full rounded-[14px] border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:bg-surface";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold tracking-wide text-mute uppercase">
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export default function NewClientModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: (client: Client) => void;
}) {
  const { addClient, clients } = useData();
  const router = useRouter();
  const [form, setForm] = useState({
    lastName: "",
    firstName: "",
    middleName: "",
    phone: "",
    birthDate: "",
    passportSeries: "",
    passportNumber: "",
    issuedBy: "",
    issuedAt: "",
    registrationAddress: "",
    livingAddress: "",
    inn: "",
  });
  const [consent, setConsent] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstField.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Такой клиент уже есть? Предупреждаем, но не запрещаем: бывает, что
  // номер сменил владельца или паспорт введён с ошибкой
  const duplicates = findDuplicates(clients, form);

  const ready =
    form.lastName.trim() !== "" &&
    form.firstName.trim() !== "" &&
    form.phone.replace(/\D/g, "").length === 11;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || saving) return;

    setSaving(true);
    setError(null);
    let created;
    try {
      created = await addClient({
        lastName: form.lastName.trim(),
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim() || undefined,
        phone: form.phone,
        birthDate: form.birthDate || undefined,
        passportSeries: form.passportSeries.trim() || undefined,
        passportNumber: form.passportNumber.trim() || undefined,
        issuedBy: form.issuedBy.trim() || undefined,
        issuedAt: form.issuedAt || undefined,
        registrationAddress: form.registrationAddress.trim() || undefined,
        livingAddress: form.livingAddress.trim() || undefined,
        inn: form.inn.trim() || undefined,
        consent,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
      setSaving(false);
      return;
    }
    setSaved(true);
    onCreated?.(created);
    setTimeout(() => {
      onClose();
      // Если это не часть другого сценария (например, мастера сделки) —
      // сразу открываем карточку нового клиента, чтобы было видно результат
      if (!onCreated) router.push(`/clients/${created.id}`);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        aria-label="Закрыть окно"
        className="absolute inset-0 bg-scrim"
        onClick={onClose}
      />
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-client-title"
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-card bg-surface shadow-pop sm:rounded-card"
      >
        <header className="flex items-center justify-between border-b border-line px-6 py-5">
          <h2 id="new-client-title" className="text-lg font-semibold tracking-tight">
            Новый клиент
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-full p-2 text-mute hover:bg-canvas hover:text-ink"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex flex-col gap-7 overflow-y-auto px-6 py-5">
          <Section title="Основные данные">
            <Field label="Фамилия" required>
              <input
                ref={firstField}
                className={input}
                placeholder="Иванов"
                value={form.lastName}
                onChange={(e) => set("lastName")(e.target.value)}
              />
            </Field>
            <Field label="Имя" required>
              <input
                className={input}
                placeholder="Иван"
                value={form.firstName}
                onChange={(e) => set("firstName")(e.target.value)}
              />
            </Field>
            <Field label="Отчество">
              <input
                className={input}
                placeholder="Сергеевич"
                value={form.middleName}
                onChange={(e) => set("middleName")(e.target.value)}
              />
            </Field>
            <Field label="Телефон" required>
              <input
                className={input}
                inputMode="tel"
                placeholder="+7 (___) ___-__-__"
                value={form.phone}
                onChange={(e) => set("phone")(maskPhone(e.target.value))}
              />
            </Field>
            <Field label="Дата рождения">
              <input
                type="date"
                className={input}
                value={form.birthDate}
                onChange={(e) => set("birthDate")(e.target.value)}
              />
            </Field>
          </Section>

          <Section title="Паспортные данные">
            <Field label="Серия">
              <input
                className={input}
                inputMode="numeric"
                maxLength={4}
                placeholder="4510"
                value={form.passportSeries}
                onChange={(e) =>
                  set("passportSeries")(e.target.value.replace(/\D/g, ""))
                }
              />
            </Field>
            <Field label="Номер">
              <input
                className={input}
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={form.passportNumber}
                onChange={(e) =>
                  set("passportNumber")(e.target.value.replace(/\D/g, ""))
                }
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Кем выдан">
                <input
                  className={input}
                  placeholder="ОВД г. Москвы"
                  value={form.issuedBy}
                  onChange={(e) => set("issuedBy")(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Когда выдан">
              <input
                type="date"
                className={input}
                value={form.issuedAt}
                onChange={(e) => set("issuedAt")(e.target.value)}
              />
            </Field>
          </Section>

          <Section title="Адреса">
            <div className="sm:col-span-2">
              <Field label="Адрес прописки">
                <input
                  className={input}
                  placeholder="г. Москва, ул. Ленина 1, кв 5"
                  value={form.registrationAddress}
                  onChange={(e) => set("registrationAddress")(e.target.value)}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Адрес проживания">
                <input
                  className={input}
                  placeholder="г. Москва, ул. Тверская 10, кв 20"
                  value={form.livingAddress}
                  onChange={(e) => set("livingAddress")(e.target.value)}
                />
              </Field>
            </div>
            <Field label="ИНН">
              <input
                className={input}
                inputMode="numeric"
                maxLength={12}
                placeholder="500100123456"
                value={form.inn}
                onChange={(e) => set("inn")(e.target.value.replace(/\D/g, ""))}
              />
            </Field>
          </Section>

          <label className="flex items-start gap-3 rounded-[16px] border border-line bg-canvas px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand)]"
            />
            <span>
              <span className="font-medium">Клиент подписал согласие на обработку персональных данных</span>
              <span className="block text-mute">
                Бланк можно распечатать в карточке клиента после сохранения и отметить там же.
              </span>
            </span>
          </label>
        </div>

        {duplicates.length > 0 && (
          <div className="border-t border-warn/30 bg-warn-soft px-6 py-3 text-sm" role="alert">
            <p className="flex items-center gap-2 font-medium text-warn">
              <Users size={15} aria-hidden /> Похоже, такой клиент уже есть
            </p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {duplicates.slice(0, 3).map(({ client: c, reasons }) => (
                <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>
                    {c.name} · {c.id}
                    <span className="text-mute">
                      {" "}— совпадает {reasons.map((r) => (r === "phone" ? "телефон" : "паспорт")).join(" и ")}
                    </span>
                  </span>
                  {onCreated ? (
                    <button
                      type="button"
                      onClick={() => {
                        onCreated(c);
                        onClose();
                      }}
                      className="font-medium text-brand hover:underline"
                    >
                      Выбрать его
                    </button>
                  ) : (
                    <Link href={`/clients/${c.id}`} onClick={onClose} className="font-medium text-brand hover:underline">
                      Открыть карточку
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-6 py-4">
          <p
            className="mr-auto text-sm text-mute"
            role="status"
            aria-live="polite"
          >
            {error ? (
              <span className="text-danger">{error}</span>
            ) : saved ? (
              "Клиент создан"
            ) : saving ? (
              "Сохраняем…"
            ) : ready ? (
              "Можно сохранять"
            ) : (
              "Заполните фамилию, имя и телефон"
            )}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line px-4 py-2.5 text-sm font-medium text-mute hover:text-ink"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={!ready || saved || saving}
            className="rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-on-brand shadow-card transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-mute disabled:shadow-none"
          >
            {saved
              ? "Клиент создан"
              : saving
                ? "Сохраняем…"
                : duplicates.length > 0
                  ? "Всё равно создать"
                  : "Создать клиента"}
          </button>
        </footer>
      </form>
    </div>
  );
}

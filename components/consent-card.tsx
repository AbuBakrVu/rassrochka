"use client";

import { useEffect, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { FileSignature, Printer, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui";
import { useBrandName } from "@/components/branding";
import { useData } from "@/lib/store";
import { can } from "@/lib/permissions";
import type { Client } from "@/lib/data";

// Согласие на обработку персональных данных (152-ФЗ): отметка в карточке
// клиента и бланк для подписи. Онлайн-заявка (/apply) ставит отметку сама —
// клиент даёт согласие галочкой на странице заявки.

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

export default function ConsentCard({ client }: { client: Client }) {
  const { setClientConsent, user } = useData();
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const reset = () => setPrinting(false);
    window.addEventListener("afterprint", reset);
    return () => window.removeEventListener("afterprint", reset);
  }, []);

  if (!can(user, "clients.personal")) return null;

  const toggle = async (given: boolean) => {
    if (!given && !confirm("Снять отметку о согласии? Например, если клиент отозвал согласие.")) return;
    setBusy(true);
    try {
      await setClientConsent(client.id, given);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  };

  const print = () => {
    flushSync(() => setPrinting(true));
    window.print();
  };

  return (
    <Card className="p-5">
      <div className="mb-1 flex items-center gap-2">
        <FileSignature size={16} className="text-brand" aria-hidden />
        <h2 className="font-semibold">Согласие на обработку данных</h2>
      </div>
      {client.consentAt ? (
        <p className="mt-2 flex items-start gap-2 text-sm">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-good" aria-hidden />
          <span>
            Получено {dateLabel(client.consentAt)}
            <span className="text-mute">
              {client.consentSource === "online" ? " · галочкой в онлайн-заявке" : " · на бумаге"}
            </span>
          </span>
        </p>
      ) : (
        <p className="mt-2 flex items-start gap-2 text-sm text-warn">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          Нет отметки. Распечатайте бланк, дайте клиенту подписать и отметьте здесь.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={print}
          className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-medium text-mute hover:text-ink"
        >
          <Printer size={15} aria-hidden /> Бланк согласия
        </button>
        {client.consentAt ? (
          <button
            onClick={() => toggle(false)}
            disabled={busy}
            className="rounded-full px-3 py-2 text-sm text-mute hover:text-danger disabled:opacity-50"
          >
            Снять отметку
          </button>
        ) : (
          <button
            onClick={() => toggle(true)}
            disabled={busy}
            className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-on-brand shadow-card hover:bg-brand-deep disabled:opacity-50"
          >
            Клиент подписал
          </button>
        )}
      </div>
      {printing && createPortal(<ConsentPrint client={client} />, document.body)}
    </Card>
  );
}

/** Бланк согласия по ст. 9 152-ФЗ — виден только при печати. */
function ConsentPrint({ client }: { client: Client }) {
  const operator = useBrandName();
  const passport = [client.passportSeries, client.passportNumber].filter(Boolean).join(" ");
  const blank = "________________________";
  return (
    <div className="hidden bg-white p-10 text-[13px] leading-relaxed text-black print:block">
      <h1 className="mb-6 text-center text-base font-semibold">
        Согласие на обработку персональных данных
      </h1>
      <p>
        Я, <b>{client.name}</b>
        {client.birthDate ? `, ${client.birthDate} г. р.` : ""}, паспорт {passport || blank}
        {client.passportIssuedBy ? `, выдан ${client.passportIssuedBy}` : `, выдан ${blank}`}
        {client.passportIssuedAt ? ` ${client.passportIssuedAt}` : ""}, зарегистрирован(а) по адресу:{" "}
        {client.registrationAddress || blank},
      </p>
      <p className="mt-3">
        в соответствии со статьёй 9 Федерального закона от 27.07.2006 № 152-ФЗ «О персональных
        данных» свободно, своей волей и в своём интересе даю согласие <b>{operator}</b>, адрес:{" "}
        {blank}{blank} (далее — Оператор), на обработку моих персональных данных.
      </p>
      <p className="mt-3">
        <b>Цель обработки:</b> заключение и исполнение договора купли-продажи товара в рассрочку,
        учёт платежей, направление мне напоминаний и уведомлений по договору, связь со мной по
        вопросам договора.
      </p>
      <p className="mt-3">
        <b>Перечень данных:</b> фамилия, имя, отчество; дата рождения; паспортные данные; адрес
        регистрации и проживания; номер телефона; адрес электронной почты; ИНН; копии и фотографии
        документов, удостоверяющих личность; сведения о договорах и платежах.
      </p>
      <p className="mt-3">
        <b>Действия с данными:</b> сбор, запись, систематизация, накопление, хранение, уточнение
        (обновление, изменение), извлечение, использование, блокирование, удаление, уничтожение — с
        использованием средств автоматизации и без них. Передача третьим лицам — только в случаях,
        предусмотренных законодательством Российской Федерации.
      </p>
      <p className="mt-3">
        <b>Срок:</b> согласие действует до полного исполнения обязательств по договору и в течение
        5 (пяти) лет после этого либо до его отзыва. Согласие может быть отозвано мной письменным
        заявлением, направленным Оператору.
      </p>
      <p className="mt-3">
        Контактный телефон: {client.phone && client.phone !== "—" ? client.phone : blank}
      </p>
      <div className="mt-12 grid grid-cols-2 gap-10">
        <div>
          <div className="border-b border-black" style={{ height: 28 }} />
          <p className="mt-1 text-xs text-black/60">подпись / расшифровка</p>
        </div>
        <div>
          <div className="border-b border-black" style={{ height: 28 }} />
          <p className="mt-1 text-xs text-black/60">дата</p>
        </div>
      </div>
    </div>
  );
}

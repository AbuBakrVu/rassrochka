"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Package,
  SlidersHorizontal,
  User,
  ShieldCheck,
  Check,
  ArrowLeft,
  ArrowRight,
  Smartphone,
  Tv,
  BedDouble,
  Car,
  Shirt,
  Hammer,
  BriefcaseMedical,
  GraduationCap,
  MoreHorizontal,
  MapPin,
  ImagePlus,
  Trash2,
  Wallet,
  Search,
  UserPlus,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";
import { seedEmployees, type Client } from "@/lib/data";
import { todayIso } from "@/lib/derive";
import { useData } from "@/lib/store";
import { cashBalance } from "@/lib/cash";
import NewClientModal from "@/components/new-client-modal";

const steps = [
  { key: "product", title: "Товар", icon: Package },
  { key: "terms", title: "Условия", icon: SlidersHorizontal },
  { key: "client", title: "Клиент", icon: User },
  { key: "review", title: "Обзор", icon: ShieldCheck },
] as const;

const categories: { label: string; icon: LucideIcon }[] = [
  { label: "Электроника", icon: Smartphone },
  { label: "Бытовая техника", icon: Tv },
  { label: "Мебель", icon: BedDouble },
  { label: "Авто", icon: Car },
  { label: "Одежда", icon: Shirt },
  { label: "Стройматериалы", icon: Hammer },
  { label: "Медицина", icon: BriefcaseMedical },
  { label: "Образование", icon: GraduationCap },
  { label: "Другое", icon: MoreHorizontal },
];

const cities = [
  "Москва",
  "Санкт-Петербург",
  "Казань",
  "Екатеринбург",
  "Новосибирск",
  "Краснодар",
  "Грозный",
];

const terms = [3, 4, 6, 9, 12, 18, 24];

const input =
  "w-full rounded-[10px] border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand focus:bg-surface";

const money = (n: number) =>
  new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₽";

const longDate = (iso: string) =>
  iso
    ? new Date(iso).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

const addMonth = (iso: string) => {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
};

function Label({
  children,
  required,
  hint,
}: {
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <span className="mb-1.5 flex items-baseline gap-2">
      <span className="text-sm font-medium">
        {children}
        {required && (
          <span className="ml-1 text-danger" aria-hidden>
            *
          </span>
        )}
      </span>
      {hint && <span className="text-xs text-mute">{hint}</span>}
    </span>
  );
}

function StepHead({
  icon: Icon,
  title,
  text,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-brand-soft text-brand">
        <Icon size={19} aria-hidden />
      </span>
      <div>
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        <p className="text-sm text-mute">{text}</p>
      </div>
    </div>
  );
}

export default function NewDealModal({ onClose }: { onClose: () => void }) {
  const { clients, cash, cashOpeningBalance, addDeal } = useData();
  const cashNow = cashBalance(cashOpeningBalance, cash);
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [created, setCreated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientFormOpen, setClientFormOpen] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [photos, setPhotos] = useState<{ url: string; name: string }[]>([]);

  const [price, setPrice] = useState("");
  const [markup, setMarkup] = useState("15");
  const [downMode, setDownMode] = useState<"percent" | "rub">("rub");
  const [down, setDown] = useState("");
  const [months, setMonths] = useState(6);
  const [dealDate, setDealDate] = useState(todayIso());
  const [firstPayment, setFirstPayment] = useState("");
  const [manager, setManager] = useState(seedEmployees[0].id);

  const [clientQuery, setClientQuery] = useState("");
  const [client, setClient] = useState<Client | null>(null);
  const [guarantors, setGuarantors] = useState<string[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !clientFormOpen) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, clientFormOpen]);

  useEffect(
    () => () => photos.forEach((p) => URL.revokeObjectURL(p.url)),
    [photos]
  );

  const calc = useMemo(() => {
    const base = Number(price) || 0;
    const markupPct = Number(markup) || 0;
    const markupSum = (base * markupPct) / 100;
    const total = base + markupSum;
    const downSum =
      downMode === "percent"
        ? (total * (Number(down) || 0)) / 100
        : Number(down) || 0;
    const financed = Math.max(total - downSum, 0);
    return {
      base,
      markupPct,
      markupSum,
      total,
      downSum,
      financed,
      monthly: months ? financed / months : 0,
      roi: base ? (markupSum / base) * 100 : 0,
      cashAfter: cashNow - base + downSum,
    };
  }, [price, markup, down, downMode, months, cashNow]);

  const firstDate = firstPayment || (dealDate ? addMonth(dealDate) : "");

  const stepReady = [
    name.trim() !== "" && category !== "" && city !== "",
    calc.base > 0 && months > 0 && dealDate !== "",
    client !== null,
    true,
  ];

  const found = clients.filter((c) =>
    (c.name + c.phone).toLowerCase().includes(clientQuery.trim().toLowerCase())
  );

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files)
      .slice(0, 8 - photos.length)
      .map((f) => ({ url: URL.createObjectURL(f), name: f.name }));
    setPhotos((p) => [...p, ...next]);
  };

  const create = async () => {
    if (!client || saving) return;

    setSaving(true);
    setError(null);
    let deal;
    try {
      deal = await addDeal({
        product: name,
        amount: Math.round(calc.financed),
        months,
        openedAt: dealDate,
        clientId: client.id,
        clientName: client.name,
        manager,
        markupPct: calc.markupPct,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать сделку");
      setSaving(false);
      return;
    }
    setCreated(true);
    setTimeout(() => {
      onClose();
      router.push(`/deals/${deal.id}`);
    }, 1400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-4 lg:p-6">
      <button
        aria-label="Закрыть окно"
        className="absolute inset-0 bg-ink/35"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-deal-title"
        className="relative flex h-full w-full max-w-6xl flex-col overflow-hidden bg-surface shadow-pop sm:h-[92vh] sm:rounded-card"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-7">
          <div>
            <h2
              id="new-deal-title"
              className="text-lg font-semibold tracking-tight"
            >
              Новая сделка
            </h2>
            <p className="text-sm text-mute">
              Шаг {step + 1} из 4 · {steps[step].title}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-[10px] p-2 text-mute hover:bg-canvas hover:text-ink"
          >
            <X size={18} />
          </button>
        </header>

        {/* Шаги */}
        <nav
          className="border-b border-line bg-canvas px-5 py-3 sm:px-7"
          aria-label="Этапы создания сделки"
        >
          <ol className="flex items-center gap-1 overflow-x-auto">
            {steps.map((s, i) => {
              const done = i < step;
              const current = i === step;
              return (
                <li
                  key={s.key}
                  className="flex min-w-0 items-center sm:flex-1"
                >
                  <button
                    onClick={() => i < step && setStep(i)}
                    disabled={i > step}
                    aria-current={current ? "step" : undefined}
                    className={`flex min-w-0 items-center gap-2 rounded-[10px] px-2 py-1.5 text-sm whitespace-nowrap ${
                      i < step ? "hover:bg-surface" : "cursor-default"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        done
                          ? "bg-brand-soft text-brand-deep"
                          : current
                            ? "bg-brand text-white"
                            : "bg-line text-mute"
                      }`}
                    >
                      {done ? <Check size={14} aria-hidden /> : i + 1}
                    </span>
                    <span
                      className={`truncate ${
                        current
                          ? "font-medium text-ink"
                          : done
                            ? "hidden text-brand-deep sm:inline"
                            : "hidden text-mute sm:inline"
                      }`}
                    >
                      {s.title}
                    </span>
                  </button>
                  {i < steps.length - 1 && (
                    <span
                      className={`mx-1 hidden h-px flex-1 sm:block ${
                        i < step ? "bg-brand" : "bg-line"
                      }`}
                      aria-hidden
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_320px]">
          {/* Форма */}
          <div className="min-h-0 overflow-y-auto px-5 py-6 sm:px-7">
            {step === 0 && (
              <>
                <StepHead
                  icon={Package}
                  title="Информация о товаре"
                  text="Что покупает клиент и где оформляется сделка"
                />
                <div className="flex flex-col gap-5">
                  <label className="block">
                    <Label required>Название товара</Label>
                    <input
                      autoFocus
                      className={input}
                      placeholder="iPhone 15 Pro Max 256 ГБ"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>

                  <label className="block">
                    <Label hint="необязательно">Описание</Label>
                    <textarea
                      rows={3}
                      className={`${input} resize-y`}
                      placeholder="Комплектация, состояние, серийный номер"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </label>

                  <div>
                    <Label required>Категория</Label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {categories.map(({ label, icon: Icon }) => {
                        const on = category === label;
                        return (
                          <button
                            key={label}
                            onClick={() => setCategory(label)}
                            aria-pressed={on}
                            className={`flex items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-left text-sm transition-colors ${
                              on
                                ? "border-brand bg-brand-soft font-medium text-brand-deep"
                                : "border-line bg-canvas text-mute hover:border-brand/40 hover:text-ink"
                            }`}
                          >
                            <Icon
                              size={16}
                              className={on ? "text-brand" : ""}
                              aria-hidden
                            />
                            <span className="truncate">{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <label className="block">
                    <Label required>Город</Label>
                    <div className="relative">
                      <MapPin
                        size={16}
                        className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-mute"
                        aria-hidden
                      />
                      <select
                        className={`${input} appearance-none pl-10`}
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      >
                        <option value="">Выберите город</option>
                        {cities.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </label>

                  <div>
                    <Label hint={`${photos.length} из 8`}>Фото товара</Label>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {photos.map((p, i) => (
                        <div
                          key={p.url}
                          className="group relative aspect-square overflow-hidden rounded-[10px] border border-line"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.url}
                            alt={p.name}
                            className="h-full w-full object-cover"
                          />
                          <button
                            onClick={() =>
                              setPhotos((s) => s.filter((_, j) => j !== i))
                            }
                            aria-label={`Удалить фото ${p.name}`}
                            className="absolute top-1 right-1 rounded-lg bg-surface/90 p-1 text-danger opacity-0 group-hover:opacity-100 focus:opacity-100"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                      {photos.length < 8 && (
                        <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-line bg-canvas text-mute transition-colors hover:border-brand hover:text-brand">
                          <ImagePlus size={18} aria-hidden />
                          <span className="text-[11px]">Добавить</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="sr-only"
                            onChange={(e) => addPhotos(e.target.files)}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <StepHead
                  icon={SlidersHorizontal}
                  title="Условия рассрочки"
                  text="Цена, наценка и график — расчёт справа обновляется сразу"
                />
                <div className="flex flex-col gap-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="block">
                      <Label required>Закупочная цена</Label>
                      <div className="relative">
                        <input
                          autoFocus
                          inputMode="numeric"
                          className={`${input} pr-9`}
                          placeholder="50 000"
                          value={price}
                          onChange={(e) =>
                            setPrice(e.target.value.replace(/\D/g, ""))
                          }
                        />
                        <span className="absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-mute">
                          ₽
                        </span>
                      </div>
                    </label>
                    <label className="block">
                      <Label>Наценка</Label>
                      <div className="relative">
                        <input
                          inputMode="decimal"
                          className={`${input} pr-9`}
                          value={markup}
                          onChange={(e) =>
                            setMarkup(e.target.value.replace(/[^\d.]/g, ""))
                          }
                        />
                        <span className="absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-mute">
                          %
                        </span>
                      </div>
                    </label>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <Label hint="необязательно">Первоначальный взнос</Label>
                      <div
                        className="flex rounded-[10px] border border-line bg-canvas p-0.5"
                        role="group"
                        aria-label="Единица взноса"
                      >
                        {(
                          [
                            ["rub", "₽"],
                            ["percent", "%"],
                          ] as const
                        ).map(([k, l]) => (
                          <button
                            key={k}
                            onClick={() => setDownMode(k)}
                            aria-pressed={downMode === k}
                            className={`rounded-lg px-3 py-1 text-sm ${
                              downMode === k
                                ? "bg-surface font-medium text-brand-deep shadow-card"
                                : "text-mute"
                            }`}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        inputMode="numeric"
                        className={`${input} pr-9`}
                        placeholder="0"
                        value={down}
                        onChange={(e) =>
                          setDown(e.target.value.replace(/\D/g, ""))
                        }
                      />
                      <span className="absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-mute">
                        {downMode === "rub" ? "₽" : "%"}
                      </span>
                    </div>
                    {calc.downSum > 0 && (
                      <p className="mt-1.5 text-xs text-mute">
                        В рассрочку уйдёт {money(calc.financed)}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label required>Срок рассрочки</Label>
                    <div className="flex flex-wrap gap-2">
                      {terms.map((t) => (
                        <button
                          key={t}
                          onClick={() => setMonths(t)}
                          aria-pressed={months === t}
                          className={`rounded-full px-4 py-2 text-sm transition-colors ${
                            months === t
                              ? "bg-brand font-medium text-white"
                              : "border border-line bg-canvas text-mute hover:text-ink"
                          }`}
                        >
                          {t} мес
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="block">
                      <Label required>Дата заключения</Label>
                      <input
                        type="date"
                        className={input}
                        value={dealDate}
                        onChange={(e) => setDealDate(e.target.value)}
                      />
                    </label>
                    <label className="block">
                      <Label hint="по умолчанию через месяц">
                        Первый платёж
                      </Label>
                      <input
                        type="date"
                        className={input}
                        value={firstPayment}
                        onChange={(e) => setFirstPayment(e.target.value)}
                      />
                    </label>
                  </div>

                  <div className="flex items-center gap-2.5 rounded-[12px] bg-brand-soft px-4 py-3 text-sm">
                    <CalendarDays
                      size={16}
                      className="shrink-0 text-brand"
                      aria-hidden
                    />
                    <p className="text-brand-deep">
                      Первый платёж — {longDate(firstDate)}, далее ежемесячно
                      {months ? `, всего ${months} платежей` : ""}.
                    </p>
                  </div>

                  <div>
                    <Label>Касса</Label>
                    <div className="flex items-center justify-between rounded-[12px] border border-line bg-canvas px-4 py-3">
                      <span className="flex items-center gap-2.5 text-sm font-medium">
                        <Wallet size={16} className="text-brand" aria-hidden />
                        Основная
                      </span>
                      <span className="text-sm text-mute">
                        Баланс {money(cashNow)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <Label required>Ответственный</Label>
                    <div className="flex flex-wrap gap-2">
                      {seedEmployees.map((e) => (
                        <button
                          key={e.id}
                          onClick={() => setManager(e.id)}
                          aria-pressed={manager === e.id}
                          className={`flex items-center gap-2 rounded-[10px] border px-3 py-2.5 text-left text-sm transition-colors ${
                            manager === e.id
                              ? "border-brand bg-brand-soft font-medium text-brand-deep"
                              : "border-line bg-canvas text-mute hover:border-brand/40 hover:text-ink"
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                              manager === e.id
                                ? "bg-brand text-white"
                                : "bg-surface text-mute"
                            }`}
                          >
                            {e.id}
                          </span>
                          {e.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <StepHead
                  icon={User}
                  title="Клиент и поручители"
                  text="Найдите клиента в базе или заведите нового"
                />
                <div className="flex flex-col gap-5">
                  <div>
                    <Label required>Клиент</Label>
                    {client ? (
                      <div className="flex items-center gap-3 rounded-[12px] border border-brand bg-brand-soft px-4 py-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
                          {client.name
                            .split(" ")
                            .map((w) => w[0])
                            .join("")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {client.name}
                          </p>
                          <p className="truncate text-xs text-mute">
                            {client.phone} · {client.statusLabel}
                          </p>
                        </div>
                        <button
                          onClick={() => setClient(null)}
                          className="text-sm font-medium text-brand-deep hover:underline"
                        >
                          Заменить
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <Search
                            size={16}
                            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-mute"
                            aria-hidden
                          />
                          <input
                            autoFocus
                            className={`${input} pl-10`}
                            placeholder="Поиск по имени или телефону"
                            value={clientQuery}
                            onChange={(e) => setClientQuery(e.target.value)}
                          />
                        </div>
                        <ul className="mt-2 max-h-56 divide-y divide-line overflow-y-auto rounded-[12px] border border-line">
                          {found.length === 0 ? (
                            <li className="px-4 py-6 text-center text-sm text-mute">
                              Никого не нашли. Заведите нового клиента ниже.
                            </li>
                          ) : (
                            found.map((c) => (
                              <li key={c.id}>
                                <button
                                  onClick={() => setClient(c)}
                                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-canvas"
                                >
                                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-deep">
                                    {c.name
                                      .split(" ")
                                      .map((w) => w[0])
                                      .join("")}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium">
                                      {c.name}
                                    </span>
                                    <span className="block truncate text-xs text-mute">
                                      {c.phone}
                                    </span>
                                  </span>
                                </button>
                              </li>
                            ))
                          )}
                        </ul>
                      </>
                    )}
                  </div>

                  <div>
                    <Label hint="до 5, необязательно">Поручители</Label>
                    <div className="flex flex-wrap gap-2">
                      {guarantors.map((g) => (
                        <span
                          key={g}
                          className="flex items-center gap-2 rounded-full border border-line bg-canvas py-1.5 pr-2 pl-3 text-sm"
                        >
                          {g}
                          <button
                            onClick={() =>
                              setGuarantors((s) => s.filter((x) => x !== g))
                            }
                            aria-label={`Убрать поручителя ${g}`}
                            className="text-mute hover:text-danger"
                          >
                            <X size={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                    {guarantors.length < 5 && (
                      <select
                        className={`${input} mt-2`}
                        value=""
                        onChange={(e) =>
                          e.target.value &&
                          setGuarantors((s) => [...s, e.target.value])
                        }
                      >
                        <option value="">Добавить поручителя</option>
                        {clients
                          .filter(
                            (c) =>
                              c.name !== client?.name &&
                              !guarantors.includes(c.name)
                          )
                          .map((c) => (
                            <option key={c.id} value={c.name}>
                              {c.name} · {c.phone}
                            </option>
                          ))}
                      </select>
                    )}
                    <p className="mt-1.5 text-xs text-mute">
                      Первый в списке считается основным поручителем.
                    </p>
                  </div>

                  <button
                    onClick={() => setClientFormOpen(true)}
                    className="flex items-center gap-3 rounded-[12px] border border-dashed border-line px-4 py-3.5 text-left transition-colors hover:border-brand hover:bg-brand-soft"
                  >
                    <UserPlus size={18} className="text-brand" aria-hidden />
                    <span>
                      <span className="block text-sm font-medium text-brand-deep">
                        Создать нового клиента
                      </span>
                      <span className="block text-xs text-mute">
                        Если клиента нет в базе — заполните паспортные данные
                      </span>
                    </span>
                  </button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <StepHead
                  icon={ShieldCheck}
                  title="Обзор сделки"
                  text="Проверьте данные перед созданием"
                />
                <div className="flex flex-col gap-4">
                  <div className="rounded-[12px] border border-line">
                    <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
                      <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-brand-soft text-brand">
                        <Package size={18} aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{name}</p>
                        <p className="truncate text-sm text-mute">
                          {category} · {city}
                        </p>
                      </div>
                    </div>
                    <dl className="divide-y divide-line text-sm">
                      {[
                        ["Закупочная цена", money(calc.base)],
                        [
                          `Наценка ${calc.markupPct}%`,
                          `+${money(calc.markupSum)}`,
                        ],
                        ["Первоначальный взнос", money(calc.downSum)],
                        ["Итоговая цена", money(calc.total)],
                      ].map(([k, v]) => (
                        <div
                          key={k}
                          className="flex items-center justify-between px-4 py-2.5"
                        >
                          <dt className="text-mute">{k}</dt>
                          <dd className="font-medium">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  <div className="rounded-[12px] border border-line px-4 py-3.5">
                    <p className="text-sm text-mute">Клиент</p>
                    <p className="mt-0.5 font-medium">{client?.name}</p>
                    <p className="text-sm text-mute">{client?.phone}</p>
                    {guarantors.length > 0 && (
                      <p className="mt-2 text-sm text-mute">
                        Поручители: {guarantors.join(", ")}
                      </p>
                    )}
                    <p className="mt-2 text-sm text-mute">
                      Ответственный:{" "}
                      {seedEmployees.find((e) => e.id === manager)?.name}
                    </p>
                  </div>

                  <div className="flex gap-3 rounded-[12px] bg-brand-soft px-4 py-3.5">
                    <ShieldCheck
                      size={18}
                      className="mt-0.5 shrink-0 text-brand"
                      aria-hidden
                    />
                    <p className="text-sm text-brand-deep">
                      После создания сформируется график из {months} платежей по{" "}
                      {money(calc.monthly)}. Первый — {longDate(firstDate)}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Превью расчёта */}
          <aside
            className={`order-first border-b border-line bg-canvas px-5 py-4 lg:order-last lg:block lg:overflow-y-auto lg:border-b-0 lg:border-l lg:px-5 lg:py-6 ${
              calc.total > 0 ? "" : "hidden"
            }`}
          >
            <h3 className="mb-3 hidden text-xs font-semibold tracking-wide text-mute uppercase lg:block">
              Превью сделки
            </h3>

            <div className="hidden lg:block">
              <p className="font-medium break-words">
                {name || <span className="text-mute">Название товара</span>}
              </p>
              <p className="mt-0.5 text-sm text-mute">
                {[category, city].filter(Boolean).join(" · ") ||
                  "Категория и город"}
              </p>
            </div>

            <dl className="mt-4 hidden gap-2 text-sm lg:grid">
              <div className="flex justify-between">
                <dt className="text-mute">Закупочная цена</dt>
                <dd className="font-medium">{money(calc.base)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-mute">Наценка</dt>
                <dd className="font-medium text-good">
                  +{money(calc.markupSum)}
                </dd>
              </div>
              {calc.downSum > 0 && (
                <div className="flex justify-between">
                  <dt className="text-mute">Взнос</dt>
                  <dd className="font-medium">−{money(calc.downSum)}</dd>
                </div>
              )}
              <div className="mt-1 flex justify-between border-t border-line pt-2">
                <dt className="font-medium">Итоговая цена</dt>
                <dd className="font-semibold">{money(calc.total)}</dd>
              </div>
            </dl>

            <div className="mt-4 flex items-center justify-between rounded-[12px] bg-brand px-4 py-3.5 text-white lg:block lg:py-4 lg:text-center">
              <p className="text-xs tracking-wide text-white/80 uppercase">
                Ежемесячный платёж
              </p>
              <p className="text-xl font-semibold lg:mt-1 lg:text-[28px]">
                {calc.monthly ? `≈ ${money(calc.monthly)}` : "—"}
              </p>
              <p className="hidden text-sm text-white/80 lg:block">
                {months} месяцев · равные платежи
              </p>
            </div>

            <div className="mt-3 hidden grid-cols-2 gap-3 lg:grid">
              <div className="rounded-[12px] border border-line bg-surface px-3 py-3 text-center">
                <p className="text-xs text-mute">Прибыль</p>
                <p className="mt-0.5 font-semibold text-good">
                  {money(calc.markupSum)}
                </p>
              </div>
              <div className="rounded-[12px] border border-line bg-surface px-3 py-3 text-center">
                <p className="text-xs text-mute">Доходность</p>
                <p className="mt-0.5 font-semibold">
                  {calc.roi.toFixed(1).replace(".", ",")}%
                </p>
              </div>
            </div>

            <dl className="mt-3 hidden gap-2 text-sm lg:grid">
              <div className="flex justify-between">
                <dt className="text-mute">Касса после сделки</dt>
                <dd
                  className={`font-medium ${
                    calc.cashAfter < 0 ? "text-danger" : ""
                  }`}
                >
                  {money(calc.cashAfter)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-mute">Дата сделки</dt>
                <dd className="font-medium">{longDate(dealDate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-mute">Первый платёж</dt>
                <dd className="font-medium">{longDate(firstDate)}</dd>
              </div>
              {client && (
                <div className="flex justify-between">
                  <dt className="text-mute">Клиент</dt>
                  <dd className="truncate pl-2 font-medium">{client.name}</dd>
                </div>
              )}
            </dl>
          </aside>
        </div>

        <footer className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4 sm:px-7">
          <p className="mr-auto text-sm text-mute" role="status" aria-live="polite">
            {error ? (
              <span className="text-danger">{error}</span>
            ) : created ? (
              "Сделка создана"
            ) : saving ? (
              "Сохраняем…"
            ) : (
              stepReady[step]
                ? step === 3
                  ? "Всё готово к созданию"
                  : "Можно продолжать"
                : [
                    "Заполните название, категорию и город",
                    "Укажите закупочную цену и срок",
                    "Выберите клиента",
                    "",
                  ][step]
            )}
          </p>
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-1.5 rounded-[10px] border border-line px-4 py-2.5 text-sm font-medium text-mute hover:text-ink"
            >
              <ArrowLeft size={15} aria-hidden /> Назад
            </button>
          )}
          {step < 3 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!stepReady[step]}
              className="flex items-center gap-1.5 rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-card transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-mute disabled:shadow-none"
            >
              Далее <ArrowRight size={15} aria-hidden />
            </button>
          ) : (
            <button
              onClick={create}
              disabled={created || saving}
              className="flex items-center gap-1.5 rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-card transition-colors hover:bg-brand-deep disabled:bg-line disabled:text-mute"
            >
              <Check size={15} aria-hidden />
              {created ? "Сделка создана" : saving ? "Сохраняем…" : "Создать сделку"}
            </button>
          )}
        </footer>
      </div>

      {clientFormOpen && (
        <NewClientModal
          onClose={() => setClientFormOpen(false)}
          onCreated={(c) => setClient(c)}
        />
      )}
    </div>
  );
}

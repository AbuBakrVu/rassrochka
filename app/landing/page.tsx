import type { Metadata } from "next";
import Link from "next/link";
import {
  Zap,
  ArrowRight,
  KanbanSquare,
  CalendarDays,
  PhoneCall,
  Wallet,
  BarChart3,
  Handshake,
  Globe,
  Link2,
  UserCog,
  FileSpreadsheet,
  Palette,
  ShieldCheck,
  Database,
  ScrollText,
  Check,
} from "lucide-react";
import LandingLeadForm from "@/components/landing-lead-form";

// Лендинг CRM для корневого домена. Middleware переписывает сюда «/» на
// корне; на поддомене компании этот адрес уводит на её главную.

export const metadata: Metadata = {
  title: "Nasiya — CRM для бизнеса рассрочки",
  description:
    "Сделки, графики платежей, просрочки, кассы и аналитика в одном месте. CRM для компаний, которые продают товары в рассрочку.",
};

const features = [
  {
    icon: KanbanSquare,
    title: "Сделки и графики",
    text: "Канбан от заявки до выдачи. Мастер сделки сам считает наценку, первый взнос и график равных платежей.",
  },
  {
    icon: CalendarDays,
    title: "Платежи",
    text: "Календарь поступлений и повестка на день. Принятый платёж сразу закрывает взнос и попадает в кассу.",
  },
  {
    icon: PhoneCall,
    title: "Работа с долгом",
    text: "Лестница просрочки 1–7 / 8–30 / 30+ дней, очередь звонков, маршрут менеджера и рассылки по шаблонам.",
  },
  {
    icon: Wallet,
    title: "Финансы",
    text: "Кассы и филиалы: выдача товара списывает закупку, оплата возвращает деньги. Остаток всегда настоящий.",
  },
  {
    icon: BarChart3,
    title: "Аналитика",
    text: "Прибыль, план сборов, качество портфеля, воронка и причины отказов, нагрузка по сотрудникам.",
  },
  {
    icon: Handshake,
    title: "Соинвесторы",
    text: "Учёт вложений партнёров и начислений им. У каждого — личная ссылка со своими суммами.",
  },
  {
    icon: Globe,
    title: "Онлайн-заявка",
    text: "Калькулятор рассрочки для вашего сайта: кнопка «Купить в рассрочку» у товара — и заявка уже в CRM.",
  },
  {
    icon: Link2,
    title: "Кабинет клиента",
    text: "Клиент открывает личную ссылку и видит график, остаток и квитанции — меньше звонков «сколько мне платить».",
  },
  {
    icon: UserCog,
    title: "Сотрудники и роли",
    text: "Каждый видит только свои разделы и сделки. Журнал действий показывает, кто и что менял.",
  },
] as const;

const steps = [
  { title: "Оставляете заявку", text: "Созваниваемся, показываем CRM и отвечаем на вопросы." },
  {
    title: "Заводим вашу компанию",
    text: "Свой адрес вида компания.домен, отдельная база данных, ваш логотип и цвет.",
  },
  {
    title: "Переносим данные",
    text: "Клиентов и сделки загружаем из Excel — работаете с первого дня, без ручного ввода.",
  },
] as const;

const faq = [
  {
    q: "Подойдёт ли небольшой компании?",
    a: "Да, CRM делалась именно для небольших компаний: несколько сотрудников, один или пара филиалов. Ничего настраивать неделями не нужно.",
  },
  {
    q: "У нас всё в Excel. Как перенести?",
    a: "Есть импорт из Excel: клиенты, сделки и уже внесённые платежи. Дубликаты клиентов CRM находит сама.",
  },
  {
    q: "Кто видит наши данные?",
    a: "Только ваши сотрудники. У каждой компании отдельная база данных, а права сотрудников настраиваются по ролям.",
  },
  {
    q: "Работает ли с телефона?",
    a: "Да, все разделы адаптированы под телефон — менеджеру удобно принимать платежи и звонить должникам в дороге.",
  },
] as const;

/** Значок-логотип, как на странице выбора компании. */
function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-brand text-on-brand">
        <Zap size={18} aria-hidden />
      </span>
      <span className="font-semibold tracking-tight">Nasiya</span>
    </span>
  );
}

/** Схематичная главная CRM для первого экрана — не скриншот, а вёрстка. */
function HeroPreview() {
  const bars = [42, 64, 38, 80, 56, 92, 48, 70, 60, 86, 52, 74];
  const rows = [
    { name: "Котова А.", what: "Смартфон · 4 из 6", tone: "good", label: "В графике" },
    { name: "Ибрагимов Р.", what: "Холодильник · 2 из 10", tone: "warn", label: "Сегодня" },
    { name: "Саидова М.", what: "Ноутбук · 3 из 8", tone: "danger", label: "12 дн." },
  ] as const;
  const tones = {
    good: "bg-good-soft text-good",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
  };
  return (
    <div aria-hidden className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[40px] bg-brand-soft blur-2xl" />
      <div className="rounded-card border border-line bg-surface p-5 shadow-pop sm:p-6">
        <div className="grid grid-cols-3 gap-3">
          {[
            ["Портфель", "4,8 млн"],
            ["Собрано за месяц", "1,2 млн"],
            ["Просрочка", "3,1 %"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-[16px] bg-canvas p-3">
              <p className="truncate text-[11px] text-mute">{k}</p>
              <p className="mt-1 text-base font-semibold tracking-tight sm:text-lg">{v}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-xs font-medium text-mute">План поступлений</p>
        <div className="mt-2 flex h-24 items-end gap-1.5">
          {bars.map((h, i) => (
            <span
              key={i}
              className={`flex-1 rounded-t-[6px] ${i === 5 ? "bg-brand" : "bg-brand-soft"}`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <ul className="mt-5 divide-y divide-line border-t border-line">
          {rows.map((r) => (
            <li key={r.name} className="flex items-center gap-3 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-deep">
                {r.name.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{r.name}</span>
                <span className="block truncate text-xs text-mute">{r.what}</span>
              </span>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${tones[r.tone]}`}>
                {r.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-medium text-on-brand shadow-card transition-colors hover:bg-brand-deep";
const ghostBtn =
  "inline-flex items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 py-3 text-sm font-medium transition-colors hover:border-brand hover:text-brand-deep";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm text-mute md:flex">
            <a href="#features" className="hover:text-ink">Возможности</a>
            <a href="#start" className="hover:text-ink">Подключение</a>
            <a href="#faq" className="hover:text-ink">Вопросы</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/company" className="rounded-full px-4 py-2 text-sm font-medium hover:bg-surface">
              Войти
            </Link>
            <a href="#lead" className={`${primaryBtn} px-4 py-2`}>
              Оставить заявку
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* Первый экран */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
          <div>
            <p className="mb-4 inline-flex rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand-deep">
              CRM для бизнеса рассрочки
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Все рассрочки, платежи и просрочки — в одном окне
            </h1>
            <p className="mt-5 max-w-xl text-lg text-mute">
              Nasiya заменяет тетрадь и Excel: считает графики, напоминает, кому звонить сегодня,
              ведёт кассу и показывает, сколько компания на самом деле заработала.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#lead" className={primaryBtn}>
                Попробовать <ArrowRight size={15} aria-hidden />
              </a>
              <a href="#features" className={ghostBtn}>
                Что умеет CRM
              </a>
            </div>
            <ul className="mt-8 grid gap-2 text-sm text-mute sm:grid-cols-2">
              {["Отдельная база для каждой компании", "Импорт клиентов из Excel", "Работает с телефона", "Ваш логотип и цвета"].map(
                (t) => (
                  <li key={t} className="flex items-center gap-2">
                    <Check size={16} className="shrink-0 text-brand" aria-hidden />
                    {t}
                  </li>
                )
              )}
            </ul>
          </div>
          <HeroPreview />
        </section>

        {/* Возможности */}
        <section id="features" className="scroll-mt-20 border-y border-line bg-surface py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight">Всё, что нужно компании рассрочки</h2>
              <p className="mt-3 text-mute">
                От первой заявки до последнего платежа — без таблиц, сверок и потерянных должников.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, text }) => (
                <article key={title} className="rounded-card border border-line bg-canvas p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-brand-soft text-brand-deep">
                    <Icon size={20} aria-hidden />
                  </span>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-mute">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Безопасность */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: Database, title: "Своя база данных", text: "Данные каждой компании хранятся отдельно и никогда не смешиваются с чужими." },
              { icon: ShieldCheck, title: "Права по ролям", text: "Кассир не видит аналитику, менеджер — чужие сделки. Решаете вы." },
              { icon: ScrollText, title: "Журнал действий", text: "Каждое изменение записано: кто, когда и что сделал со сделкой или платежом." },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-4 rounded-card bg-surface p-6 shadow-card">
                <Icon size={22} className="mt-0.5 shrink-0 text-brand" aria-hidden />
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-mute">{text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="flex gap-4 rounded-card bg-surface p-6 shadow-card">
              <FileSpreadsheet size={22} className="mt-0.5 shrink-0 text-brand" aria-hidden />
              <div>
                <h3 className="font-semibold">Переезд из Excel за вечер</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-mute">
                  Загрузите таблицу — CRM разберёт клиентов, сделки и платежи и покажет, что не сошлось.
                </p>
              </div>
            </div>
            <div className="flex gap-4 rounded-card bg-surface p-6 shadow-card">
              <Palette size={22} className="mt-0.5 shrink-0 text-brand" aria-hidden />
              <div>
                <h3 className="font-semibold">Под вашим брендом</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-mute">
                  Логотип и фирменный цвет — в CRM, кабинете клиента и онлайн-заявке.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Подключение */}
        <section id="start" className="scroll-mt-20 border-y border-line bg-surface py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight">Как подключиться</h2>
            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s.title} className="rounded-card border border-line bg-canvas p-6">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-semibold text-on-brand">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-mute">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Вопросы и заявка */}
        <section className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div id="faq" className="scroll-mt-20">
            <h2 className="text-3xl font-semibold tracking-tight">Частые вопросы</h2>
            <div className="mt-8 divide-y divide-line border-y border-line">
              {faq.map(({ q, a }) => (
                <details key={q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                    {q}
                    <span className="text-xl leading-none text-mute transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-mute">{a}</p>
                </details>
              ))}
            </div>
          </div>
          <div id="lead" className="scroll-mt-20 rounded-card border border-line bg-surface p-6 shadow-pop sm:p-8">
            <h2 className="text-2xl font-semibold tracking-tight">Оставьте заявку</h2>
            <p className="mt-2 mb-6 text-sm text-mute">
              Покажем CRM и поможем перенести ваши данные.
            </p>
            <LandingLeadForm />
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-mute sm:flex-row sm:px-6">
          <Logo />
          <p>© {new Date().getFullYear()} Nasiya · CRM для учёта рассрочек</p>
          <Link href="/company" className="hover:text-ink">Вход для компаний</Link>
        </div>
      </footer>
    </div>
  );
}

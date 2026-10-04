"use client";

// Импорт клиентов и сделок из Excel: файл → сопоставление колонок →
// предпросмотр с ошибками по строкам → перенос одной транзакцией.

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Info,
  RotateCcw,
  Upload,
  XCircle,
} from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import { useData, type ImportResult } from "@/lib/store";
import { can } from "@/lib/permissions";
import { checkRow, clientKey, detectColumns, IMPORT_FIELDS, MAX_IMPORT_ROWS, type ImportField } from "@/lib/import";
import { readSheet, type SheetCell } from "@/lib/sheet-reader";
import { downloadCsv } from "@/lib/csv";
import { money } from "@/lib/schedule";
import { todayIso } from "@/lib/status";

const field =
  "w-full rounded-[14px] border border-line bg-canvas px-3 py-2 text-sm outline-none transition-colors focus:border-brand focus:bg-surface";

const TEMPLATE_HEADERS = [
  "ФИО", "Телефон", "Паспорт", "Дата рождения", "Адрес", "Товар", "Категория", "Цена продажи",
  "Первый взнос", "Закупка", "Срок, мес", "Дата выдачи", "Оплачено", "Менеджер", "Филиал",
];

function downloadTemplate() {
  downloadCsv("nasiya-import-shablon.csv", TEMPLATE_HEADERS, [
    ["Иванов Иван Иванович", "+7 911 123-45-67", "4012 345678", "12.03.1990", "г. Москва, ул. Ленина, 1",
      "iPhone 15", "Телефоны", 120000, 20000, 100000, 10, "01.06.2026", 30000, "", ""],
    ["Петрова Анна Сергеевна", "+7 921 765-43-21", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ]);
}

export default function ImportPage() {
  const { user, clients, branches, multiBranch, writeBranchId, importRows } = useData();
  const [fileName, setFileName] = useState<string | null>(null);
  const [table, setTable] = useState<SheetCell[][] | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<ImportField, number>>>({});
  const [branchId, setBranchId] = useState<number | undefined>(writeBranchId);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const canDeals = can(user, "deals.edit");

  const headers = useMemo(() => (table?.[0] ?? []).map((h) => String(h ?? "").trim()), [table]);
  const body = useMemo(() => (table ?? []).slice(1), [table]);

  const records = useMemo(
    () =>
      body.map((cells, i) => {
        const values: Record<string, unknown> = {};
        for (const f of IMPORT_FIELDS) {
          const col = mapping[f.key];
          if (col !== undefined) values[f.key] = cells[col] ?? "";
        }
        if (!canDeals) delete values.product;
        return { line: i + 2, values };
      }),
    [body, mapping, canDeals]
  );

  const checked = useMemo(() => {
    const today = todayIso();
    return records.map((r) => checkRow(r.values, r.line, today));
  }, [records]);

  const summary = useMemo(() => {
    const known = new Set(clients.map((c) => clientKey(c)));
    const seen = new Set<string>();
    let newClients = 0;
    let matched = 0;
    let deals = 0;
    let financed = 0;
    for (const c of checked) {
      if (!c.row) continue;
      const key = clientKey(c.row);
      if (!seen.has(key)) {
        seen.add(key);
        if (known.has(key)) matched++;
        else newClients++;
      }
      if (c.row.deal) {
        deals++;
        financed += c.row.deal.amount - c.row.deal.paid;
      }
    }
    return {
      ok: checked.filter((c) => c.row).length,
      bad: checked.filter((c) => !c.row).length,
      warned: checked.filter((c) => c.row && c.warnings.length).length,
      newClients,
      matched,
      deals,
      financed,
    };
  }, [checked, clients]);

  const unknownBranches = useMemo(() => {
    if (mapping.branch === undefined || user.branchId !== null) return [];
    const names = new Set(branches.filter((b) => b.active).map((b) => b.name.toLowerCase().trim()));
    return [...new Set(records.map((r) => String(r.values.branch ?? "").trim()).filter((v) => v && !names.has(v.toLowerCase())))];
  }, [records, mapping.branch, branches, user.branchId]);

  const load = async (file: File) => {
    setError(null);
    setResult(null);
    try {
      const rows = await readSheet(file);
      if (rows.length < 2) throw new Error("В файле нет строк с данными — первая строка должна быть заголовками");
      if (rows.length - 1 > MAX_IMPORT_ROWS) throw new Error(`Не больше ${MAX_IMPORT_ROWS} строк за раз — разбейте файл`);
      setTable(rows);
      setFileName(file.name);
      setMapping(detectColumns(rows[0].map((h) => String(h ?? ""))));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось прочитать файл");
    }
  };

  const reset = () => {
    setTable(null);
    setFileName(null);
    setMapping({});
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const run = async () => {
    if (busy || summary.ok === 0) return;
    if (
      !confirm(
        `Перенести ${summary.ok} строк: новых клиентов ${summary.newClients}, сделок ${summary.deals}?` +
          (summary.bad ? `\nСтроки с ошибками (${summary.bad}) будут пропущены.` : "")
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const res = await importRows({ rows: records, ...(branchId !== undefined ? { branchId } : {}) });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Импорт не выполнен");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Импорт из Excel" subtitle="Перенос клиентов и сделок из таблицы" cta="" />
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-8">
        {result ? (
          <Card className="p-6 sm:p-8">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-good" aria-hidden />
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Импорт завершён</h2>
                <p className="mt-1 text-sm text-mute">
                  Новых клиентов — {result.clientsCreated}, найдено уже заведённых — {result.clientsMatched},
                  сделок перенесено — {result.dealsCreated}.
                </p>
                {result.skipped.length > 0 && (
                  <p className="mt-2 text-sm text-warn">
                    Пропущены строки: {result.skipped.map((s) => s.line).join(", ")} — в них ошибки.
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/clients" className="rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-on-brand shadow-card hover:bg-brand-deep">
                    К клиентам
                  </Link>
                  {result.dealsCreated > 0 && (
                    <Link href="/deals" className="rounded-full border border-line px-4 py-2.5 text-sm font-medium text-mute hover:text-ink">
                      К сделкам
                    </Link>
                  )}
                  <button type="button" onClick={reset} className="rounded-full border border-line px-4 py-2.5 text-sm font-medium text-mute hover:text-ink">
                    Загрузить ещё файл
                  </button>
                </div>
              </div>
            </div>
          </Card>
        ) : !table ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <Card className="p-6 sm:p-8">
              <label
                className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[20px] border-2 border-dashed border-line px-6 py-14 text-center transition-colors hover:border-brand/60 hover:bg-brand-soft/30"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f) load(f);
                }}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Upload size={22} aria-hidden />
                </span>
                <span className="font-medium">Выберите или перетащите файл</span>
                <span className="text-sm text-mute">.xlsx или .csv, первая строка — заголовки, до {MAX_IMPORT_ROWS} строк</span>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) load(f);
                  }}
                />
              </label>
              {error && <p className="mt-3 text-sm text-danger">{error}</p>}
            </Card>
            <Card className="p-5 sm:p-6">
              <h2 className="font-semibold tracking-tight">Как подготовить таблицу</h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-mute">
                <li>Одна строка — клиент и его покупка. Без товара — только клиент.</li>
                <li>Колонки найдутся по заголовкам, их можно поправить вручную.</li>
                <li>«Цена продажи» — с наценкой и вместе с первым взносом.</li>
                <li>«Оплачено» — сколько клиент уже внёс по графику, без первого взноса.</li>
                <li>Клиенты с тем же телефоном не задваиваются.</li>
                <li>Прошлые платежи в кассу не проводятся — деньги уже прошли.</li>
              </ul>
              <button
                type="button"
                onClick={downloadTemplate}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm font-medium text-brand-deep hover:border-brand hover:bg-brand-soft"
              >
                <Download size={15} aria-hidden /> Скачать шаблон
              </button>
            </Card>
          </div>
        ) : (
          <>
            <Card className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-3">
                <FileSpreadsheet size={18} className="text-brand" aria-hidden />
                <p className="min-w-0 flex-1 truncate font-medium">
                  {fileName} <span className="font-normal text-mute">· {body.length} строк</span>
                </p>
                <button type="button" onClick={reset} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-mute hover:text-ink">
                  <RotateCcw size={14} aria-hidden /> Другой файл
                </button>
              </div>

              <h2 className="mt-5 font-semibold tracking-tight">Колонки</h2>
              <p className="text-sm text-mute">Что в какой колонке файла. Обязательны ФИО, а для сделки — товар, цена, срок и дата выдачи.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {IMPORT_FIELDS.filter((f) => canDeals || !["product", "total", "down", "purchase", "markupPct", "months", "openedAt", "paid", "manager", "category"].includes(f.key))
                  .filter((f) => f.key !== "branch" || (multiBranch && user.branchId === null))
                  .map((f) => (
                    <label key={f.key} className="block">
                      <span className="mb-1 block text-sm font-medium">
                        {f.label}
                        {f.hint && <span className="ml-1 text-xs font-normal text-mute">{f.hint}</span>}
                      </span>
                      <select
                        className={field}
                        value={mapping[f.key] ?? ""}
                        onChange={(e) =>
                          setMapping((m) => {
                            const next = { ...m };
                            if (e.target.value === "") delete next[f.key];
                            else next[f.key] = Number(e.target.value);
                            return next;
                          })
                        }
                      >
                        <option value="">— нет —</option>
                        {headers.map((h, i) => (
                          <option key={i} value={i}>
                            {h || `Колонка ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
              </div>
              {multiBranch && user.branchId === null && (
                <label className="mt-4 block max-w-sm">
                  <span className="mb-1 block text-sm font-medium">
                    Филиал по умолчанию
                    <span className="ml-1 text-xs font-normal text-mute">если в строке не указан</span>
                  </span>
                  <select
                    className={field}
                    value={branchId ?? ""}
                    onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : undefined)}
                  >
                    <option value="">Первый филиал</option>
                    {branches.filter((b) => b.active).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {unknownBranches.length > 0 && (
                <p className="mt-2 text-sm text-warn">
                  Нет таких филиалов: {unknownBranches.join(", ")} — эти строки уйдут в филиал по умолчанию.
                </p>
              )}
            </Card>

            <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                { label: "Готовы к переносу", value: String(summary.ok), cls: "" },
                { label: "С ошибками", value: String(summary.bad), cls: summary.bad ? "text-danger" : "" },
                { label: "Клиенты", value: `${summary.newClients} новых`, note: `${summary.matched} уже есть`, cls: "" },
                { label: "Сделки", value: String(summary.deals), note: `остаток долга ${money(summary.financed)}`, cls: "" },
              ].map((k) => (
                <Card key={k.label} className="p-5">
                  <p className="text-sm text-mute">{k.label}</p>
                  <p className={`mt-1.5 text-[22px] font-semibold tracking-tight ${k.cls}`}>{k.value}</p>
                  {k.note && <p className="text-sm text-mute">{k.note}</p>}
                </Card>
              ))}
            </div>

            <Card className="mt-4 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6">
                <h2 className="font-semibold">Предпросмотр</h2>
                <p className="text-xs text-mute">
                  {checked.length > 200 ? "Показаны первые 200 строк, проверены все" : "Все строки файла"}
                </p>
              </div>
              <div className="mt-3 max-h-[480px] overflow-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="border-b border-line text-left text-xs text-mute">
                      <th className="px-5 py-2.5 font-medium sm:px-6">Строка</th>
                      <th className="px-3 py-2.5 font-medium">Клиент</th>
                      <th className="px-3 py-2.5 font-medium">Сделка</th>
                      <th className="px-3 py-2.5 pr-5 font-medium sm:pr-6">Проверка</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {checked.slice(0, 200).map((c) => {
                      const raw = records[c.line - 2].values;
                      return (
                        <tr key={c.line} className={c.row ? "" : "bg-danger-soft/30"}>
                          <td className="px-5 py-2.5 text-mute tabular-nums sm:px-6">{c.line}</td>
                          <td className="px-3 py-2.5">
                            <p className="font-medium">{String(raw.name ?? "") || "—"}</p>
                            <p className="text-xs text-mute">{String(raw.phone ?? "") || "без телефона"}</p>
                          </td>
                          <td className="px-3 py-2.5">
                            {c.row?.deal ? (
                              <>
                                <p>{c.row.deal.product}</p>
                                <p className="text-xs text-mute">
                                  {money(c.row.deal.amount)} на {c.row.deal.months} мес. · оплачено {money(c.row.deal.paid)}
                                </p>
                              </>
                            ) : String(raw.product ?? "").trim() ? (
                              <p className="text-mute">{String(raw.product)}</p>
                            ) : (
                              <span className="text-mute">только клиент</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 pr-5 sm:pr-6">
                            {c.errors.map((e) => (
                              <p key={e} className="flex items-center gap-1.5 text-danger">
                                <XCircle size={13} className="shrink-0" aria-hidden /> {e}
                              </p>
                            ))}
                            {c.warnings.map((w) => (
                              <p key={w} className="flex items-center gap-1.5 text-xs text-warn">
                                <AlertTriangle size={12} className="shrink-0" aria-hidden /> {w}
                              </p>
                            ))}
                            {c.row && c.warnings.length === 0 && (
                              <p className="flex items-center gap-1.5 text-good">
                                <CheckCircle2 size={13} aria-hidden /> готово
                              </p>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
              {error && <p className="mr-auto text-sm text-danger">{error}</p>}
              <p className="flex items-center gap-1.5 text-xs text-mute">
                <Info size={13} aria-hidden /> Перенос идёт одной операцией — при сбое не сохранится ничего.
              </p>
              <button
                type="button"
                onClick={run}
                disabled={busy || summary.ok === 0}
                className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-on-brand shadow-card hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-mute disabled:shadow-none"
              >
                {busy ? "Переносим…" : `Перенести ${summary.ok} строк`}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

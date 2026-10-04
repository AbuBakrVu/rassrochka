// Чтение таблицы в браузере: .xlsx (первый лист) и .csv. Без сторонних
// библиотек: xlsx — это zip с XML внутри, распаковка — встроенным
// DecompressionStream, разбор — DOMParser. Значения — строки, числа
// остаются числами (даты в Excel — числа-серийники, их понимает
// parseDate из lib/import.ts).

export type SheetCell = string | number;

// ── zip ────────────────────────────────────────────────────────────────

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Файлы zip-архива по именам — только нужные, чтобы не распаковывать картинки. */
async function unzip(buf: ArrayBuffer, wanted: (name: string) => boolean): Promise<Map<string, string>> {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  // Конец центрального каталога — сигнатура 0x06054b50 в последних 64 КБ
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Файл не похож на .xlsx");

  const count = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const out = new Map<string, string>();

  for (let i = 0; i < count; i++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) throw new Error("Повреждённый архив .xlsx");
    const method = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const local = view.getUint32(ptr + 42, true);
    const name = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));
    ptr += 46 + nameLen + extraLen + commentLen;
    if (!wanted(name)) continue;

    const dataStart = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const raw = bytes.subarray(dataStart, dataStart + compSize);
    const data = method === 0 ? raw : method === 8 ? await inflateRaw(raw) : null;
    if (!data) throw new Error("Неподдерживаемое сжатие в .xlsx");
    out.set(name, decoder.decode(data));
  }
  return out;
}

// ── xlsx ───────────────────────────────────────────────────────────────

const colIndex = (ref: string) => {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

const xml = (text: string) => new DOMParser().parseFromString(text, "application/xml");
const byTag = (node: Document | Element, tag: string) => Array.from(node.getElementsByTagNameNS("*", tag));

async function readXlsx(buf: ArrayBuffer): Promise<SheetCell[][]> {
  const files = await unzip(buf, (n) => n === "xl/workbook.xml" || n === "xl/_rels/workbook.xml.rels" || n === "xl/sharedStrings.xml" || n.startsWith("xl/worksheets/sheet"));

  // Первый лист книги — по порядку в workbook.xml, а не по имени файла
  let sheetPath = "xl/worksheets/sheet1.xml";
  const wb = files.get("xl/workbook.xml");
  const rels = files.get("xl/_rels/workbook.xml.rels");
  if (wb && rels) {
    const first = byTag(xml(wb), "sheet")[0];
    const rid = first?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") ?? first?.getAttribute("r:id");
    const target = byTag(xml(rels), "Relationship").find((r) => r.getAttribute("Id") === rid)?.getAttribute("Target");
    if (target) sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
  }
  const sheet = files.get(sheetPath);
  if (!sheet) throw new Error("В файле нет листа с данными");

  const shared = files.has("xl/sharedStrings.xml")
    ? byTag(xml(files.get("xl/sharedStrings.xml")!), "si").map((si) => byTag(si, "t").map((t) => t.textContent ?? "").join(""))
    : [];

  const rows: SheetCell[][] = [];
  for (const row of byTag(xml(sheet), "row")) {
    const r = Number(row.getAttribute("r") ?? rows.length + 1) - 1;
    const cells: SheetCell[] = [];
    for (const c of byTag(row, "c")) {
      const type = c.getAttribute("t");
      const v = byTag(c, "v")[0]?.textContent ?? "";
      let value: SheetCell;
      if (type === "s") value = shared[Number(v)] ?? "";
      else if (type === "inlineStr") value = byTag(c, "t").map((t) => t.textContent ?? "").join("");
      else if (type === "str" || type === "e") value = v;
      else if (type === "b") value = v === "1" ? "да" : "нет";
      else value = v === "" ? "" : Number(v);
      cells[colIndex(c.getAttribute("r") ?? "A")] = value;
    }
    rows[r] = Array.from(cells, (x) => x ?? "");
  }
  return Array.from(rows, (x) => x ?? []);
}

// ── csv ────────────────────────────────────────────────────────────────

export function parseCsv(text: string): SheetCell[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0];
  const delim = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: SheetCell[][] = [];
  let row: SheetCell[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Первый лист файла как массив строк; пустые строки отброшены. */
export async function readSheet(file: File): Promise<SheetCell[][]> {
  const name = file.name.toLowerCase();
  let rows: SheetCell[][];
  if (name.endsWith(".xlsx")) rows = await readXlsx(await file.arrayBuffer());
  else if (name.endsWith(".csv") || name.endsWith(".txt")) {
    const buf = await file.arrayBuffer();
    // Excel сохраняет CSV в Windows-1251, если не выбрать UTF-8 явно
    let text = new TextDecoder("utf-8").decode(buf);
    if (text.includes("�")) text = new TextDecoder("windows-1251").decode(buf);
    rows = parseCsv(text);
  } else if (name.endsWith(".xls")) {
    throw new Error("Старый формат .xls не читается — сохраните файл в Excel как .xlsx");
  } else throw new Error("Нужен файл .xlsx или .csv");
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

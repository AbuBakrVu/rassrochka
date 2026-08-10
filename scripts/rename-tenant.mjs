// Меняет поддомен компании (реестр — сама база данных не переименовывается,
// имени базы адрес клиента не касается).
//
//   node scripts/rename-tenant.mjs --slug старый --new-slug новый
//
// На сервере с одной компанией --slug можно не указывать — скрипт возьмёт
// единственную строку реестра сам.

import { CONTROL_DB, fail, parseArgs, withDb } from "./db.mjs";

const SLUG_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const newSlug = typeof args["new-slug"] === "string" ? args["new-slug"].toLowerCase() : "";

  if (!newSlug) fail("Нужен --new-slug");
  if (!SLUG_RE.test(newSlug) || newSlug.length < 2 || newSlug.length > 32) {
    fail(`Некорректный slug «${newSlug}»: строчные латинские буквы, цифры и дефис (не по краям), 2–32 символа`);
  }

  await withDb(CONTROL_DB, async (client) => {
    let currentSlug = typeof args.slug === "string" ? args.slug.toLowerCase() : null;

    if (!currentSlug) {
      const { rows } = await client.query("select slug from companies");
      if (rows.length === 0) fail("В реестре нет ни одной компании");
      if (rows.length > 1) {
        fail(
          `В реестре несколько компаний — укажите --slug явно: ${rows.map((r) => r.slug).join(", ")}`
        );
      }
      currentSlug = rows[0].slug;
    }

    const clash = await client.query(
      "select 1 from companies where slug = $1 and slug <> $2",
      [newSlug, currentSlug]
    );
    if (clash.rows.length > 0) fail(`Адрес «${newSlug}» уже занят`);

    const { rows } = await client.query(
      "update companies set slug = $2 where slug = $1 returning name",
      [currentSlug, newSlug]
    );
    if (rows.length === 0) fail(`Компания «${currentSlug}» не найдена`);

    console.log(`✓ «${rows[0].name}»: ${currentSlug} → ${newSlug}`);
  });
}

main().catch((err) => fail(err.message));

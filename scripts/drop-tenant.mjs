// Удаляет компанию вместе с базой. Необратимо.
//
//   node scripts/drop-tenant.mjs --slug acme --force
//
// Штатный сценарий ухода клиента другой: сначала pg_dump и отдать данные,
// потом active = false, и только через оговорённый срок — этот скрипт.

import {
  CONTROL_DB,
  dbNameForSlug,
  dropDatabase,
  fail,
  parseArgs,
  withDb,
  withMaintenanceDb,
} from "./db.mjs";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const slug = typeof args.slug === "string" ? args.slug.toLowerCase() : "";

  if (!slug) fail("Нужен --slug");

  const company = await withDb(CONTROL_DB, async (client) => {
    const { rows } = await client.query(
      "select slug, name, db_name from companies where slug = $1",
      [slug]
    );
    return rows[0];
  });

  // Базу без записи в реестре тоже даём удалить — это остаток от
  // неудачного создания, иначе он заблокирует повторную попытку
  const dbName = company?.db_name ?? dbNameForSlug(slug);

  if (!args.force) {
    fail(
      `Будет БЕЗВОЗВРАТНО удалена база ${dbName}` +
        (company ? ` (компания «${company.name}»)` : " (записи в реестре нет)") +
        "\n  Проверьте, что резервная копия снята, и повторите с --force"
    );
  }

  if (company) {
    await withDb(CONTROL_DB, (client) =>
      client.query("delete from companies where slug = $1", [slug])
    );
    console.log(`  ✓ удалена из реестра`);
  }

  await withMaintenanceDb((client) => dropDatabase(client, dbName));
  console.log(`  ✓ удалена база ${dbName}\n`);
}

main().catch((err) => fail(err.message));

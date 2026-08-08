// Накатывает миграции на реестр и на базы всех компаний.
//
// Запускается вручную после выката (см. MIGRATION.md §7.3), а не из CMD
// контейнера: иначе при рестарте нескольких контейнеров миграции пойдут
// параллельно и подерутся.
//
//   node scripts/migrate-all.mjs
//   node scripts/migrate-all.mjs --only acme    # одна компания
//   node scripts/migrate-all.mjs --include-inactive

import path from "node:path";
import {
  CONTROL_DB,
  MIGRATIONS_DIR,
  applyMigrations,
  ensureControlDb,
  fail,
  parseArgs,
  withDb,
} from "./db.mjs";

const args = parseArgs(process.argv.slice(2));
const tenantDir = path.join(MIGRATIONS_DIR, "tenant");

async function main() {
  console.log(`\nМиграции · ${CONTROL_DB}\n`);
  await ensureControlDb();

  const companies = await withDb(CONTROL_DB, async (client) => {
    const where = args["include-inactive"] ? "" : "where active";
    const { rows } = await client.query(
      `select slug, name, db_name from companies ${where} order by slug`
    );
    return rows;
  });

  const targets = args.only
    ? companies.filter((c) => c.slug === args.only)
    : companies;

  if (args.only && targets.length === 0) {
    fail(`Компания «${args.only}» не найдена в реестре`);
  }

  if (targets.length === 0) {
    console.log("\nКомпаний пока нет — накатывать нечего.");
    console.log("Завести первую: node scripts/create-tenant.mjs --slug demo --name Демо --admin-email you@example.com\n");
    return;
  }

  let totalApplied = 0;
  const failed = [];

  for (const company of targets) {
    try {
      const applied = await withDb(company.db_name, (client) =>
        applyMigrations(client, tenantDir, company.slug)
      );
      totalApplied += applied;
      if (applied === 0) console.log(`  · ${company.slug}: актуальна`);
    } catch (err) {
      // Не прерываемся: одна битая база не должна оставить остальные
      // на старой схеме. Перечислим все проблемы в конце.
      failed.push({ slug: company.slug, message: err.message });
      console.error(`  ✗ ${company.slug}: ${err.message}`);
    }
  }

  console.log(
    `\nГотово: ${targets.length} компаний, применено миграций — ${totalApplied}`
  );

  if (failed.length > 0) {
    console.error(`\n✗ Не удалось обновить ${failed.length}: ${failed.map((f) => f.slug).join(", ")}\n`);
    process.exit(1);
  }
  console.log("");
}

main().catch((err) => fail(err.message));

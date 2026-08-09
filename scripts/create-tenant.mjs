// Заводит новую компанию: база + схема + администратор + запись в реестре.
//
//   node scripts/create-tenant.mjs --slug acme --name "ООО Акме" \
//        --admin-email director@acme.ru [--admin-name "Иван Петров"] \
//        [--cash-opening 1240000]
//
// Адрес компании складывается из slug и APP_DOMAIN, поэтому домен нигде не
// зашит в коде — его достаточно поменять в одной переменной окружения.
//
// Компания получает ПУСТУЮ CRM: сотрудников, клиентов и сделки заводит
// сама. Затравочные данные остаются только на демо-стенде.

import path from "node:path";
import { randomBytes } from "node:crypto";
import { hash } from "@node-rs/argon2";
import {
  CONTROL_DB,
  MIGRATIONS_DIR,
  applyMigrations,
  createDatabase,
  databaseExists,
  dbNameForSlug,
  dropDatabase,
  ensureControlDb,
  fail,
  parseArgs,
  withDb,
  withMaintenanceDb,
} from "./db.mjs";

// Заняты инфраструктурой или зарезервированы под будущие нужды —
// компания с таким slug сломала бы маршрутизацию поддоменов.
const RESERVED_SLUGS = new Set([
  "www", "api", "app", "admin", "static", "assets", "cdn", "mail", "smtp",
  "ftp", "ns", "ns1", "ns2", "root", "system", "internal", "status",
  "health", "help", "support", "blog", "docs", "login", "auth", "billing",
]);

const SLUG_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

function initialsFrom(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  return parts
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function tempPassword() {
  // 12 символов из base64url — достаточно для временного пароля,
  // который администратор обязан сменить при первом входе
  return randomBytes(9).toString("base64url");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const slug = typeof args.slug === "string" ? args.slug.toLowerCase() : "";
  const name = typeof args.name === "string" ? args.name.trim() : "";
  const adminEmail =
    typeof args["admin-email"] === "string" ? args["admin-email"].trim() : "";
  const adminName =
    typeof args["admin-name"] === "string" ? args["admin-name"].trim() : "Администратор";
  const cashOpening = args["cash-opening"] ? Number(args["cash-opening"]) : 0;

  if (!slug || !name || !adminEmail) {
    fail(
      "Нужны --slug, --name и --admin-email\n" +
        '  пример: node scripts/create-tenant.mjs --slug acme --name "ООО Акме" --admin-email d@acme.ru'
    );
  }
  if (!SLUG_RE.test(slug) || slug.length < 2 || slug.length > 32) {
    fail(`Некорректный slug «${slug}»: строчные латинские буквы, цифры и дефис (не по краям), 2–32 символа`);
  }
  if (RESERVED_SLUGS.has(slug)) {
    fail(`Slug «${slug}» зарезервирован под инфраструктуру, выберите другой`);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) {
    fail(`Некорректный email администратора: «${adminEmail}»`);
  }
  if (!Number.isFinite(cashOpening) || cashOpening < 0) {
    fail(`Некорректный --cash-opening: «${args["cash-opening"]}»`);
  }

  const dbName = dbNameForSlug(slug);

  console.log(`\nСоздание компании «${name}» (${slug})\n`);
  await ensureControlDb();

  // Проверяем занятость до всяких изменений
  await withDb(CONTROL_DB, async (client) => {
    const { rows } = await client.query(
      "select slug from companies where slug = $1 or db_name = $2",
      [slug, dbName]
    );
    if (rows.length > 0) fail(`Компания «${slug}» уже есть в реестре`);
  });

  await withMaintenanceDb(async (client) => {
    if (await databaseExists(client, dbName)) {
      fail(
        `База ${dbName} уже существует, хотя в реестре компании нет.\n` +
          `  Разберитесь вручную: либо это остаток от неудачного запуска (тогда DROP DATABASE ${dbName}),\n` +
          "  либо чужая база с совпавшим именем."
      );
    }
    await createDatabase(client, dbName);
  });
  console.log(`  ✓ создана база ${dbName}`);

  const password = tempPassword();

  // Дальше любая ошибка оставила бы пустую базу без записи в реестре —
  // подчищаем за собой, чтобы повторный запуск не упёрся в «база уже есть»
  try {
    await withDb(dbName, async (client) => {
      await applyMigrations(client, path.join(MIGRATIONS_DIR, "tenant"), slug);

      const passwordHash = await hash(password);
      await client.query(
        `insert into users (email, password_hash, name, initials, role,
                            must_change_password)
         values ($1, $2, $3, $4, 'admin', true)`,
        [adminEmail, passwordHash, adminName, initialsFrom(adminName)]
      );

      if (cashOpening > 0) {
        await client.query(
          "update settings set value = $1::jsonb where key = 'cash_opening_balance'",
          [String(cashOpening)]
        );
      }
    });

    // Регистрируем последним шагом: пока записи нет, компания не видна
    // приложению, а значит недоделанная база никому не покажется
    await withDb(CONTROL_DB, (client) =>
      client.query(
        "insert into companies (slug, name, db_name) values ($1, $2, $3)",
        [slug, name, dbName]
      )
    );
  } catch (err) {
    console.error(`\n✗ Ошибка после создания базы: ${err.message}`);
    console.error(`  Удаляю ${dbName}, чтобы можно было запустить заново...`);
    await withMaintenanceDb((client) => dropDatabase(client, dbName));
    fail("Компания не создана, изменения откачены");
  }

  console.log(`  ✓ администратор ${adminEmail}`);
  console.log(`  ✓ зарегистрирована в реестре\n`);
  console.log("─".repeat(52));
  console.log(`  Адрес       ${slug}.${process.env.APP_DOMAIN ?? "<APP_DOMAIN не задан>"}`);
  console.log(`  Логин       ${adminEmail}`);
  console.log(`  Пароль      ${password}`);
  console.log("─".repeat(52));
  console.log("\n  Пароль показан один раз — передайте его клиенту по защищённому");
  console.log("  каналу и потребуйте сменить при первом входе.\n");
}

main().catch((err) => fail(err.message));

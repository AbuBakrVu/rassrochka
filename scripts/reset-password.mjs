// Сбрасывает пароль сотрудника компании — временный пароль, обязательная
// смена при следующем входе. Для восстановления доступа, когда клиент
// потерял пароль администратора и войти уже некому.
//
//   node scripts/reset-password.mjs --email d@acme.ru [--slug acme]
//
// На сервере с одной компанией --slug можно не указывать.

import { randomBytes } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { CONTROL_DB, fail, parseArgs, withDb } from "./db.mjs";

function tempPassword() {
  return randomBytes(9).toString("base64url");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = typeof args.email === "string" ? args.email.trim() : "";
  if (!email) fail("Нужен --email");

  const dbName = await withDb(CONTROL_DB, async (client) => {
    let slug = typeof args.slug === "string" ? args.slug.toLowerCase() : null;

    if (!slug) {
      const { rows } = await client.query("select slug from companies");
      if (rows.length === 0) fail("В реестре нет ни одной компании");
      if (rows.length > 1) {
        fail(
          `В реестре несколько компаний — укажите --slug явно: ${rows.map((r) => r.slug).join(", ")}`
        );
      }
      slug = rows[0].slug;
    }

    const { rows } = await client.query(
      "select db_name from companies where slug = $1",
      [slug]
    );
    if (rows.length === 0) fail(`Компания «${slug}» не найдена`);
    return rows[0].db_name;
  });

  const password = tempPassword();

  await withDb(dbName, async (client) => {
    const passwordHash = await hash(password);
    const { rows } = await client.query(
      `update users set password_hash = $2, must_change_password = true
       where email = $1
       returning name`,
      [email, passwordHash]
    );
    if (rows.length === 0) {
      fail(`Пользователь с почтой «${email}» не найден в этой компании`);
    }
    console.log(`✓ пароль сброшен для ${rows[0].name} <${email}>`);
  });

  console.log("─".repeat(52));
  console.log(`  Логин       ${email}`);
  console.log(`  Пароль      ${password}`);
  console.log("─".repeat(52));
  console.log("\n  Показан один раз — передайте по защищённому каналу.\n");
}

main().catch((err) => fail(err.message));

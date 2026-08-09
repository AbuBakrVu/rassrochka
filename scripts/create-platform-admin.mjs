// Заводит владельца платформы — того, кто входит в /admin и управляет
// реестром компаний. Нужен как курица-и-яйцо: панель /admin защищена
// собственным логином, а первый такой аккаунт неоткуда взять кроме CLI.
//
//   node scripts/create-platform-admin.mjs --email you@example.com --name "Ваше имя"

import { hash } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";
import { CONTROL_DB, ensureControlDb, fail, parseArgs, withDb } from "./db.mjs";

function tempPassword() {
  return randomBytes(9).toString("base64url");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = typeof args.email === "string" ? args.email.trim() : "";
  const name = typeof args.name === "string" ? args.name.trim() : "";

  if (!email || !name) {
    fail(
      "Нужны --email и --name\n" +
        '  пример: node scripts/create-platform-admin.mjs --email you@example.com --name "Ваше имя"'
    );
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    fail(`Некорректная почта: «${email}»`);
  }

  await ensureControlDb();

  const existing = await withDb(CONTROL_DB, (client) =>
    client.query("select id from platform_admins where email = $1", [email])
  );
  if (existing.rows.length > 0) {
    fail(`Владелец с почтой «${email}» уже есть`);
  }

  const password = tempPassword();
  const passwordHash = await hash(password);

  await withDb(CONTROL_DB, (client) =>
    client.query(
      `insert into platform_admins (email, password_hash, name, must_change_password)
       values ($1, $2, $3, true)`,
      [email, passwordHash, name]
    )
  );

  console.log(`\n  ✓ владелец платформы создан\n`);
  console.log("─".repeat(52));
  console.log(`  Адрес       /admin (на корневом домене)`);
  console.log(`  Логин       ${email}`);
  console.log(`  Пароль      ${password}`);
  console.log("─".repeat(52));
  console.log("\n  Пароль показан один раз.\n");
}

main().catch((err) => fail(err.message));

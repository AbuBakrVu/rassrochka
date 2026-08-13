// Заводит сотрудника компании с временным паролем — тот же путь, что
// «Пригласить сотрудника» в /employees, но без веб-формы (аварийный CLI,
// когда войти в интерфейс ещё некому или неудобно).
//
//   node scripts/create-employee.mjs --email d@acme.ru --name "Иван Петров" \
//     --role admin [--phone "+7 900 000-00-00"] [--slug acme]
//
// На сервере с одной компанией --slug можно не указывать.

import { randomBytes } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { CONTROL_DB, fail, parseArgs, withDb } from "./db.mjs";

const ROLES = new Set(["admin", "manager", "accountant"]);

function tempPassword() {
  return randomBytes(9).toString("base64url");
}

function initialsFrom(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  return parts.slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = typeof args.email === "string" ? args.email.trim() : "";
  const name = typeof args.name === "string" ? args.name.trim() : "";
  const role = typeof args.role === "string" ? args.role.trim() : "manager";
  const phone = typeof args.phone === "string" ? args.phone.trim() : null;

  if (!email) fail("Нужен --email");
  if (!name) fail("Нужен --name");
  if (!ROLES.has(role)) fail(`--role должна быть одна из: ${[...ROLES].join(", ")}`);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(`Некорректная почта: «${email}»`);

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
    const existing = await client.query("select id from users where email = $1", [email]);
    if (existing.rows.length > 0) fail(`Сотрудник с почтой «${email}» уже есть`);

    const passwordHash = await hash(password);
    await client.query(
      `insert into users (email, password_hash, name, initials, role, phone, must_change_password)
       values ($1, $2, $3, $4, $5, $6, true)`,
      [email, passwordHash, name, initialsFrom(name), role, phone]
    );
  });

  console.log(`✓ сотрудник создан: ${name} <${email}>, роль ${role}`);
  console.log("─".repeat(52));
  console.log(`  Логин       ${email}`);
  console.log(`  Пароль      ${password}`);
  console.log("─".repeat(52));
  console.log("\n  Показан один раз — передайте по защищённому каналу.\n");
}

main().catch((err) => fail(err.message));

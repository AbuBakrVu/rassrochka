// Удаляет тестовые данные, загруженные импортом из nasiya-test-import.xlsx:
// клиентов с адресом «ТЕСТ — удалить после проверки» и все их сделки —
// вместе с платежами, принятыми по ним уже после импорта (касса,
// начисления соинвесторам, звонки, история, файлы).
//
//   ./nasiya clear-test-data            — показать, что будет удалено
//   ./nasiya clear-test-data --yes      — удалить
//
// Журнал действий не трогается: в нём остаётся след и импорта, и платежей.

import { CONTROL_DB, fail, parseArgs, withDb } from "./db.mjs";

const MARK = "ТЕСТ — удалить после проверки";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const companies = await withDb(CONTROL_DB, async (c) => (await c.query("select slug, db_name from companies where active")).rows);
  if (companies.length === 0) fail("В реестре нет компаний");

  for (const { slug, db_name: dbName } of companies) {
    await withDb(dbName, async (client) => {
      const { rows: clients } = await client.query(
        "select id from clients where registration_address = $1 or living_address = $1",
        [MARK]
      );
      const clientIds = clients.map((c) => c.id);
      const { rows: deals } = await client.query("select id from deals where client_id = any($1)", [clientIds]);
      const dealIds = deals.map((d) => d.id);
      const { rows: cash } = await client.query(
        "select count(*)::int as n, coalesce(sum(amount), 0)::numeric as sum from cash_tx where deal_id = any($1)",
        [dealIds]
      );
      // Клиент — поручитель по чужой (не тестовой) сделке: такого не удаляем
      const { rows: guard } = await client.query(
        `select distinct dg.client_id from deal_guarantors dg
         where dg.client_id = any($1) and not (dg.deal_id = any($2))`,
        [clientIds, dealIds]
      );
      if (guard.length > 0) fail(`${slug}: тестовые клиенты ${guard.map((g) => g.client_id).join(", ")} — поручители по рабочим сделкам, удалите связь вручную`);

      console.log(`${slug}: тестовых клиентов ${clientIds.length}, сделок ${dealIds.length}, записей кассы ${cash[0].n} на ${Number(cash[0].sum).toLocaleString("ru-RU")} ₽`);
      if (!args.yes) return;

      await client.query("begin");
      try {
        // Отмены платежей ссылаются на сами платежи — сначала они
        await client.query("delete from cash_tx where deal_id = any($1) and reverses_id is not null", [dealIds]);
        await client.query("delete from cash_tx where deal_id = any($1)", [dealIds]);
        await client.query("delete from coinvestor_profit_tx where deal_id = any($1)", [dealIds]);
        await client.query("delete from deals where id = any($1)", [dealIds]); // история, график, звонки, файлы — каскадом
        await client.query("delete from deal_guarantors where client_id = any($1)", [clientIds]);
        await client.query("delete from clients where id = any($1)", [clientIds]);
        await client.query("commit");
        console.log(`  ✓ удалено`);
      } catch (err) {
        await client.query("rollback");
        throw err;
      }
    });
  }
  if (!args.yes) console.log("\nНичего не удалено. Чтобы удалить: ./nasiya clear-test-data --yes");
}

main().catch((err) => fail(err.message));

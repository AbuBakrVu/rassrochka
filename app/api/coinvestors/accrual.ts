import { BadRequestError, num, optionalNum, optionalStr } from "@/app/api/_lib/handler";

// Режим начисления соинвестору из тела запроса — общий для создания и правки.
// Файл без route-экспортов: Next не делает из него роут.

export function accrualInput(body: unknown) {
  const mode = optionalStr(body, "accrualMode", "profit_share");
  if (mode !== "profit_share" && mode !== "fixed") {
    throw new BadRequestError("Режим начисления — profit_share или fixed");
  }
  return {
    accrualMode: mode as "profit_share" | "fixed",
    profitSharePct: mode === "profit_share" ? num(body, "profitSharePct", { min: 0, max: 100 }) : 0,
    monthlyRatePct: mode === "fixed" ? num(body, "monthlyRatePct", { min: 0.01, max: 100 }) : (optionalNum(body, "monthlyRatePct", { min: 0, max: 100 }) ?? 0),
  };
}

export const accrualSummary = (i: ReturnType<typeof accrualInput>) =>
  i.accrualMode === "fixed" ? `${i.monthlyRatePct}% в месяц на капитал` : `доля ${i.profitSharePct}% от прибыли`;

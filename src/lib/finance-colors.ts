// Семантическая палитра для финансовых сущностей.
// Цвета определяются CSS-токенами, заведёнными в src/styles.css
// (для light и dark тем), чтобы быть читаемыми на обоих фонах.
//
// Используем для donut/bar по структуре активов и пассивов,
// где смысл цвета должен быть устойчивым между графиками.

export type FinCategory =
  | "cash"
  | "ar"
  | "inventory"
  | "fixed"
  | "otherAssets"
  | "shortLiab"
  | "longLiab"
  | "ap"
  | "equity"
  | "income"
  | "expense";

const CATEGORY_VARS: Record<FinCategory, string> = {
  cash: "var(--cat-cash)",
  ar: "var(--cat-ar)",
  inventory: "var(--cat-inventory)",
  fixed: "var(--cat-fixed)",
  otherAssets: "var(--cat-other-assets)",
  shortLiab: "var(--cat-short-liab)",
  longLiab: "var(--cat-long-liab)",
  ap: "var(--cat-ap)",
  equity: "var(--cat-equity)",
  income: "var(--color-income)",
  expense: "var(--color-expense)",
};

// Резервная палитра для серий, не попавших в семантические категории.
// 8 различимых цветов — на dark и light темах одинаково читаемых.
export const SERIES_PALETTE = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
  "var(--color-chart-8)",
];

export function seriesColor(index: number): string {
  return SERIES_PALETTE[index % SERIES_PALETTE.length];
}

export function categoryVar(cat: FinCategory): string {
  return CATEGORY_VARS[cat];
}

// Эвристика: по русскому названию строки баланса определяем смысловую категорию.
export function detectAssetCategory(name: string): FinCategory | null {
  const n = name.toLowerCase();
  if (/денеж|касс|расчётн|расчетн|счёт|счет|банк/.test(n)) return "cash";
  if (/дебитор|задолженност.*покуп|дз\b/.test(n)) return "ar";
  if (/запас|товар|материал|склад|сырь/.test(n)) return "inventory";
  if (/основн|оборудован|здан|транспорт|нма|нематер|внеоборот/.test(n)) return "fixed";
  return "otherAssets";
}

export function detectLiabilityCategory(name: string): FinCategory | null {
  const n = name.toLowerCase();
  if (/собств|капитал|нераспредел|прибыль/.test(n)) return "equity";
  if (/кредитор|поставщ|кз\b/.test(n)) return "ap";
  if (/долгосроч/.test(n)) return "longLiab";
  if (/краткосроч|текущ|заём|заем|кредит|налог/.test(n)) return "shortLiab";
  return "shortLiab";
}

export function colorForAsset(name: string, index = 0): string {
  const cat = detectAssetCategory(name);
  return cat ? categoryVar(cat) : seriesColor(index);
}

export function colorForLiability(name: string, index = 0): string {
  const cat = detectLiabilityCategory(name);
  return cat ? categoryVar(cat) : seriesColor(index);
}

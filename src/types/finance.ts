// Types mirror docs/data-contract.md.
// All API responses follow this envelope so swapping mock -> Apps Script is mechanical.
// Money use Сумма + Вид операции logic (no Приход/Расход columns).

export type ApiStatus = "success" | "error";

export interface ApiResponse<T> {
  status: ApiStatus;
  data: T | null;
  error: string | null;
}

export type StatusLevel = "good" | "warn" | "bad";

export interface PeriodParams {
  dateFrom: string;
  dateTo: string;
}

export interface MoneyParams extends PeriodParams {
  account?: string | null;
  counterparty?: string | null;
  article?: string | null;
  direction?: string | null;
}

export interface ProfitParams extends PeriodParams {
  project?: string | null;
  direction?: string | null;
  article?: string | null;
  section?: string | null;
}

export interface CapitalParams {
  dateTo: string;
}

// Shared meta — расширено словарями и списком всех срезов капитала.
export interface Meta {
  dateFrom: string;
  dateTo: string;
  snapshotDate: string;
  periodStart: string;
  periodEnd: string;
  warning: string | null;
  accounts?: string[];
  counterparties?: string[];
  articles?: string[];
  directions?: string[];
  projects?: string[];
  sections?: string[];
  allSnapshotDates?: string[];
}

// ---------- Dashboard ----------
export interface DashboardKpis {
  netCashFlow: number;
  cashBuffer: number;          // дни
  netProfit: number;
  netProfitMargin: number;     // %
  marginPct: number;           // %
  liquidity: number;           // current ratio
  equity: number;
  roe: number;                 // %
  finIndependence: number;     // %
  arDays: number;
  apDays: number;
  arTurns: number;
  apTurns: number;
  totalIncome: number;
  totalExpense: number;
  currentAssets: number;
  currentLiabilities: number;
  status: StatusLevel; // derived на frontend (status API не возвращает)
  topRisk: string | null; // null когда API не вернул — UI скрывает блок
  arEstimated?: boolean; // расчёт ДЗ из одного среза
  apEstimated?: boolean; // расчёт КЗ из одного среза
}
export interface DashboardCharts {
  ncfByMonth: { month: string; value: number }[];
  ncfByDirection: { direction: string; value: number }[];
  revenueMR: { month: string; revenue: number; mr: number }[];
  grossProfitByDir: { direction: string; value: number }[];
  netProfitMargin: { month: string; profit: number; margin: number }[];
  arDynamics: { month: string; value: number }[];
  apDynamics: { month: string; value: number }[];
  capitalStructure: { name: string; value: number }[];
  finIndependence: { month: string; value: number }[];
}
export interface DashboardPayload {
  kpis: DashboardKpis;
  charts: DashboardCharts;
  tables: Record<string, never>;
  meta: Meta;
}

// ---------- Money ----------
export type OperationKind = "Приход" | "Расход";

export interface MoneyKpis {
  netCashFlow: number;
  cashBuffer: number;          // дни
  totalIncome: number;
  totalExpense: number;
  openingBalance: number;
  closingBalance: number;
  avgMonthlyExpense: number;
}
export interface MoneyCharts {
  byMonth: { month: string; income: number; expense: number; net: number; balance: number; avgExpense: number }[];
  expensesByArticle: { article: string; value: number; share: number }[];
  byDirection: { direction: string; value: number }[];
  counterparties: { name: string; value: number; kind: OperationKind }[];
}
// Иерархическая ОДДС: Раздел → Статья → месяцы.
export interface OddsArticleRow {
  article: string;
  months: { month: string; value: number }[];
  total: number;
  kind: OperationKind;
}
export interface OddsSectionRow {
  section: string;
  income: number;
  expense: number;
  net: number;
  articles: OddsArticleRow[];
}
export interface MoneyPayload {
  kpis: MoneyKpis;
  charts: MoneyCharts;
  tables: { oddsTree: OddsSectionRow[] };
  meta: Meta;
}

// ---------- Profit ----------
export interface ProfitKpis {
  revenue: number;
  cogs: number;
  grossProfit: number;
  marginPct: number;        // % (валовая)
  fixedCostsPct: number;    // %
  netProfit: number;
  netProfitMargin: number;  // %
}
export interface PnlRow {
  label: string;
  value: number;
  kind: "revenue" | "cogs" | "gross" | "opex" | "net" | "other";
}
// 8 разделов ОПиУ
export interface SectionSum {
  section: string;
  value: number;
  pctOfRevenue: number;
}
// Матрица проект × показатель в разрезе направления
export interface ProjectMatrixRow {
  direction: string;
  project: string;
  revenue: number;
  grossProfit: number;
  marginPct: number;
}
export interface ProfitCharts {
  revenueMargin: { month: string; revenue: number; margin: number }[];
  revenueByDirection: { direction: string; value: number }[];
  grossProfitByDirection: { direction: string; value: number }[];
  netProfitMargin: { month: string; profit: number; margin: number }[];
}
export interface ProfitPayload {
  kpis: ProfitKpis;
  charts: ProfitCharts;
  tables: {
    pnl: PnlRow[];
    sectionSums: SectionSum[];
    projectMatrix: ProjectMatrixRow[];
  };
  meta: Meta;
}

// ---------- Capital ----------
export interface CapitalKpis {
  equity: number;
  currentAssets: number;
  currentLiabilities: number;
  liquidity: number;        // ratio
  totalAssets: number;
  finIndependence: number;  // %
  arValue: number;
  apValue: number;
  arDays: number;
  apDays: number;
}
export interface CapitalCharts {
  assetsStructure: { name: string; value: number }[];
  liabilitiesStructure: { name: string; value: number }[];
  arDynamic: { month: string; value: number }[];
  apDynamic: { month: string; value: number }[];
  capitalDynamic: { date: string; equity: number; liabilities: number }[];
  liquidityDynamic: { date: string; value: number }[];
  finIndependenceDynamic: { date: string; value: number }[];
}
// Полный баланс с 4 уровнями вложенности.
export interface BalanceRow {
  section1: string;           // Актив / Пассив
  section2: string;           // Оборотные / Внеоборотные / Капитал / Краткосрочные / Долгосрочные
  section3: string;           // группа
  section4: string;           // строка
  amount: number;
}
export interface CapitalPayload {
  kpis: CapitalKpis;
  charts: CapitalCharts;
  tables: { balance: BalanceRow[] };
  meta: Meta;
}

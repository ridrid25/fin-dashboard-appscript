// Mock data — расширены под реальный backend contract (docs/data-contract.md).
// Cash buffer хранится в днях. Маржинальность и рентабельность — в процентах (не доля).
//
// Важно: фильтры (direction / counterparty / article / account / project / section)
// РЕАЛЬНО влияют на KPI, графики и таблицы. Данные строятся из профилей по
// направлениям, поэтому при выборе одного направления цифры заметно меняются.

import type {
  ApiResponse,
  BalanceRow,
  CapitalParams,
  CapitalPayload,
  DashboardPayload,
  Meta,
  MoneyParams,
  MoneyPayload,
  OddsArticleRow,
  OddsSectionRow,
  PeriodParams,
  ProfitParams,
  ProfitPayload,
  ProjectMatrixRow,
} from "@/types/finance";

const MONTHS = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

// Список месяцев, попадающих в выбранный период [dateFrom, dateTo].
// Возвращает массив элементов с label и индексом месяца в году (0..11),
// чтобы агрегаты строились только по месяцам периода, а не по всему 12-месячному
// году. Если период многолетний — в label добавляется год ('Янв 24').
interface PeriodMonth {
  label: string;
  year: number;
  monthIdx: number; // 0..11
}
function monthsInPeriod(dateFrom: string, dateTo: string): PeriodMonth[] {
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to < from) {
    return [{ label: MONTHS[0], year: from.getFullYear() || new Date().getFullYear(), monthIdx: 0 }];
  }
  const multiYear = from.getFullYear() !== to.getFullYear();
  const res: PeriodMonth[] = [];
  let y = from.getFullYear();
  let m = from.getMonth();
  const ty = to.getFullYear();
  const tm = to.getMonth();
  // Safety: cap at 60 months
  let safety = 0;
  while ((y < ty || (y === ty && m <= tm)) && safety++ < 60) {
    const label = multiYear ? `${MONTHS[m]} ${String(y).slice(2)}` : MONTHS[m];
    res.push({ label, year: y, monthIdx: m });
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return res.length ? res : [{ label: MONTHS[from.getMonth()], year: from.getFullYear(), monthIdx: from.getMonth() }];
}

const ACCOUNTS = ["Расчётный Сбер", "Расчётный Тинькофф", "Касса", "Валютный"];
const COUNTERPARTIES = ["ООО Альфа", "ИП Беляев", "ООО Гамма", "Аренда БЦ", "Поставщик-1", "ФНС"];
const ARTICLES = ["ФОТ", "Аренда", "Закупка товара", "Маркетинг", "Налоги", "Прочее"];
const DIRECTIONS = ["Розница", "Опт", "Онлайн", "Сервис"];
const PROJECTS = ["Магазин Север", "Магазин Юг", "B2B-канал", "Маркетплейс", "Сайт", "Услуги монтажа"];
const SECTIONS_PNL = [
  "Выручка",
  "Себестоимость",
  "Валовая прибыль",
  "Постоянные расходы",
  "Операционная прибыль",
  "Финансовые расходы",
  "Налоги",
  "Чистая прибыль",
];
// Срезы капитала: квартальные даты на 2023–2026.
const ALL_SNAPSHOTS = [
  "2023-03-31", "2023-06-30", "2023-09-30", "2023-12-31",
  "2024-03-31", "2024-06-30", "2024-09-30", "2024-12-31",
  "2025-03-31", "2025-06-30", "2025-09-30", "2025-12-31",
  "2026-03-31",
];

// ---------- Профили по направлениям (база для Money + часть Profit) ----------
interface DirProfile {
  name: string;
  // Месячные суммы в рублях (12 значений)
  income: number[];
  expense: number[];
  // Доли расходов по статьям (сумма = 1)
  articleShare: Record<string, number>;
  // Доли поступлений / платежей по контрагентам (сумма = 1)
  cpIncomeShare: Record<string, number>;
  cpExpenseShare: Record<string, number>;
  // Какие счета задействованы в этом направлении
  accounts: string[];
  // Маржинальность направления (для P&L)
  marginPct: number;
}

const M = (base: number, pattern: number[]) => pattern.map((p) => Math.round(base * p));

const PATTERN_GROW = [0.75, 0.7, 0.65, 0.85, 1.0, 0.95, 0.9, 1.05, 1.15, 1.1, 1.2, 1.35];
const PATTERN_FLAT = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
const PATTERN_SEASONAL = [0.6, 0.55, 0.5, 0.9, 1.2, 1.1, 0.95, 1.05, 1.3, 1.15, 1.4, 1.6];

const PROFILES: DirProfile[] = [
  {
    name: "Розница",
    income: M(1_900_000, PATTERN_SEASONAL),
    expense: M(1_300_000, PATTERN_SEASONAL),
    articleShare: { "ФОТ": 0.34, "Аренда": 0.22, "Закупка товара": 0.18, "Маркетинг": 0.12, "Налоги": 0.09, "Прочее": 0.05 },
    cpIncomeShare: { "ООО Альфа": 0.55, "ИП Беляев": 0.30, "ООО Гамма": 0.15 },
    cpExpenseShare: { "Аренда БЦ": 0.42, "Поставщик-1": 0.30, "ФНС": 0.18, "ООО Гамма": 0.10 },
    accounts: ["Расчётный Сбер", "Касса"],
    marginPct: 39,
  },
  {
    name: "Опт",
    income: M(1_550_000, PATTERN_GROW),
    expense: M(950_000, PATTERN_GROW),
    articleShare: { "Закупка товара": 0.58, "ФОТ": 0.18, "Налоги": 0.10, "Прочее": 0.08, "Маркетинг": 0.04, "Аренда": 0.02 },
    cpIncomeShare: { "ООО Альфа": 0.70, "ИП Беляев": 0.20, "ООО Гамма": 0.10 },
    cpExpenseShare: { "Поставщик-1": 0.78, "ФНС": 0.16, "Аренда БЦ": 0.06 },
    accounts: ["Расчётный Тинькофф", "Валютный"],
    marginPct: 33,
  },
  {
    name: "Онлайн",
    income: M(1_150_000, PATTERN_GROW),
    expense: M(620_000, PATTERN_GROW),
    articleShare: { "Маркетинг": 0.48, "ФОТ": 0.22, "Закупка товара": 0.12, "Прочее": 0.10, "Налоги": 0.06, "Аренда": 0.02 },
    cpIncomeShare: { "ООО Гамма": 0.55, "ИП Беляев": 0.30, "ООО Альфа": 0.15 },
    cpExpenseShare: { "Поставщик-1": 0.45, "ФНС": 0.30, "Аренда БЦ": 0.25 },
    accounts: ["Расчётный Сбер"],
    marginPct: 44,
  },
  {
    name: "Сервис",
    income: M(480_000, PATTERN_FLAT),
    expense: M(560_000, PATTERN_FLAT),
    articleShare: { "ФОТ": 0.62, "Аренда": 0.18, "Налоги": 0.08, "Прочее": 0.06, "Маркетинг": 0.04, "Закупка товара": 0.02 },
    cpIncomeShare: { "ООО Гамма": 0.70, "ИП Беляев": 0.30 },
    cpExpenseShare: { "Аренда БЦ": 0.50, "ФНС": 0.40, "Поставщик-1": 0.10 },
    accounts: ["Расчётный Сбер"],
    marginPct: 28,
  },
];

// account-фильтр: если выбран счёт, берём только те профили, где этот счёт есть.
// Это снижает суммы и иногда обнуляет блок — это и есть осмысленный эффект фильтра.
function selectProfiles(filters: { direction?: string | null; account?: string | null }): DirProfile[] {
  return PROFILES.filter((p) => {
    if (filters.direction && p.name !== filters.direction) return false;
    if (filters.account && !p.accounts.includes(filters.account)) return false;
    return true;
  });
}

// Доля профиля по фильтру контрагента (только если контрагент есть в этом направлении).
function cpShare(p: DirProfile, kind: "in" | "out", cp: string | null | undefined): number {
  if (!cp) return 1;
  const src = kind === "in" ? p.cpIncomeShare : p.cpExpenseShare;
  return src[cp] ?? 0;
}

function articleShare(p: DirProfile, article: string | null | undefined): number {
  if (!article) return 1;
  return p.articleShare[article] ?? 0;
}

const makeMeta = (
  dateFrom: string,
  dateTo: string,
  snapshot?: string,
  warning?: string | null,
): Meta => ({
  dateFrom: new Date(dateFrom).toISOString(),
  dateTo: new Date(dateTo).toISOString(),
  snapshotDate: new Date(snapshot ?? dateTo).toISOString(),
  periodStart: new Date(dateFrom).toISOString(),
  periodEnd: new Date(dateTo).toISOString(),
  warning: warning ?? null,
  accounts: ACCOUNTS,
  counterparties: COUNTERPARTIES,
  articles: ARTICLES,
  directions: DIRECTIONS,
  projects: PROJECTS,
  sections: SECTIONS_PNL,
  allSnapshotDates: ALL_SNAPSHOTS,
});

const delay = <T>(value: T, ms = 150): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const ok = <T>(data: T): ApiResponse<T> => ({ status: "success", data, error: null });

// ============================================================================
// Dashboard (без фильтров — общая картина)
// ============================================================================
export async function mockDashboard({ dateFrom, dateTo }: PeriodParams): Promise<ApiResponse<DashboardPayload>> {
  const period = monthsInPeriod(dateFrom, dateTo);
  const ncfByMonth = period.map((mm) => ({
    month: mm.label,
    value: PROFILES.reduce((s, p) => s + p.income[mm.monthIdx] - p.expense[mm.monthIdx], 0),
  }));
  const totalIncome = period.reduce(
    (s, mm) => s + PROFILES.reduce((ss, p) => ss + p.income[mm.monthIdx], 0),
    0,
  );
  const totalExpense = period.reduce(
    (s, mm) => s + PROFILES.reduce((ss, p) => ss + p.expense[mm.monthIdx], 0),
    0,
  );

  const revenueMR = period.map((mm) => {
    const rev = PROFILES.reduce((s, p) => s + p.income[mm.monthIdx], 0);
    const gp = PROFILES.reduce((s, p) => s + p.income[mm.monthIdx] * (p.marginPct / 100), 0);
    return { month: mm.label, revenue: rev, mr: rev > 0 ? +(gp / rev * 100).toFixed(1) : 0 };
  });
  const netProfitMargin = period.map((mm) => {
    const rev = PROFILES.reduce((s, p) => s + p.income[mm.monthIdx], 0);
    const profit = PROFILES.reduce((s, p) => s + (p.income[mm.monthIdx] - p.expense[mm.monthIdx]) * 0.7, 0);
    return { month: mm.label, profit, margin: rev > 0 ? +((profit / rev) * 100).toFixed(1) : 0 };
  });
  const arSeed = [4.8, 5.1, 5.6, 5.4, 5.9, 6.2, 6.4, 6.5, 6.7, 6.8, 6.9, 7.0];
  const apSeed = [2.1, 2.2, 2.4, 2.3, 2.5, 2.6, 2.7, 2.7, 2.8, 2.8, 2.9, 2.9];
  const finSeed = [55, 56, 57, 58, 58, 59, 60, 60, 61, 61, 61, 62];
  const arDynamics = period.map((mm) => ({ month: mm.label, value: arSeed[mm.monthIdx] * 1_000_000 }));
  const apDynamics = period.map((mm) => ({ month: mm.label, value: apSeed[mm.monthIdx] * 1_000_000 }));
  const ncfByDirection = PROFILES.map((p) => ({
    direction: p.name,
    value: period.reduce((s, mm) => s + p.income[mm.monthIdx] - p.expense[mm.monthIdx], 0),
  }));
  const grossProfitByDir = PROFILES.map((p) => ({
    direction: p.name,
    value: Math.round(period.reduce((s, mm) => s + p.income[mm.monthIdx], 0) * (p.marginPct / 100)),
  }));
  const capitalStructure = [
    { name: "Собственный капитал", value: 18_500_000 },
    { name: "Долгосрочные займы", value: 6_200_000 },
    { name: "Краткосрочные займы", value: 3_100_000 },
    { name: "Кредиторская задолженность", value: 2_700_000 },
  ];
  const finIndependence = period.map((mm) => ({ month: mm.label, value: finSeed[mm.monthIdx] }));

  const lastSnap = ALL_SNAPSHOTS[ALL_SNAPSHOTS.length - 1];
  const warning =
    new Date(dateTo) > new Date(lastSnap)
      ? `Капитал показан по последнему доступному срезу: ${lastSnap.split("-").reverse().join(".")}`
      : null;

  const netCashFlow = totalIncome - totalExpense;
  const netProfit = Math.round(netCashFlow * 0.7);

  return delay(
    ok<DashboardPayload>({
      kpis: {
        netCashFlow,
        cashBuffer: 96,
        netProfit,
        netProfitMargin: totalIncome > 0 ? +((netProfit / totalIncome) * 100).toFixed(1) : 0,
        marginPct: 40.1,
        liquidity: 1.7,
        equity: 18_500_000,
        roe: 17.4,
        finIndependence: 62,
        arDays: 54,
        apDays: 28,
        arTurns: 6.8,
        apTurns: 13.0,
        totalIncome,
        totalExpense,
        currentAssets: 20_400_000,
        currentLiabilities: 12_000_000,
        status: "warn",
        topRisk: "Концентрация выручки на 1 направлении (42%)",
      },
      charts: {
        ncfByMonth,
        ncfByDirection,
        revenueMR,
        grossProfitByDir,
        netProfitMargin,
        arDynamics,
        apDynamics,
        capitalStructure,
        finIndependence,
      },
      tables: {},
      meta: makeMeta(dateFrom, dateTo, lastSnap, warning),
    }),
  );
}

// ============================================================================
// Money — фильтры реально влияют на все блоки
// ============================================================================

interface MoneyAgg {
  income: number[];      // длина = months периода
  expense: number[];     // длина = months периода
  byArticle: Map<string, number>;
  cpIn: Map<string, number>;
  cpOut: Map<string, number>;
  byDirection: Map<string, number>;
  months: PeriodMonth[];
}

function aggregateMoney(filters: MoneyParams): MoneyAgg {
  const profiles = selectProfiles({ direction: filters.direction, account: filters.account });
  const months = monthsInPeriod(filters.dateFrom, filters.dateTo);
  const income = new Array(months.length).fill(0);
  const expense = new Array(months.length).fill(0);
  const byArticle = new Map<string, number>();
  const cpIn = new Map<string, number>();
  const cpOut = new Map<string, number>();
  const byDirection = new Map<string, number>();

  for (const p of profiles) {
    const inMul = cpShare(p, "in", filters.counterparty);
    const outCpMul = cpShare(p, "out", filters.counterparty);
    const outArtMul = articleShare(p, filters.article);
    const outMul = outCpMul * outArtMul;

    for (let i = 0; i < months.length; i++) {
      const mi = months[i].monthIdx;
      income[i] += p.income[mi] * inMul;
      expense[i] += p.expense[mi] * outMul;
    }

    // Период-зависимые суммы по направлению (не годовые)
    const dirIncomeTotal = months.reduce((s, mm) => s + p.income[mm.monthIdx], 0);
    const dirExpenseTotal = months.reduce((s, mm) => s + p.expense[mm.monthIdx], 0);

    for (const [art, share] of Object.entries(p.articleShare)) {
      if (filters.article && filters.article !== art) continue;
      byArticle.set(art, (byArticle.get(art) ?? 0) + dirExpenseTotal * outCpMul * share);
    }
    for (const [cp, share] of Object.entries(p.cpIncomeShare)) {
      if (filters.counterparty && filters.counterparty !== cp) continue;
      cpIn.set(cp, (cpIn.get(cp) ?? 0) + dirIncomeTotal * share);
    }
    for (const [cp, share] of Object.entries(p.cpExpenseShare)) {
      if (filters.counterparty && filters.counterparty !== cp) continue;
      cpOut.set(cp, (cpOut.get(cp) ?? 0) + dirExpenseTotal * outArtMul * share);
    }

    const net = dirIncomeTotal * inMul - dirExpenseTotal * outMul;
    byDirection.set(p.name, (byDirection.get(p.name) ?? 0) + net);
  }

  return { income, expense, byArticle, cpIn, cpOut, byDirection, months };
}

function buildOddsTree(filters: MoneyParams): OddsSectionRow[] {
  const agg = aggregateMoney(filters);
  const months = agg.months;
  const profiles = selectProfiles({ direction: filters.direction, account: filters.account });

  // ----- Operating -----
  const opArticles: OddsArticleRow[] = [];
  if (!filters.article) {
    const incVals = agg.income;
    opArticles.push({
      article: "Выручка от продаж",
      kind: "Приход",
      months: months.map((mm, i) => ({ month: mm.label, value: incVals[i] * 0.9 })),
      total: incVals.reduce((a, b) => a + b, 0) * 0.9,
    });
    opArticles.push({
      article: "Прочие поступления",
      kind: "Приход",
      months: months.map((mm, i) => ({ month: mm.label, value: incVals[i] * 0.1 })),
      total: incVals.reduce((a, b) => a + b, 0) * 0.1,
    });
  }
  const totalExp = agg.expense.reduce((a, b) => a + b, 0);
  for (const [art, val] of agg.byArticle.entries()) {
    if (totalExp === 0) continue;
    const share = val / totalExp;
    opArticles.push({
      article: art,
      kind: "Расход",
      months: months.map((mm, i) => ({ month: mm.label, value: agg.expense[i] * share })),
      total: val,
    });
  }
  const opIncome = opArticles.filter((a) => a.kind === "Приход").reduce((s, a) => s + a.total, 0);
  const opExpense = opArticles.filter((a) => a.kind === "Расход").reduce((s, a) => s + a.total, 0);

  // ----- Investing / Financing — события привязаны к monthIdx. Если месяца
  // нет в периоде, событие не отображается и не считается в total.
  const hasInvFinScope = !filters.direction && !filters.account && !filters.counterparty && !filters.article;
  const eventArticle = (
    article: string,
    kind: "Приход" | "Расход",
    events: { monthIdx: number; value: number }[],
  ): OddsArticleRow | null => {
    const monthsCells = months.map((mm) => {
      const ev = events.find((e) => e.monthIdx === mm.monthIdx);
      return { month: mm.label, value: ev?.value ?? 0 };
    });
    const total = monthsCells.reduce((s, c) => s + c.value, 0);
    if (total === 0) return null;
    return { article, kind, months: monthsCells, total };
  };
  const invArticles: OddsArticleRow[] = hasInvFinScope
    ? ([eventArticle("Покупка оборудования", "Расход", [{ monthIdx: 4, value: 2_500_000 }])].filter(Boolean) as OddsArticleRow[])
    : [];
  const finArticles: OddsArticleRow[] = hasInvFinScope
    ? ([
        eventArticle("Получение кредита", "Приход", [{ monthIdx: 2, value: 5_000_000 }]),
        eventArticle("Дивиденды собственнику", "Расход", [{ monthIdx: 11, value: 1_500_000 }]),
        eventArticle(
          "Возврат тела кредита",
          "Расход",
          Array.from({ length: 12 }, (_, i) => ({ monthIdx: i, value: 200_000 })),
        ),
      ].filter(Boolean) as OddsArticleRow[])
    : [];

  const make = (section: string, arts: OddsArticleRow[]): OddsSectionRow => {
    const income = arts.filter((a) => a.kind === "Приход").reduce((s, a) => s + a.total, 0);
    const expense = arts.filter((a) => a.kind === "Расход").reduce((s, a) => s + a.total, 0);
    return { section, income, expense, net: income - expense, articles: arts };
  };

  const sections: OddsSectionRow[] = [
    { section: "Операционная деятельность", income: opIncome, expense: opExpense, net: opIncome - opExpense, articles: opArticles },
  ];
  if (invArticles.length) sections.push(make("Инвестиционная деятельность", invArticles));
  if (finArticles.length) sections.push(make("Финансовая деятельность", finArticles));
  void profiles;
  return sections;
}

export async function mockMoney(params: MoneyParams): Promise<ApiResponse<MoneyPayload>> {
  const agg = aggregateMoney(params);
  const opening = 4_100_000;
  let running = opening;
  const byMonth = agg.months.map((mm, i) => {
    const income = agg.income[i];
    const expense = agg.expense[i];
    const net = income - expense;
    running += net;
    return { month: mm.label, income, expense, net, balance: running, avgExpense: 0 };
  });
  const totalExpense = byMonth.reduce((s, r) => s + r.expense, 0);
  const totalIncome = byMonth.reduce((s, r) => s + r.income, 0);
  const avgExpense = byMonth.length > 0 ? totalExpense / byMonth.length : 0;
  byMonth.forEach((r) => (r.avgExpense = avgExpense));

  const expensesByArticle = Array.from(agg.byArticle.entries())
    .map(([article, value]) => ({ article, value, share: totalExpense > 0 ? (value / totalExpense) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);

  const byDirection = Array.from(agg.byDirection.entries())
    .map(([direction, value]) => ({ direction, value }))
    .sort((a, b) => b.value - a.value);

  const cpRows = [
    ...Array.from(agg.cpIn.entries()).map(([name, value]) => ({ name, value, kind: "Приход" as const })),
    ...Array.from(agg.cpOut.entries()).map(([name, value]) => ({ name, value, kind: "Расход" as const })),
  ].filter((r) => r.value > 1).sort((a, b) => b.value - a.value);

  const cashBuffer = avgExpense > 0 ? Math.round((running / avgExpense) * 30) : 0;

  return delay(
    ok<MoneyPayload>({
      kpis: {
        netCashFlow: totalIncome - totalExpense,
        cashBuffer,
        totalIncome,
        totalExpense,
        openingBalance: opening,
        closingBalance: running,
        avgMonthlyExpense: avgExpense,
      },
      charts: {
        byMonth,
        expensesByArticle,
        byDirection,
        counterparties: cpRows,
      },
      tables: { oddsTree: buildOddsTree(params) },
      meta: makeMeta(params.dateFrom, params.dateTo),
    }),
  );
}

// ============================================================================
// Profit — фильтры project / direction / article / section реально работают
// ============================================================================

// Базовая матрица проектов (для разреза проект×направление).
const PROJECT_ROWS: ProjectMatrixRow[] = [
  { direction: "Розница", project: "Магазин Север", revenue: 12_200_000, grossProfit: 4_700_000, marginPct: 38.5 },
  { direction: "Розница", project: "Магазин Юг", revenue: 10_200_000, grossProfit: 4_200_000, marginPct: 41.2 },
  { direction: "Опт", project: "B2B-канал", revenue: 18_700_000, grossProfit: 6_170_000, marginPct: 33.0 },
  { direction: "Онлайн", project: "Маркетплейс", revenue: 8_400_000, grossProfit: 3_500_000, marginPct: 41.7 },
  { direction: "Онлайн", project: "Сайт", revenue: 5_500_000, grossProfit: 2_600_000, marginPct: 47.3 },
  { direction: "Сервис", project: "Услуги монтажа", revenue: 5_800_000, grossProfit: 1_624_000, marginPct: 28.0 },
];

// Доля статьи в OPEX (используется для article-фильтра)
const OPEX_ARTICLE_SHARE: Record<string, number> = {
  "ФОТ": 0.55, "Маркетинг": 0.18, "Аренда": 0.14, "Прочее": 0.07, "Налоги": 0.04, "Закупка товара": 0.02,
};

export async function mockProfit(params: ProfitParams): Promise<ApiResponse<ProfitPayload>> {
  const { dateFrom, dateTo, project, direction, article, section } = params;
  const period = monthsInPeriod(dateFrom, dateTo);
  // Цифры в PROJECT_ROWS — годовые. Масштабируем под выбранный период,
  // иначе при Q1 показывались бы годовые суммы.
  const periodScale = period.length / 12;

  const filteredRows = PROJECT_ROWS.filter((r) => {
    if (project && r.project !== project) return false;
    if (direction && r.direction !== direction) return false;
    return true;
  }).map((r) => ({
    ...r,
    revenue: Math.round(r.revenue * periodScale),
    grossProfit: Math.round(r.grossProfit * periodScale),
  }));

  const revenue = filteredRows.reduce((s, r) => s + r.revenue, 0);
  const grossProfit = filteredRows.reduce((s, r) => s + r.grossProfit, 0);
  const cogs = revenue - grossProfit;

  const articleMul = article ? (OPEX_ARTICLE_SHARE[article] ?? 0) : 1;
  const baseFixedRatio = 0.268;
  const fixedCosts = Math.round(revenue * baseFixedRatio * articleMul);
  const operatingProfit = grossProfit - fixedCosts;
  const financialCosts = Math.round(revenue * 0.011);
  const taxes = Math.round(Math.max(0, operatingProfit - financialCosts) * 0.2);
  const netProfit = operatingProfit - financialCosts - taxes;

  const sectionSums = [
    { section: "Выручка", value: revenue, pctOfRevenue: 100 },
    { section: "Себестоимость", value: -cogs, pctOfRevenue: revenue ? (-cogs / revenue) * 100 : 0 },
    { section: "Валовая прибыль", value: grossProfit, pctOfRevenue: revenue ? (grossProfit / revenue) * 100 : 0 },
    { section: "Постоянные расходы", value: -fixedCosts, pctOfRevenue: revenue ? (-fixedCosts / revenue) * 100 : 0 },
    { section: "Операционная прибыль", value: operatingProfit, pctOfRevenue: revenue ? (operatingProfit / revenue) * 100 : 0 },
    { section: "Финансовые расходы", value: -financialCosts, pctOfRevenue: revenue ? (-financialCosts / revenue) * 100 : 0 },
    { section: "Налоги", value: -taxes, pctOfRevenue: revenue ? (-taxes / revenue) * 100 : 0 },
    { section: "Чистая прибыль", value: netProfit, pctOfRevenue: revenue ? (netProfit / revenue) * 100 : 0 },
  ];
  const filteredSectionSums = section ? sectionSums.filter((s) => s.section === section) : sectionSums;

  // Графики только по месяцам периода. Веса берём из PATTERN_GROW по monthIdx.
  const weightSum = period.reduce((s, mm) => s + PATTERN_GROW[mm.monthIdx], 0) || 1;
  const revenueMargin = period.map((mm) => {
    const w = PATTERN_GROW[mm.monthIdx] / weightSum;
    const monthRev = revenue * w;
    const monthMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    return { month: mm.label, revenue: monthRev, margin: +monthMargin.toFixed(1) };
  });
  const netProfitMargin = period.map((mm) => {
    const w = PATTERN_GROW[mm.monthIdx] / weightSum;
    const monthProfit = netProfit * w;
    const monthRev = revenue * w;
    return { month: mm.label, profit: monthProfit, margin: monthRev > 0 ? +((monthProfit / monthRev) * 100).toFixed(1) : 0 };
  });

  const dirMap = new Map<string, { rev: number; gp: number }>();
  filteredRows.forEach((r) => {
    const cur = dirMap.get(r.direction) ?? { rev: 0, gp: 0 };
    cur.rev += r.revenue;
    cur.gp += r.grossProfit;
    dirMap.set(r.direction, cur);
  });
  const revenueByDirection = Array.from(dirMap.entries()).map(([direction, v]) => ({ direction, value: v.rev }));
  const grossProfitByDirection = Array.from(dirMap.entries()).map(([direction, v]) => ({ direction, value: v.gp }));

  const pnl = [
    { label: "Выручка", value: revenue, kind: "revenue" as const },
    { label: "Себестоимость", value: -cogs, kind: "cogs" as const },
    { label: "Валовая прибыль", value: grossProfit, kind: "gross" as const },
    { label: "ФОТ", value: -Math.round(fixedCosts * 0.55), kind: "opex" as const },
    { label: "Маркетинг", value: -Math.round(fixedCosts * 0.18), kind: "opex" as const },
    { label: "Аренда и инфраструктура", value: -Math.round(fixedCosts * 0.14), kind: "opex" as const },
    { label: "Прочие операционные", value: -Math.round(fixedCosts * 0.13), kind: "opex" as const },
    { label: "Чистая прибыль", value: netProfit, kind: "net" as const },
  ];

  return delay(
    ok<ProfitPayload>({
      kpis: {
        revenue,
        cogs,
        grossProfit,
        marginPct: revenue ? (grossProfit / revenue) * 100 : 0,
        fixedCostsPct: revenue ? (fixedCosts / revenue) * 100 : 0,
        netProfit,
        netProfitMargin: revenue ? (netProfit / revenue) * 100 : 0,
      },
      charts: { revenueMargin, revenueByDirection, grossProfitByDirection, netProfitMargin },
      tables: { pnl, sectionSums: filteredSectionSums, projectMatrix: filteredRows },
      meta: makeMeta(dateFrom, dateTo),
    }),
  );
}

// ============================================================================
// Capital — срез выбирается строго ≤ dateTo (нельзя получить срез из будущего)
// ============================================================================

// Детерминированная серия параметров по индексу среза, чтобы цифры заметно
// отличались между периодами и сохраняли смысл (растущий бизнес).
function snapshotProfile(idx: number, total: number) {
  const t = total > 1 ? idx / (total - 1) : 1; // 0..1
  // Сначала фиксируем активы и привлечённые обязательства, затем выводим
  // собственный капитал из тождества баланса. Так Актив == Пассив гарантированно.
  const cash = Math.round(1_800_000 + t * 2_900_000);
  const ar = Math.round(3_200_000 + t * 4_200_000);
  const inventory = Math.round(5_200_000 + t * 5_400_000);
  const fixedAssets = Math.round(7_200_000 + t * 3_500_000);
  const longLoans = Math.round(8_000_000 - t * 2_500_000);          // 8М → 5.5М
  const shortLoans = Math.round(2_200_000 + t * 1_400_000);         // 2.2М → 3.6М
  const ap = Math.round(1_400_000 + t * 1_600_000);                 // 1.4М → 3.0М

  const currentAssets = cash + ar + inventory;
  const totalAssets = currentAssets + fixedAssets;
  const currentLiabilities = shortLoans + ap;
  const equity = totalAssets - longLoans - currentLiabilities;       // выводим из баланса
  const liquidity = currentAssets / currentLiabilities;
  const finIndependence = (equity / totalAssets) * 100;
  return {
    equity, longLoans, shortLoans, ap, cash, ar, inventory, fixedAssets,
    currentAssets, totalAssets, currentLiabilities, liquidity, finIndependence,
  };
}

function makeBalanceFor(p: ReturnType<typeof snapshotProfile>): BalanceRow[] {
  const equityRetained = p.equity - 1_000_000;
  return [
    { section1: "Актив", section2: "Оборотные", section3: "Денежные средства", section4: "Расчётные счета", amount: Math.round(p.cash * 0.8) },
    { section1: "Актив", section2: "Оборотные", section3: "Денежные средства", section4: "Касса", amount: Math.round(p.cash * 0.2) },
    { section1: "Актив", section2: "Оборотные", section3: "Дебиторская задолженность", section4: "Покупатели", amount: p.ar },
    { section1: "Актив", section2: "Оборотные", section3: "Запасы", section4: "Товары на складе", amount: Math.round(p.inventory * 0.85) },
    { section1: "Актив", section2: "Оборотные", section3: "Запасы", section4: "Сырьё и материалы", amount: Math.round(p.inventory * 0.15) },
    { section1: "Актив", section2: "Внеоборотные", section3: "Основные средства", section4: "Оборудование", amount: Math.round(p.fixedAssets * 0.72) },
    { section1: "Актив", section2: "Внеоборотные", section3: "Основные средства", section4: "Транспорт", amount: Math.round(p.fixedAssets * 0.28) },
    { section1: "Пассив", section2: "Собственный капитал", section3: "Уставный капитал", section4: "Уставный капитал", amount: 1_000_000 },
    { section1: "Пассив", section2: "Собственный капитал", section3: "Нераспределённая прибыль", section4: "Накопленная прибыль", amount: equityRetained },
    { section1: "Пассив", section2: "Долгосрочные обязательства", section3: "Займы", section4: "Банковский кредит", amount: p.longLoans },
    { section1: "Пассив", section2: "Краткосрочные обязательства", section3: "Займы", section4: "Краткосрочный кредит", amount: p.shortLoans },
    { section1: "Пассив", section2: "Краткосрочные обязательства", section3: "Кредиторская задолженность", section4: "Поставщики", amount: p.ap },
  ];
}

const ruDate = (iso: string) => iso.split("-").reverse().join(".");

export async function mockCapital({ dateTo }: CapitalParams): Promise<ApiResponse<CapitalPayload>> {
  // 1) Подобрать ближайший срез ≤ dateTo. Никогда не возвращать срез ИЗ БУДУЩЕГО.
  // 2) Если срезов до dateTo нет — взять самый ранний и пометить warning.
  const target = new Date(dateTo);
  const earlier = ALL_SNAPSHOTS.filter((s) => new Date(s) <= target);
  let snapshot: string;
  let warning: string | null = null;
  if (earlier.length > 0) {
    snapshot = earlier[earlier.length - 1];
    if (snapshot !== dateTo.slice(0, 10)) {
      warning = `Капитал показан по последнему доступному срезу: ${ruDate(snapshot)}`;
    }
  } else {
    snapshot = ALL_SNAPSHOTS[0];
    warning = `На выбранную дату нет среза капитала. Показан ближайший: ${ruDate(snapshot)}`;
  }

  const idx = ALL_SNAPSHOTS.indexOf(snapshot);
  const p = snapshotProfile(idx, ALL_SNAPSHOTS.length);

  // Доступные к выбору срезы — только те, что ≤ dateTo (нельзя выбрать будущий).
  const selectableSnapshots = earlier.length > 0 ? earlier : [snapshot];

  // ДЗ/КЗ — помесячная динамика года выбранного среза.
  const baseAr = p.ar / 12 * 11.5;
  const baseAp = p.ap / 12 * 11.5;
  const arDynamic = MONTHS.map((m, i) => ({ month: m, value: Math.round(baseAr * (0.85 + i * 0.025)) }));
  const apDynamic = MONTHS.map((m, i) => ({ month: m, value: Math.round(baseAp * (0.85 + i * 0.025)) }));

  // Серии по срезам: показываем ВСЕ срезы ≤ dateTo (нет проекции в будущее).
  const seriesSnapshots = earlier.length > 0 ? earlier : [snapshot];
  const seriesProfiles = seriesSnapshots.map((s) => ({
    date: s,
    prof: snapshotProfile(ALL_SNAPSHOTS.indexOf(s), ALL_SNAPSHOTS.length),
  }));

  return delay(
    ok<CapitalPayload>({
      kpis: {
        equity: p.equity,
        currentAssets: p.currentAssets,
        currentLiabilities: p.currentLiabilities,
        liquidity: p.liquidity,
        totalAssets: p.totalAssets,
        finIndependence: p.finIndependence,
        arValue: p.ar,
        apValue: p.ap,
        arDays: 54,
        apDays: 28,
      },
      charts: {
        assetsStructure: [
          { name: "Деньги", value: p.cash },
          { name: "Дебиторская задолженность", value: p.ar },
          { name: "Запасы", value: p.inventory },
          { name: "Основные средства", value: p.fixedAssets },
        ],
        liabilitiesStructure: [
          { name: "Собственный капитал", value: p.equity },
          { name: "Долгосрочные займы", value: p.longLoans },
          { name: "Краткосрочные займы", value: p.shortLoans },
          { name: "Кредиторская задолженность", value: p.ap },
        ],
        arDynamic,
        apDynamic,
        capitalDynamic: seriesProfiles.map((x) => ({
          date: x.date,
          equity: x.prof.equity,
          liabilities: x.prof.longLoans + x.prof.shortLoans + x.prof.ap,
        })),
        liquidityDynamic: seriesProfiles.map((x) => ({ date: x.date, value: +x.prof.liquidity.toFixed(2) })),
        finIndependenceDynamic: seriesProfiles.map((x) => ({ date: x.date, value: +x.prof.finIndependence.toFixed(1) })),
      },
      tables: { balance: makeBalanceFor(p) },
      meta: { ...makeMeta(snapshot, snapshot, snapshot, warning), allSnapshotDates: selectableSnapshots },
    }),
  );
}

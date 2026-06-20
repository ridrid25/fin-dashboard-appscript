// Adapters: raw Apps Script API → strict typed payloads used by UI.
//
// Apps Script возвращает структуру, которая отличается от mock-типов.
// Здесь только маппинг полей, никаких выдуманных значений.

import type {
  BalanceRow,
  CapitalPayload,
  DashboardPayload,
  Meta,
  MoneyPayload,
  OddsArticleRow,
  OddsSectionRow,
  OperationKind,
  ProfitPayload,
  ProjectMatrixRow,
  SectionSum,
  StatusLevel,
} from "@/types/finance";

import { toPct } from "@/lib/format";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const monthOf = (iso: string): string => (iso ? iso.slice(0, 7) : "");
const dateOf = (iso: string): string => (iso ? iso.slice(0, 10) : "");

function inRange(month: string, from: string, to: string): boolean {
  const f = from.slice(0, 7);
  const t = to.slice(0, 7);
  return (!f || month >= f) && (!t || month <= t);
}

function baseMeta(raw: Raw, params: { dateFrom?: string; dateTo: string }): Meta {
  const m = (raw?.meta ?? {}) as Raw;
  const dateFrom = params.dateFrom ?? dateOf(str(m.dateFrom)) ?? "";
  const dateTo = params.dateTo;
  return {
    dateFrom,
    dateTo,
    snapshotDate: dateOf(str(m.snapshotDate)) || dateTo,
    periodStart: dateOf(str(m.periodStart)) || dateFrom,
    periodEnd: dateOf(str(m.periodEnd)) || dateTo,
    warning: m.warning ? String(m.warning) : null,
    accounts: arr<string>(m.accounts),
    counterparties: arr<string>(m.counterparties),
    articles: arr<string>(m.articles),
    directions: arr<string>(m.directions),
    projects: arr<string>(m.projects),
    sections: arr<string>(m.sections),
    allSnapshotDates: arr<string>(m.allSnapshotDates).map(dateOf),
  };
}

// ============================ MONEY ============================
export function adaptMoney(raw: Raw, params: { dateFrom: string; dateTo: string }): MoneyPayload {
  const k = raw?.kpis ?? {};
  const c = raw?.charts ?? {};
  const t = raw?.tables ?? {};
  const meta = baseMeta(raw, params);

  const byMonth = arr<Raw>(c.byMonth).map((r) => {
    const income = num(r.income);
    const expense = num(r.expense);
    const net = num(r.net);
    return {
      month: str(r.month),
      income,
      expense,
      net,
      balance: num(r.balance),
      avgExpense: num(r.avgExpense ?? k.avgMonthlyExpense),
    };
  });

  const expensesByArticle = arr<Raw>(c.expenseStructure).map((r) => ({
    article: str(r.article),
    value: num(r.amount),
    share: toPct(num(r.share)),
  }));

  const byDirection = arr<Raw>(c.byDirection).map((r) => ({
    direction: str(r.direction),
    value: num(r.amount ?? r.value),
  }));

  // byCounterparty -> плоский список с kind.
  const bc = (c.byCounterparty ?? {}) as Raw;
  const suppliers = arr<Raw>(bc.suppliers?.items).map((r) => ({
    name: str(r.name),
    value: num(r.amount),
    kind: "Расход" as OperationKind,
  }));
  const buyers = arr<Raw>(bc.buyers?.items).map((r) => ({
    name: str(r.name),
    value: num(r.amount),
    kind: "Приход" as OperationKind,
  }));
  const counterparties = [...buyers, ...suppliers];

  // odds -> oddsTree (Раздел → Статья → месяцы).
  const odds = arr<Raw>(t.odds).filter((r) => str(r.sectionOdds) && r.sectionOdds !== "__BALANCE__");
  const monthsKeys = byMonth.map((m) => m.month);
  const sectionsMap = new Map<string, OddsSectionRow>();
  for (const r of odds) {
    const section = str(r.sectionOdds);
    const kind = (str(r.operationType) === "Приход" ? "Приход" : "Расход") as OperationKind;
    const monthly = (r.monthlyAmounts ?? {}) as Record<string, number>;
    const article: OddsArticleRow = {
      article: str(r.article),
      kind,
      months: monthsKeys.map((m) => ({ month: m, value: num(monthly[m]) })),
      total: num(r.total),
    };
    let sec = sectionsMap.get(section);
    if (!sec) {
      sec = { section, income: 0, expense: 0, net: 0, articles: [] };
      sectionsMap.set(section, sec);
    }
    sec.articles.push(article);
    const signed = kind === "Приход" ? article.total : -article.total;
    if (kind === "Приход") sec.income += article.total;
    else sec.expense += article.total;
    sec.net += signed;
  }
  const oddsTree = Array.from(sectionsMap.values());

  return {
    kpis: {
      netCashFlow: num(k.netCashFlow),
      cashBuffer: num(k.cashBuffer),
      totalIncome: num(k.totalIncome),
      totalExpense: Math.abs(num(k.totalExpense)),
      openingBalance: num(k.openingBalance),
      closingBalance: num(k.closingBalance),
      avgMonthlyExpense: num(k.avgMonthlyExpense),
    },
    charts: { byMonth, expensesByArticle, byDirection, counterparties },
    tables: { oddsTree },
    meta,
  };
}

// ============================ PROFIT ============================
const SECTION_LABELS: Record<string, string> = {
  "1": "Выручка",
  "2": "Себестоимость",
  "3": "Постоянные расходы",
  "4": "Налоги",
  "5": "Операционные прочее",
  "6": "Прочие доходы",
  "7": "Финансовые расходы",
  "8": "Прочее",
};

export function adaptProfit(raw: Raw, params: { dateFrom: string; dateTo: string }): ProfitPayload {
  const k = raw?.kpis ?? {};
  const c = raw?.charts ?? {};
  const t = raw?.tables ?? {};
  const meta = baseMeta(raw, params);

  const revenue = num(k.revenue);

  // sectionSums dict {1..8} -> массив.
  const sumDict = (k.sectionSums ?? {}) as Record<string, number>;
  const sectionSums: SectionSum[] = Object.keys(sumDict)
    .sort()
    .map((key) => {
      const value = num(sumDict[key]);
      return {
        section: SECTION_LABELS[key] ?? `Раздел ${key}`,
        value,
        pctOfRevenue: revenue !== 0 ? (value / revenue) * 100 : 0,
      };
    });

  // revenueMargin: {month, revenue, grossProfit, marginPct} -> {month, revenue, margin}
  const revenueMargin = arr<Raw>(c.revenueMargin).map((r) => ({
    month: str(r.month),
    revenue: num(r.revenue),
    margin: toPct(num(r.marginPct)),
  }));

  // revenueByDirection / grossProfitByDirection: monthly с ключами-направлениями.
  function aggByDirection(rows: Raw[]): { direction: string; value: number }[] {
    const totals = new Map<string, number>();
    for (const row of rows) {
      for (const [key, val] of Object.entries(row)) {
        if (key === "month") continue;
        totals.set(key, (totals.get(key) ?? 0) + num(val));
      }
    }
    return Array.from(totals.entries()).map(([direction, value]) => ({ direction, value }));
  }
  const revenueByDirection = aggByDirection(arr<Raw>(c.revenueByDirection));
  const grossProfitByDirection = aggByDirection(arr<Raw>(c.grossProfitByDirection));

  const netProfitMargin = arr<Raw>(c.netProfitMargin).map((r) => ({
    month: str(r.month),
    profit: num(r.netProfit),
    margin: toPct(num(r.marginPct)),
  }));

  // byProject -> projectMatrix (flat).
  const projectMatrix: ProjectMatrixRow[] = [];
  for (const dir of arr<Raw>(t.byProject)) {
    const direction = str(dir.direction);
    for (const p of arr<Raw>(dir.projects)) {
      projectMatrix.push({
        direction,
        project: str(p.name),
        revenue: num(p.revenue),
        grossProfit: num(p.grossProfit),
        marginPct: toPct(num(p.marginPct)),
      });
    }
  }

  // PNL не приходит из API; оставляем пустым (UI его не использует).
  return {
    kpis: {
      revenue,
      cogs: Math.abs(num(k.costOfGoods ?? k.cogs)),
      grossProfit: num(k.grossProfit),
      marginPct: toPct(num(k.marginPct)),
      fixedCostsPct: toPct(num(k.fixedCostsPct)),
      netProfit: num(k.netProfit),
      netProfitMargin: toPct(num(k.netProfitMargin)),
    },
    charts: { revenueMargin, revenueByDirection, grossProfitByDirection, netProfitMargin },
    tables: { pnl: [], sectionSums, projectMatrix },
    meta,
  };
}

// ============================ CAPITAL ============================
export function adaptCapital(raw: Raw, params: { dateTo: string }): CapitalPayload {
  const k = raw?.kpis ?? {};
  const c = raw?.charts ?? {};
  const t = raw?.tables ?? {};
  const meta = baseMeta(raw, { dateTo: params.dateTo });

  const balance: BalanceRow[] = arr<Raw>(t.balanceSheet ?? t.balance).map((r) => {
    const s1raw = str(r.section1);
    const section1 = s1raw === "Активы" ? "Актив" : s1raw === "Пассивы" ? "Пассив" : s1raw;
    return {
      section1,
      section2: str(r.section2),
      section3: str(r.section3),
      section4: str(r.section4),
      amount: num(r.amount),
    };
  });

  return {
    kpis: {
      equity: num(k.equity),
      currentAssets: num(k.currentAssets),
      currentLiabilities: num(k.currentLiabilities),
      liquidity: num(k.liquidity),
      totalAssets: num(k.totalAssets),
      finIndependence: toPct(num(k.finIndependence)),
      arValue: num(k.arValue),
      apValue: num(k.apValue),
      arDays: num(k.arDays),
      apDays: num(k.apDays),
    },
    charts: {
      assetsStructure: arr<Raw>(c.assetsStructure).map((r) => ({ name: str(r.name), value: num(r.value) })),
      liabilitiesStructure: arr<Raw>(c.liabilitiesStructure).map((r) => ({ name: str(r.name), value: num(r.value) })),
      arDynamic: arr<Raw>(c.arDynamics).map((r) => ({ month: monthOf(str(r.date ?? r.month)), value: num(r.value) })),
      apDynamic: arr<Raw>(c.apDynamics).map((r) => ({ month: monthOf(str(r.date ?? r.month)), value: num(r.value) })),
      capitalDynamic: arr<Raw>(c.capitalStructure ?? c.capitalDynamic).map((r) => ({
        date: dateOf(str(r.date)),
        equity: num(r.equity),
        liabilities: num(r.liabilities),
      })),
      liquidityDynamic: arr<Raw>(c.liquidityChart ?? c.liquidityDynamic).map((r) => ({
        date: dateOf(str(r.date)),
        value: num(r.ratio ?? r.value),
      })),
      finIndependenceDynamic: arr<Raw>(c.independenceChart ?? c.finIndependenceDynamic).map((r) => ({
        date: dateOf(str(r.date)),
        value: toPct(num(r.ratio ?? r.value)),
      })),
    },
    tables: { balance },
    meta,
  };
}

// ============================ DASHBOARD ============================
export function adaptDashboard(raw: Raw, params: { dateFrom: string; dateTo: string }): DashboardPayload {
  const k = raw?.kpis ?? {};
  const c = raw?.charts ?? {};
  const meta = baseMeta(raw, params);

  const filterMonth = <T extends { month: string }>(rows: T[]): T[] =>
    rows.filter((r) => inRange(r.month, params.dateFrom, params.dateTo));

  const ncfByMonth = filterMonth(
    arr<Raw>(c.netCashByMonth).map((r) => ({ month: str(r.month), value: num(r.net) })),
  );
  const ncfByDirection = arr<Raw>(c.netCashByDirection).map((r) => ({
    direction: str(r.direction),
    value: num(r.net ?? r.value),
  }));
  const revenueMR = filterMonth(
    arr<Raw>(c.revenueMR).map((r) => ({
      month: str(r.month),
      revenue: num(r.revenue),
      mr: toPct(num(r.marginPct ?? r.mr)),
    })),
  );
  const netProfitMarginChart = filterMonth(
    arr<Raw>(c.netProfitMargin).map((r) => ({
      month: str(r.month),
      profit: num(r.netProfit ?? r.profit),
      margin: toPct(num(r.marginPct ?? r.margin)),
    })),
  );
  // grossProfitByDir в API monthly с ключами-направлениями -> агрегируем.
  const gpAgg = new Map<string, number>();
  for (const row of arr<Raw>(c.grossProfitByDir)) {
    if (!inRange(str(row.month), params.dateFrom, params.dateTo)) continue;
    for (const [key, val] of Object.entries(row)) {
      if (key === "month") continue;
      gpAgg.set(key, (gpAgg.get(key) ?? 0) + num(val));
    }
  }
  const grossProfitByDir = Array.from(gpAgg.entries()).map(([direction, value]) => ({ direction, value }));

  const arDynamics = arr<Raw>(c.arDynamics).map((r) => ({ month: monthOf(str(r.date ?? r.month)), value: num(r.value) }));
  const apDynamics = arr<Raw>(c.apDynamics).map((r) => ({ month: monthOf(str(r.date ?? r.month)), value: num(r.value) }));
  const finIndependence = arr<Raw>(c.finIndependence).map((r) => ({
    month: monthOf(str(r.date ?? r.month)),
    value: toPct(num(r.ratio ?? r.value)),
  }));
  const capitalStructure = arr<Raw>(c.capitalStructure).map((r) => ({
    name: dateOf(str(r.date)),
    value: num(r.equity) + num(r.liabilities),
  }));

  // status — derived на frontend: API не возвращает status/topRisk.
  const finIndep = toPct(num(k.finIndependence));
  const netProfit = num(k.netProfit);
  const status: StatusLevel = netProfit >= 0 && finIndep >= 50 ? "good" : netProfit < 0 ? "bad" : "warn";
  const topRiskRaw = typeof k.topRisk === "string" ? k.topRisk.trim() : "";
  const topRisk: string | null = topRiskRaw || null;

  return {
    kpis: {
      netCashFlow: num(k.netCashFlow),
      cashBuffer: num(k.cashBuffer),
      netProfit,
      netProfitMargin: toPct(num(k.netProfitMargin)),
      marginPct: toPct(num(k.marginPct)),
      liquidity: num(k.liquidity),
      equity: num(k.equity),
      roe: toPct(num(k.roe)),
      finIndependence: finIndep,
      arDays: num(k.arDays),
      apDays: num(k.apDays),
      arTurns: num(k.arTurns),
      apTurns: num(k.apTurns),
      totalIncome: num(k.totalIncome),
      totalExpense: Math.abs(num(k.totalExpense)),
      currentAssets: num(k.currentAssets),
      currentLiabilities: num(k.currentLiabilities),
      status,
      topRisk,
    },
    charts: {
      ncfByMonth,
      ncfByDirection,
      revenueMR,
      grossProfitByDir,
      netProfitMargin: netProfitMarginChart,
      arDynamics,
      apDynamics,
      capitalStructure,
      finIndependence,
    },
    tables: {},
    meta,
  };
}

// ============================ DASHBOARD COMPOSITE (live) ============================
// В live-режиме api=dashboard возвращает данные, привязанные к срезу капитала,
// а не к выбранному периоду. Поэтому Dashboard собираем сами из 3 endpoint-ов.
export function composeDashboard(
  params: { dateFrom: string; dateTo: string },
  money: MoneyPayload,
  profit: ProfitPayload,
  capital: CapitalPayload | null,
  capitalError: string | null,
): DashboardPayload {
  const mk = money.kpis;
  const pk = profit.kpis;
  const ck = capital?.kpis;

  const equity = ck?.equity ?? 0;
  const netProfit = pk.netProfit;
  const roe = equity > 0 ? (netProfit / equity) * 100 : 0;
  const finIndependence = ck?.finIndependence ?? 0;
  const liquidity = ck?.liquidity ?? 0;

  // ---- ДЗ/КЗ в днях: считаем сами от revenue/cogs за период и средней ДЗ/КЗ.
  const periodDays = (() => {
    if (!params.dateFrom || !params.dateTo) return 0;
    const a = new Date(params.dateFrom).getTime();
    const b = new Date(params.dateTo).getTime();
    if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
    return Math.round((b - a) / 86_400_000) + 1;
  })();

  const pickAvg = (
    series: { month: string; value: number }[] | undefined,
    fallback: number,
  ): { avg: number; estimated: boolean } => {
    const pts = (series ?? []).filter((p) => Number.isFinite(p.value) && p.value !== 0);
    if (pts.length >= 2) {
      const sorted = [...pts].sort((a, b) => a.month.localeCompare(b.month));
      return { avg: (sorted[0].value + sorted[sorted.length - 1].value) / 2, estimated: false };
    }
    if (pts.length === 1) return { avg: pts[0].value, estimated: true };
    if (fallback > 0) return { avg: fallback, estimated: true };
    return { avg: 0, estimated: false };
  };

  const arValue = ck?.arValue ?? 0;
  const apValue = ck?.apValue ?? 0;
  const revenue = pk.revenue;
  const cogsAbs = Math.abs(pk.cogs);

  let arDays = 0;
  let arTurns = 0;
  let arEstimated = false;
  if (revenue > 0 && periodDays > 0) {
    const { avg, estimated } = pickAvg(capital?.charts.arDynamic, arValue);
    if (avg > 0) {
      arDays = (avg / revenue) * periodDays;
      arTurns = revenue / avg;
      arEstimated = estimated;
    }
  }

  let apDays = 0;
  let apTurns = 0;
  let apEstimated = false;
  if (cogsAbs > 0 && periodDays > 0) {
    const { avg, estimated } = pickAvg(capital?.charts.apDynamic, apValue);
    if (avg > 0) {
      apDays = (avg / cogsAbs) * periodDays;
      apTurns = cogsAbs / avg;
      apEstimated = estimated;
    }
  }

  const status: StatusLevel =
    netProfit >= 0 && finIndependence >= 50 ? "good" : netProfit < 0 ? "bad" : "warn";

  const ncfByMonth = money.charts.byMonth.map((m) => ({ month: m.month, value: m.net }));
  const ncfByDirection = money.charts.byDirection;
  const revenueMR = profit.charts.revenueMargin.map((r) => ({
    month: r.month,
    revenue: r.revenue,
    mr: r.margin,
  }));
  const grossProfitByDir = profit.charts.grossProfitByDirection.map((d) => ({
    direction: d.direction,
    value: d.value,
  }));
  const netProfitMarginChart = profit.charts.netProfitMargin;
  const arDynamics = capital?.charts.arDynamic ?? [];
  const apDynamics = capital?.charts.apDynamic ?? [];
  const capitalStructure = (capital?.charts.capitalDynamic ?? []).map((r) => ({
    name: r.date,
    value: r.equity + r.liabilities,
  }));
  const finIndependenceChart = (capital?.charts.finIndependenceDynamic ?? []).map((r) => ({
    month: r.date.slice(0, 7),
    value: r.value,
  }));

  // warning по капиталу: срез позже dateTo не может быть; если раньше — предупреждаем.
  let warning: string | null = null;
  if (capitalError) {
    warning = `Капитал недоступен: ${capitalError}`;
  } else if (capital && capital.meta.snapshotDate && capital.meta.snapshotDate < params.dateTo) {
    const d = capital.meta.snapshotDate.slice(0, 10).split("-");
    warning = `Капитал по срезу ${d[2]}.${d[1]}.${d[0]}`;
  }

  const dictUnion = (a?: string[], b?: string[], c?: string[]): string[] => {
    const set = new Set<string>();
    for (const list of [a, b, c]) if (list) for (const v of list) if (v) set.add(v);
    return Array.from(set);
  };

  const meta: Meta = {
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    periodStart: params.dateFrom,
    periodEnd: params.dateTo,
    snapshotDate: capital?.meta.snapshotDate ?? params.dateTo,
    warning,
    accounts: money.meta.accounts,
    counterparties: money.meta.counterparties,
    articles: dictUnion(money.meta.articles, profit.meta.articles),
    directions: dictUnion(money.meta.directions, profit.meta.directions),
    projects: profit.meta.projects,
    sections: profit.meta.sections,
    allSnapshotDates: capital?.meta.allSnapshotDates,
  };

  return {
    kpis: {
      netCashFlow: mk.netCashFlow,
      cashBuffer: mk.cashBuffer,
      netProfit,
      netProfitMargin: pk.netProfitMargin,
      marginPct: pk.marginPct,
      liquidity,
      equity,
      roe,
      finIndependence,
      arDays,
      apDays,
      arTurns,
      apTurns,
      totalIncome: mk.totalIncome,
      totalExpense: mk.totalExpense,
      currentAssets: ck?.currentAssets ?? 0,
      currentLiabilities: ck?.currentLiabilities ?? 0,
      status,
      topRisk: null,
      arEstimated,
      apEstimated,
    },
    charts: {
      ncfByMonth,
      ncfByDirection,
      revenueMR,
      grossProfitByDir,
      netProfitMargin: netProfitMarginChart,
      arDynamics,
      apDynamics,
      capitalStructure,
      finIndependence: finIndependenceChart,
    },
    tables: {},
    meta,
  };
}

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  Info,
  Landmark,
  Scale,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Card, SectionTitle, StatusBadge } from "@/components/finance/primitives";
import { useDashboard } from "@/hooks/use-finance";
import { daysToMonths, fmtDays, fmtMoney, fmtMonths, fmtPct, fmtRatio, formatDateRuShort, formatPeriodRange, daysBetweenIso } from "@/lib/format";
import type { StatusLevel } from "@/types/finance";
import { ChartTooltipContent, chartTooltipCursor, chartTooltipCursorLine } from "@/components/finance/ChartTooltip";
import { SparkPoints } from "@/components/finance/SparkPoints";
import { usePeriod } from "@/context/period-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Дэшборд — CFO" },
      { name: "description", content: "Executive summary: деньги, прибыль, ликвидность, капитал, ROE, ДЗ/КЗ." },
    ],
  }),
  component: DashboardPage,
});

/* ──────────────── visual primitives ──────────────── */

const chartGrid = { stroke: "var(--color-border)", strokeDasharray: "3 3", strokeOpacity: 0.4 } as const;
const axisProps = { stroke: "var(--color-muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const;

type Accent = "money" | "profit" | "capital";

const ACCENT: Record<Accent, { ring: string; bg: string; text: string; bar: string; soft: string }> = {
  money: {
    ring: "ring-income/30",
    bg: "bg-income/10",
    text: "text-income",
    bar: "from-income/80",
    soft: "from-income/10",
  },
  profit: {
    ring: "ring-good/30",
    bg: "bg-good/10",
    text: "text-good",
    bar: "from-good/80",
    soft: "from-good/10",
  },
  capital: {
    ring: "ring-chart-4/30",
    bg: "bg-chart-4/10",
    text: "text-chart-4",
    bar: "from-chart-4/80",
    soft: "from-chart-4/10",
  },
};

function EmptyMini({ note = "Нет данных за выбранный период" }: { note?: string }) {
  return <div className="grid h-24 place-items-center text-xs text-muted-foreground">{note}</div>;
}

/* ──────────────── hero ──────────────── */

type DerivedStatus = { level: StatusLevel; text: string; summary: string };

function deriveStatus(args: {
  netProfit: number;
  netCashFlow: number;
  liquidity: number;
  hasCL: boolean;
  equity: number;
  isEmpty: boolean;
}): DerivedStatus {
  const { netProfit, netCashFlow, liquidity, hasCL, equity, isEmpty } = args;
  if (isEmpty) {
    return { level: "good", text: "Нет операций", summary: "За выбранный период операций нет." };
  }
  const lowLiq = hasCL && liquidity > 0 && liquidity < 1;
  // Риск: только при конкретной причине.
  if (netProfit < 0 && netCashFlow < 0) {
    return {
      level: "bad",
      text: "Риск",
      summary: "Прибыль и денежный поток отрицательные — требуется план восстановления.",
    };
  }
  if (equity < 0) {
    return { level: "bad", text: "Риск", summary: "Отрицательный собственный капитал." };
  }
  if (lowLiq) {
    return { level: "bad", text: "Риск", summary: "Текущая ликвидность ниже 1 при наличии краткосрочных обязательств." };
  }
  // Внимание: одно из двух — прибыль и поток расходятся.
  if (netProfit > 0 && netCashFlow < 0) {
    return {
      level: "warn",
      text: "Есть отклонения",
      summary: "Прибыль есть, но денежный поток отрицательный — проверьте платежи и ДЗ.",
    };
  }
  if (netProfit <= 0 && netCashFlow >= 0) {
    return {
      level: "warn",
      text: "Есть отклонения",
      summary: "Денежный поток положительный, но прибыль ниже нуля — проверьте себестоимость.",
    };
  }
  // Устойчиво.
  return {
    level: "good",
    text: "Устойчиво",
    summary: "Прибыль положительная, денежный поток сильный.",
  };
}

function Hero({
  status,
  statusText,
  summary,
  netProfit,
  netCashFlow,
  periodStart,
  periodEnd,
  snapshotDate,
}: {
  status: StatusLevel;
  statusText: string;
  summary: string;
  netProfit: number;
  netCashFlow: number;
  periodStart: string;
  periodEnd: string;
  snapshotDate: string;
}) {
  const glowA = status === "good" ? "from-good/15" : status === "warn" ? "from-warn/15" : "from-bad/15";
  const glowB = "from-chart-4/12";

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-card">
      <div className={`pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full bg-gradient-to-br ${glowA} to-transparent blur-3xl`} />
      <div className={`pointer-events-none absolute -left-24 bottom-[-6rem] h-64 w-64 rounded-full bg-gradient-to-tr ${glowB} to-transparent blur-3xl`} />
      <div className="relative p-5 sm:p-8">
        {(() => {
          const diff = daysBetweenIso(periodEnd, snapshotDate);
          const mismatch = diff !== 0;
          const tipText = "Срез капитала берётся как ближайшая доступная дата баланса не позже конца периода.";
          return (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="uppercase tracking-wider opacity-70">Период:</span>
                <span className="tabular font-medium text-foreground/90">{formatPeriodRange(periodStart, periodEnd)}</span>
              </span>
              <span className="hidden h-3 w-px bg-border/60 sm:inline-block" />
              <span className="inline-flex items-center gap-1.5">
                <span className="uppercase tracking-wider opacity-70">Капитал:</span>
                <span className="tabular font-medium text-foreground/90">срез {formatDateRuShort(snapshotDate)}</span>
                {mismatch && (
                  <span
                    title={tipText}
                    aria-label={tipText}
                    className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center text-muted-foreground/80 hover:text-foreground"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </span>
                )}
              </span>
            </div>
          );
        })()}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <StatusBadge level={status}>{statusText}</StatusBadge>
          <span className="text-xs text-muted-foreground">оценка по данным периода</span>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-[1fr_1px_1fr] sm:items-end">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Чистая прибыль</div>
            <div className={`mt-1 font-display text-4xl font-bold leading-none tabular sm:text-5xl ${netProfit >= 0 ? "text-foreground" : "text-bad"}`}>
              {fmtMoney(netProfit, { sign: true })}
            </div>
          </div>
          <div className="hidden h-12 self-end bg-border/60 sm:block" />
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Денежный поток</div>
            <div className={`mt-1 font-display text-3xl font-bold leading-none tabular sm:text-4xl ${netCashFlow >= 0 ? "text-good" : "text-bad"}`}>
              {fmtMoney(netCashFlow, { sign: true })}
            </div>
          </div>
        </div>

        <p className="mt-5 max-w-3xl text-sm text-muted-foreground sm:text-[15px]">{summary}</p>
      </div>
    </section>
  );
}

/* ──────────────── tier 1: navigation hero cards ──────────────── */

function NavCard({
  to,
  accent,
  icon: Icon,
  label,
  value,
  hint,
  status,
  valueClass,
}: {
  to: "/money" | "/profit" | "/capital";
  accent: Accent;
  icon: typeof Wallet;
  label: string;
  value: string;
  hint: string;
  status?: StatusLevel;
  valueClass?: string;
}) {
  const a = ACCENT[accent];
  const dot =
    status === "good" ? "bg-good"
    : status === "warn" ? "bg-warn"
    : status === "bad" ? "bg-bad"
    : "bg-muted-foreground/40";

  return (
    <Link
      to={to}
      className="group relative block overflow-hidden rounded-2xl border border-border/70 bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-md sm:p-5"
    >
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${a.bar} to-transparent`} />
      <div className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${a.soft} to-transparent blur-2xl`} />
      <div className="relative flex items-center justify-between">
        <div className={`grid h-9 w-9 place-items-center rounded-xl ring-1 ${a.bg} ${a.ring} ${a.text}`}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="flex items-center gap-2">
          {status && <span className={`h-2 w-2 rounded-full ${dot}`} />}
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
      <div className="mt-5 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1.5 font-display text-[26px] font-bold leading-none tabular sm:text-3xl ${valueClass ?? ""}`}>
        {value}
      </div>
      <div className="mt-2 truncate text-xs text-muted-foreground" title={hint}>
        {hint}
      </div>
    </Link>
  );
}

/* ──────────────── tier 2: control row ──────────────── */

function Control({
  label,
  value,
  hint,
  status,
}: {
  label: string;
  value: string;
  hint?: string;
  status?: StatusLevel;
}) {
  const dot =
    status === "good" ? "bg-good"
    : status === "warn" ? "bg-warn"
    : status === "bad" ? "bg-bad"
    : "bg-muted-foreground/40";
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        {status && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
      </div>
      <div className="mt-1.5 font-display text-lg font-semibold leading-none tabular">{value}</div>
      {hint && <div className="mt-1 truncate text-[11px] text-muted-foreground" title={hint}>{hint}</div>}
    </div>
  );
}

/* ──────────────── page ──────────────── */

function DashboardPage() {
  const { data, isLoading } = useDashboard();
  const { setCustomRange } = usePeriod();
  if (isLoading) return <div className="text-muted-foreground">Загружаем данные…</div>;
  if (data?.status === "error" || !data?.data) {
    return (
      <div className="rounded-md border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">
        Ошибка API «dashboard»: {data?.error ?? "нет данных"}
      </div>
    );
  }
  const { kpis, charts, meta } = data.data;

  const hasCL = kpis.currentLiabilities > 0;
  const hasCA = kpis.currentAssets > 0;
  const liqStatus: StatusLevel | undefined = hasCL
    ? kpis.liquidity >= 1.5 ? "good" : kpis.liquidity >= 1 ? "warn" : "bad"
    : hasCA ? "good" : undefined;
  const liqValue = hasCL && kpis.liquidity > 0 ? fmtRatio(kpis.liquidity) : "—";
  const liqHint = hasCL
    ? "оборотные / краткоср. обязат."
    : hasCA
      ? "краткосрочных обязательств нет"
      : "нет данных";

  const cashStatus: StatusLevel = kpis.netCashFlow >= 0 ? "good" : "bad";
  const profitStatus: StatusLevel = kpis.netProfit > 0 ? "good" : "bad";

  const arStatus: StatusLevel | undefined = kpis.arDays > 0
    ? kpis.arDays <= 45 ? "good" : kpis.arDays <= 90 ? "warn" : "bad"
    : undefined;
  const apStatus: StatusLevel | undefined = kpis.apDays > 0
    ? kpis.apDays <= 60 ? "good" : "warn"
    : undefined;

  const isEmpty =
    kpis.totalIncome === 0 &&
    kpis.totalExpense === 0 &&
    kpis.netCashFlow === 0 &&
    kpis.netProfit === 0 &&
    charts.ncfByMonth.length === 0;

  const derived = deriveStatus({
    netProfit: kpis.netProfit,
    netCashFlow: kpis.netCashFlow,
    liquidity: kpis.liquidity,
    hasCL,
    equity: kpis.equity,
    isEmpty,
  });

  const goH1_2023 = () => setCustomRange("2023-01-01", "2023-06-30");
  const goQ1_2023 = () => setCustomRange("2023-01-01", "2023-03-31");

  return (
    <div className="space-y-6 sm:space-y-7">
      {/* HERO */}
      <Hero
        status={derived.level}
        statusText={derived.text}
        summary={derived.summary}
        netProfit={kpis.netProfit}
        netCashFlow={kpis.netCashFlow}
        periodStart={meta.periodStart}
        periodEnd={meta.periodEnd}
        snapshotDate={meta.snapshotDate}
      />

      {isEmpty && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              За выбранный период операций нет. Есть данные за 2023 — можно открыть период с данными.
            </span>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={goH1_2023}
              className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Показать 6 мес. 2023
            </button>
            <button
              type="button"
              onClick={goQ1_2023}
              className="h-8 rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              Q1 2023
            </button>
          </div>
        </div>
      )}


      {meta.warning && (() => {
        // Спокойный info-стиль, если предупреждение про срез капитала и расхождение ≤ 30 дней.
        const snapDiff = Math.abs(daysBetweenIso(meta.periodEnd, meta.snapshotDate));
        const calm = snapDiff <= 30;
        return calm ? (
          <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Капитал показан по срезу {formatDateRuShort(meta.snapshotDate)} — это ближайшая доступная дата баланса не позже конца периода.
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{meta.warning}</span>
          </div>
        );
      })()}

      {/* TIER 1 — главные карточки-навигация */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <NavCard
          to="/money"
          accent="money"
          icon={Wallet}
          label="Деньги · ЧДП"
          value={fmtMoney(kpis.netCashFlow, { sign: true })}
          hint={kpis.cashBuffer > 0
            ? `Запас денег ${fmtDays(kpis.cashBuffer)} (≈ ${fmtMonths(daysToMonths(kpis.cashBuffer))})`
            : "Запас денег: нет данных"}
          status={cashStatus}
          valueClass={kpis.netCashFlow >= 0 ? "text-good" : "text-bad"}
        />
        <NavCard
          to="/profit"
          accent="profit"
          icon={TrendingUp}
          label="Чистая прибыль"
          value={fmtMoney(kpis.netProfit)}
          hint={`Рентабельность ЧП ${fmtPct(kpis.netProfitMargin)} · Маржинальность ${fmtPct(kpis.marginPct)}`}
          status={profitStatus}
          valueClass={kpis.netProfit >= 0 ? "text-good" : "text-bad"}
        />
        <NavCard
          to="/capital"
          accent="capital"
          icon={Landmark}
          label="Капитал"
          value={fmtMoney(kpis.equity)}
          hint={`ROE ${fmtPct(kpis.roe)} · Фин. независимость ${fmtPct(kpis.finIndependence, 0)}`}
          status="good"
        />
        <NavCard
          to="/capital"
          accent="capital"
          icon={Scale}
          label="Текущая ликвидность"
          value={liqValue}
          hint={liqHint}
          status={liqStatus}
        />
      </div>

      {/* TIER 2 — контрольная панель */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Control
          label="ДЗ, дней"
          value={kpis.arDays > 0 ? fmtDays(kpis.arDays) : "—"}
          hint={kpis.arDays > 0 ? `оборачиваемость ${fmtRatio(kpis.arTurns, 1)}` : "нет данных"}
          status={arStatus}
        />
        <Control
          label="КЗ, дней"
          value={kpis.apDays > 0 ? fmtDays(kpis.apDays) : "—"}
          hint={kpis.apDays > 0 ? `оборачиваемость ${fmtRatio(kpis.apTurns, 1)}` : "нет данных"}
          status={apStatus}
        />
        <Control
          label="Поступления"
          value={fmtMoney(kpis.totalIncome)}
          hint="за период"
        />
        <Control
          label="Платежи"
          value={fmtMoney(kpis.totalExpense)}
          hint="за период"
        />
        <Control
          label="Фин. независимость"
          value={fmtPct(kpis.finIndependence, 0)}
          hint="доля собств. капитала"
          status={kpis.finIndependence >= 50 ? "good" : "warn"}
        />
      </div>

      {/* CHARTS */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="ЧДП по месяцам">Деньги · тренд</SectionTitle>
          {charts.ncfByMonth.length === 0 ? (
            <EmptyMini />
          ) : (
            <div className="h-52 sm:h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.ncfByMonth} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid {...chartGrid} vertical={false} />
                  <XAxis dataKey="month" {...axisProps} />
                  <YAxis {...axisProps} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}М`} />
                  <Tooltip cursor={chartTooltipCursor} content={<ChartTooltipContent kind="money" defaultName="ЧДП" />} />
                  <Bar dataKey="value" radius={[6, 6, 2, 2]}>
                    {charts.ncfByMonth.map((d, i) => (
                      <Cell key={i} fill={d.value >= 0 ? "var(--color-income)" : "var(--color-expense)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle hint="выручка и MR%">Прибыль · тренд</SectionTitle>
          {charts.revenueMR.length === 0 ? (
            <EmptyMini />
          ) : (
            <div className="h-52 sm:h-60">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={charts.revenueMR} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid {...chartGrid} vertical={false} />
                  <XAxis dataKey="month" {...axisProps} />
                  <YAxis yAxisId="l" {...axisProps} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}М`} />
                  <YAxis yAxisId="r" orientation="right" {...axisProps} tickFormatter={(v) => `${v}%`} />
                  <Tooltip cursor={chartTooltipCursor} content={<ChartTooltipContent kind="money" kindByKey={{ mr: "pct" }} />} />
                  <Bar yAxisId="l" dataKey="revenue" name="Выручка, ₽" fill="var(--color-primary)" fillOpacity={0.85} radius={[4, 4, 0, 0]} />
                  <Line yAxisId="r" type="monotone" dataKey="mr" name="MR, %" stroke="var(--color-warn)" strokeWidth={2.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle hint="дебиторская и кредиторская">Капитал · ДЗ vs КЗ</SectionTitle>
        {(() => {
          const ar = charts.arDynamics;
          const ap = charts.apDynamics;
          const n = Math.max(ar.length, ap.length);
          if (n === 0) return <EmptyMini />;
          if (n <= 2) {
            return (
              <div className="grid gap-3 sm:grid-cols-2">
                <SparkPoints points={ar} format={(v) => fmtMoney(v)} label="Дебиторка" />
                <SparkPoints points={ap} format={(v) => fmtMoney(v)} label="Кредиторка" />
              </div>
            );
          }
          return (
            <>
              <div className="h-52 sm:h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={ar.map((r, i) => ({ month: r.month, ar: r.value, ap: ap[i]?.value ?? 0 }))}
                    margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid {...chartGrid} vertical={false} />
                    <XAxis dataKey="month" {...axisProps} />
                    <YAxis {...axisProps} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}М`} />
                    <Tooltip cursor={chartTooltipCursorLine} content={<ChartTooltipContent kind="money" />} />
                    <Line type="monotone" dataKey="ar" name="Дебиторка" stroke="var(--cat-ar)" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="ap" name="Кредиторка" stroke="var(--cat-ap)" strokeWidth={2.5} strokeDasharray="5 4" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ background: "var(--cat-ar)" }} />Дебиторка — нам должны</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 border-t border-dashed" style={{ borderColor: "var(--cat-ap)" }} />Кредиторка — мы должны</span>
              </div>
            </>
          );
        })()}
      </Card>

      <Card>
        <SectionTitle hint={charts.finIndependence.length < 3 ? "данные по доступным срезам" : "% собственного капитала в пассивах"}>
          Финансовая независимость
        </SectionTitle>
        {charts.finIndependence.length === 0 ? (
          <EmptyMini />
        ) : charts.finIndependence.length <= 2 ? (
          <SparkPoints points={charts.finIndependence} format={(v) => `${v.toFixed(0)}%`} label="Срезы" />
        ) : (
          <div className="h-44 sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={charts.finIndependence} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid {...chartGrid} vertical={false} />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis {...axisProps} domain={["auto", "auto"]} tickFormatter={(v) => `${v}%`} />
                <Tooltip cursor={chartTooltipCursorLine} content={<ChartTooltipContent kind="pct" defaultName="Фин. независимость" />} />
                <Line type="monotone" dataKey="value" stroke="var(--cat-equity)" strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Landmark, AlertTriangle, Info } from "lucide-react";
import { Card, Kpi, SectionTitle } from "@/components/finance/primitives";
import { SectionHeader } from "@/components/finance/SectionHeader";
import { SnapshotPicker } from "@/components/finance/SnapshotPicker";
import { BalanceSheetTable } from "@/components/finance/BalanceSheetTable";
import { SparkPoints } from "@/components/finance/SparkPoints";
import { colorForAsset, colorForLiability, categoryVar } from "@/lib/finance-colors";
import { useCapital } from "@/hooks/use-finance";
import { fmtDays, fmtMoney, fmtPct, fmtRatio, formatDateRu, formatDateRuShort, formatPeriodRange, daysBetweenIso } from "@/lib/format";
import { ChartTooltipContent, chartTooltipCursor, chartTooltipCursorLine } from "@/components/finance/ChartTooltip";

export const Route = createFileRoute("/capital")({
  head: () => ({
    meta: [
      { title: "Капитал — CFO" },
      { name: "description", content: "Срез капитала: активы, пассивы, ликвидность, фин. независимость, ДЗ/КЗ, баланс." },
    ],
  }),
  component: CapitalPage,
});

const grid = { stroke: "var(--color-border)", strokeDasharray: "3 3", strokeOpacity: 0.5 } as const;
const axis = { stroke: "var(--color-muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const;

function CapitalPage() {
  const { data, isLoading } = useCapital();
  if (isLoading) return <div className="text-muted-foreground">Загружаем данные…</div>;
  if (data?.status === "error" || !data?.data) {
    return (
      <div className="rounded-md border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">
        Ошибка API «capital»: {data?.error ?? "нет данных"}
      </div>
    );
  }
  const { kpis, charts, tables, meta } = data.data;
  const snapshots = (meta.allSnapshotDates ?? [meta.snapshotDate.slice(0, 10)]);

  // Расхождение «конец периода ↔ срез капитала»
  const snapDiff = daysBetweenIso(meta.periodEnd, meta.snapshotDate); // <0 — срез раньше конца периода
  const snapMismatch = snapDiff !== 0;
  const snapStaleHard = Math.abs(snapDiff) > 30; // считаем тревожным только большие расхождения

  return (
    <div className="space-y-5 sm:space-y-6">
      <SectionHeader
        accent="capital"
        icon={Landmark}
        title="Капитал"
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-foreground/90">Баланс на {formatDateRuShort(meta.snapshotDate)}</span>
            <span className="opacity-50">·</span>
            <span>Период: {formatPeriodRange(meta.periodStart, meta.periodEnd)}</span>
          </span>
        }
        right={<SnapshotPicker snapshots={snapshots} current={meta.snapshotDate} />}
      />

      {snapMismatch && !snapStaleHard && (
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Используется ближайший доступный срез капитала из Google Sheets ({formatDateRuShort(meta.snapshotDate)}).
            Капитал — это баланс на дату, поэтому показывается ближайшая доступная дата не позже конца периода.
          </span>
        </div>
      )}

      {(snapStaleHard || (meta.warning && !snapMismatch)) && (
        <div className="flex items-start gap-2 rounded-md border border-warn/30 bg-warn/10 px-3 py-1.5 text-xs text-warn">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {snapStaleHard
              ? `Срез капитала (${formatDateRuShort(meta.snapshotDate)}) сильно отличается от конца периода (${formatDateRuShort(meta.periodEnd)}). Возможно, баланс устарел.`
              : meta.warning}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi label="Собственный капитал" value={fmtMoney(kpis.equity)} status="good" emphasis="lg" />
        <Kpi
          label="Текущая ликвидность"
          value={kpis.currentLiabilities > 0 && kpis.liquidity > 0 ? fmtRatio(kpis.liquidity) : "—"}
          hint={
            kpis.currentLiabilities > 0
              ? "оборотные / краткоср. обязательства"
              : kpis.currentAssets > 0
                ? "краткосрочных обязательств нет"
                : "нет данных для расчёта"
          }
          status={
            kpis.currentLiabilities > 0
              ? (kpis.liquidity >= 1.5 ? "good" : kpis.liquidity >= 1 ? "warn" : "bad")
              : kpis.currentAssets > 0
                ? "good"
                : undefined
          }
        />
        <Kpi label="Фин. независимость" value={fmtPct(kpis.finIndependence, 0)} status={kpis.finIndependence >= 50 ? "good" : "warn"} hint="доля собств. капитала" />
        <Kpi label="Всего активов" value={fmtMoney(kpis.totalAssets)} hint="₽" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi label="Оборотные активы" value={fmtMoney(kpis.currentAssets)} />
        <Kpi label="Краткосрочные обязательства" value={fmtMoney(kpis.currentLiabilities)} status="warn" />
        <Kpi label="ДЗ" value={fmtMoney(kpis.arValue)} hint={kpis.arDays > 0 ? `оборачиваемость ДЗ ${fmtDays(kpis.arDays)}` : "нет данных"} />
        <Kpi label="КЗ" value={fmtMoney(kpis.apValue)} hint={kpis.apDays > 0 ? `оборачиваемость КЗ ${fmtDays(kpis.apDays)}` : "нет данных"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="состав">Структура активов</SectionTitle>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={charts.assetsStructure} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {charts.assetsStructure.map((a, i) => (
                    <Cell key={i} fill={colorForAsset(a.name, i)} stroke="var(--color-card)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip cursor={chartTooltipCursor} content={<ChartTooltipContent kind="money" />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1.5">
            {charts.assetsStructure.map((a, i) => (
              <li key={a.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorForAsset(a.name, i) }} />
                  <span className="truncate text-muted-foreground">{a.name}</span>
                </span>
                <span className="tabular font-medium">{fmtMoney(a.value)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionTitle hint="состав">Структура пассивов</SectionTitle>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.liabilitiesStructure} layout="vertical">
                <CartesianGrid {...grid} horizontal={false} />
                <XAxis type="number" {...axis} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}М`} />
                <YAxis dataKey="name" type="category" width={130} {...axis} />
                <Tooltip cursor={chartTooltipCursor} content={<ChartTooltipContent kind="money" />} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {charts.liabilitiesStructure.map((d, i) => (
                    <Cell key={i} fill={colorForLiability(d.name, i)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionTitle hint="по месяцам">Дебиторская задолженность</SectionTitle>
          {charts.arDynamic.length === 0 ? (
            <div className="grid h-24 place-items-center text-xs text-muted-foreground">Нет данных за выбранный период</div>
          ) : charts.arDynamic.length <= 2 ? (
            <SparkPoints points={charts.arDynamic} format={(v) => fmtMoney(v)} />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.arDynamic}>
                  <CartesianGrid {...grid} />
                  <XAxis dataKey="month" {...axis} />
                  <YAxis {...axis} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}М`} />
                  <Tooltip cursor={chartTooltipCursor} content={<ChartTooltipContent kind="money" />} />
                  <Area type="monotone" dataKey="value" stroke={categoryVar("ar")} fill={categoryVar("ar")} fillOpacity={0.25} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle hint="по месяцам">Кредиторская задолженность</SectionTitle>
          {charts.apDynamic.length === 0 ? (
            <div className="grid h-24 place-items-center text-xs text-muted-foreground">Нет данных за выбранный период</div>
          ) : charts.apDynamic.length <= 2 ? (
            <SparkPoints points={charts.apDynamic} format={(v) => fmtMoney(v)} />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.apDynamic}>
                  <CartesianGrid {...grid} />
                  <XAxis dataKey="month" {...axis} />
                  <YAxis {...axis} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}М`} />
                  <Tooltip cursor={chartTooltipCursor} content={<ChartTooltipContent kind="money" />} />
                  <Area type="monotone" dataKey="value" stroke={categoryVar("ap")} fill={categoryVar("ap")} fillOpacity={0.25} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle hint={charts.capitalDynamic.length < 3 ? "данные по доступным срезам" : "по срезам"}>
          Структура капитала: собственный vs обязательства
        </SectionTitle>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={charts.capitalDynamic.map((d) => ({ ...d, date: formatDateRu(d.date) }))}>
              <CartesianGrid {...grid} />
              <XAxis dataKey="date" {...axis} />
              <YAxis {...axis} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}М`} />
              <Tooltip cursor={chartTooltipCursor} content={<ChartTooltipContent kind="money" />} />
              <Bar dataKey="liabilities" name="Обязательства" stackId="c" fill={categoryVar("shortLiab")} />
              <Bar dataKey="equity" name="Собств. капитал" stackId="c" fill={categoryVar("equity")} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: categoryVar("shortLiab") }} />Обязательства</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: categoryVar("equity") }} />Собств. капитал</span>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle hint={charts.liquidityDynamic.length < 3 ? "данные по доступным срезам" : "по срезам"}>
            Динамика ликвидности
          </SectionTitle>
          {charts.liquidityDynamic.length === 0 ? (
            <div className="grid h-24 place-items-center text-xs text-muted-foreground">Нет данных за выбранный период</div>
          ) : charts.liquidityDynamic.length <= 2 ? (
            <SparkPoints
              points={charts.liquidityDynamic.map((d) => ({ month: d.date, value: d.value }))}
              format={(v) => fmtRatio(v)}
              label="Коэффициент"
            />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.liquidityDynamic.map((d) => ({ ...d, date: formatDateRu(d.date) }))}>
                  <CartesianGrid {...grid} />
                  <XAxis dataKey="date" {...axis} />
                  <YAxis {...axis} domain={[0, "auto"]} tickFormatter={(v) => v.toFixed(1)} />
                  <Tooltip cursor={chartTooltipCursorLine} content={<ChartTooltipContent kind="ratio" defaultName="Коэффициент" />} />
                  <Line type="monotone" dataKey="value" name="Коэффициент" stroke="var(--color-chart-4)" strokeWidth={2.5} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card>
          <SectionTitle hint={charts.finIndependenceDynamic.length < 3 ? "данные по доступным срезам" : "по срезам"}>
            Фин. независимость, %
          </SectionTitle>
          {charts.finIndependenceDynamic.length === 0 ? (
            <div className="grid h-24 place-items-center text-xs text-muted-foreground">Нет данных за выбранный период</div>
          ) : charts.finIndependenceDynamic.length <= 2 ? (
            <SparkPoints
              points={charts.finIndependenceDynamic.map((d) => ({ month: d.date, value: d.value }))}
              format={(v) => `${v.toFixed(0)}%`}
              label="Доля собств. капитала"
            />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.finIndependenceDynamic.map((d) => ({ ...d, date: formatDateRu(d.date) }))}>
                  <CartesianGrid {...grid} />
                  <XAxis dataKey="date" {...axis} />
                  <YAxis {...axis} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip cursor={chartTooltipCursorLine} content={<ChartTooltipContent kind="pct" defaultName="Фин. независимость" />} />
                  <Line type="monotone" dataKey="value" name="Доля" stroke="var(--color-chart-2)" strokeWidth={2.5} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card padded={false}>
        <div className="px-4 pt-4 sm:px-5 sm:pt-5">
          <SectionTitle hint="Актив = Пассив">Баланс</SectionTitle>
        </div>
        <div className="p-4 pt-0 sm:p-5 sm:pt-0">
          <BalanceSheetTable rows={tables.balance} />
        </div>
      </Card>
    </div>
  );
}

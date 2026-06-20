import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
import { Wallet } from "lucide-react";
import { Card, Kpi, SectionTitle } from "@/components/finance/primitives";
import { SectionHeader } from "@/components/finance/SectionHeader";
import { SmallItemsRow, splitSmall } from "@/components/finance/SmallItemsGroup";
import { OddsTree } from "@/components/finance/OddsTree";
import { SignificanceFilter, SignificanceFilterBar } from "@/components/finance/SignificanceFilter";
import { ActiveFilters } from "@/components/finance/ActiveFilters";
import { useMoney } from "@/hooks/use-finance";
import { daysToMonths, fmtDays, fmtMoney, fmtMonths, fmtPct } from "@/lib/format";
import { buildWeightMap } from "@/lib/significance";
import { ChartTooltipContent, chartTooltipCursor } from "@/components/finance/ChartTooltip";

export const Route = createFileRoute("/money")({
  head: () => ({
    meta: [
      { title: "Деньги — CFO" },
      { name: "description", content: "ДДС: ЧДП, Cash buffer, ОДДС-дерево, расходы по статьям, контрагенты." },
    ],
  }),
  component: MoneyPage,
});

const grid = { stroke: "var(--color-border)", strokeDasharray: "3 3", strokeOpacity: 0.5 } as const;
const axis = { stroke: "var(--color-muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const;

function MoneyPage() {
  const [account, setAccount] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [article, setArticle] = useState("");
  const [direction, setDirection] = useState("");

  const { data, isLoading } = useMoney({ account, counterparty, article, direction });

  const resetAll = () => {
    setAccount("");
    setCounterparty("");
    setArticle("");
    setDirection("");
  };

  const filteredCp = useMemo(() => {
    if (!data?.data) return [];
    return data.data.charts.counterparties;
  }, [data]);

  if (isLoading) return <div className="text-muted-foreground">Загружаем данные…</div>;
  if (data?.status === "error" || !data?.data) {
    return (
      <div className="rounded-md border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">
        Ошибка API «money»: {data?.error ?? "нет данных"}
      </div>
    );
  }
  const { kpis, charts, tables, meta } = data.data;
  const hasNoOps =
    kpis.totalIncome === 0 &&
    kpis.totalExpense === 0 &&
    kpis.netCashFlow === 0 &&
    charts.byMonth.every((m) => m.income === 0 && m.expense === 0);
  const maxArticle = Math.max(1, ...charts.expensesByArticle.map((a) => a.value));

  return (
    <div className="space-y-5 sm:space-y-6">
      <SectionHeader
        accent="money"
        icon={Wallet}
        title="Деньги"
        subtitle="ДДС: поступления, платежи, чистый денежный поток, ОДДС"
      />

      {hasNoOps && (
        <div className="rounded-md border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          За выбранный период операций нет. Выберите период с данными, например Q1 2023 или 6 мес. 2023.
        </div>
      )}


      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi
          label="ЧДП за период"
          value={fmtMoney(kpis.netCashFlow, { sign: true })}
          status={kpis.netCashFlow >= 0 ? "good" : "bad"}
          emphasis="lg"
        />
        <Kpi
          label="Запас денег"
          value={kpis.cashBuffer > 0 ? fmtDays(kpis.cashBuffer) : "—"}
          status={kpis.cashBuffer > 0 ? (kpis.cashBuffer >= 90 ? "good" : "warn") : undefined}
          hint={kpis.cashBuffer > 0 ? `≈ ${fmtMonths(daysToMonths(kpis.cashBuffer))} запаса` : "нет данных за период"}
        />
        <Kpi label="Поступления" value={fmtMoney(kpis.totalIncome)} status="good" />
        <Kpi label="Платежи" value={fmtMoney(kpis.totalExpense)} status="warn" />
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Kpi label="Стартовый остаток" value={fmtMoney(kpis.openingBalance)} />
        <Kpi label="Конечный остаток" value={fmtMoney(kpis.closingBalance)} />
        <Kpi label="Средний месячный расход" value={fmtMoney(kpis.avgMonthlyExpense)} hint="за период" />
      </div>

      {/* Filters */}
      <Card>
        <SectionTitle hint="отсортированы по значимости в выбранном периоде">Фильтры</SectionTitle>
        <SignificanceFilterBar>
          <SignificanceFilter
            label="Счёт"
            value={account}
            options={meta.accounts ?? []}
            onChange={setAccount}
            showAmounts={false}
          />
          <SignificanceFilter
            label="Контрагент"
            value={counterparty}
            options={meta.counterparties ?? []}
            weights={buildWeightMap(charts.counterparties, (c) => c.name, (c) => c.value)}
            onChange={setCounterparty}
          />
          <SignificanceFilter
            label="Статья"
            value={article}
            options={meta.articles ?? []}
            weights={buildWeightMap(charts.expensesByArticle, (a) => a.article, (a) => a.value)}
            onChange={setArticle}
          />
          <SignificanceFilter
            label="Направление"
            value={direction}
            options={meta.directions ?? []}
            weights={buildWeightMap(charts.byDirection, (d) => d.direction, (d) => d.value)}
            onChange={setDirection}
          />
        </SignificanceFilterBar>
        <ActiveFilters
          chips={[
            { label: "Счёт", value: account, onClear: () => setAccount("") },
            { label: "Контрагент", value: counterparty, onClear: () => setCounterparty("") },
            { label: "Статья", value: article, onClear: () => setArticle("") },
            { label: "Направление", value: direction, onClear: () => setDirection("") },
          ]}
          onResetAll={resetAll}
        />
      </Card>

      {/* Monthly chart */}
      <Card>
        <SectionTitle hint="приход, расход, ЧДП, остаток, средний расход">Денежный поток по месяцам</SectionTitle>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={charts.byMonth}>
              <CartesianGrid {...grid} />
              <XAxis dataKey="month" {...axis} />
              <YAxis yAxisId="l" {...axis} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}М`} />
              <YAxis yAxisId="r" orientation="right" {...axis} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}М`} />
              <Tooltip cursor={chartTooltipCursor} content={<ChartTooltipContent kind="money" />} />
              <Bar yAxisId="l" dataKey="income" name="Приход" fill="var(--color-income)" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="l" dataKey="expense" name="Расход" fill="var(--color-expense)" radius={[4, 4, 0, 0]} />
              <Line yAxisId="l" type="monotone" dataKey="net" name="ЧДП" stroke="var(--color-primary)" strokeWidth={2.5} dot={false} />
              <Line yAxisId="r" type="monotone" dataKey="balance" name="Остаток" stroke="var(--color-chart-4)" strokeWidth={2} strokeDasharray="4 3" dot={false} />
              <Line yAxisId="l" type="monotone" dataKey="avgExpense" name="Средний расход" stroke="var(--color-warn)" strokeWidth={1.5} strokeDasharray="2 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-income" />Приход</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-expense" />Расход</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-primary" />ЧДП</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 border-t border-dashed border-chart-4" />Остаток</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 border-t border-dotted border-warn" />Средний расход</span>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="доля в общих расходах">Расходы по статьям</SectionTitle>
          {(() => {
            const items = charts.expensesByArticle.map((a) => ({
              key: a.article,
              label: a.article,
              value: a.value,
              share: a.share,
            }));
            const { big, small } = splitSmall(items);
            return (
              <ul className="space-y-3">
                {big.map((a) => (
                  <li key={a.key}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-muted-foreground">{a.label}</span>
                      <span className="tabular">
                        <span className="font-semibold">{fmtMoney(a.value)}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{fmtPct(a.share ?? 0, 0)}</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-expense" style={{ width: `${(a.value / maxArticle) * 100}%` }} />
                    </div>
                  </li>
                ))}
                <SmallItemsRow items={small} tone="expense" />
              </ul>
            );
          })()}
        </Card>

        <Card>
          <SectionTitle hint={direction ? "сводка по выбранному направлению" : "ЧДП по направлениям"}>
            {direction ? `Направление: ${direction}` : "Направления"}
          </SectionTitle>
          {direction ? (
            <DirectionSummary
              direction={direction}
              income={kpis.totalIncome}
              expense={kpis.totalExpense}
              net={kpis.netCashFlow}
              shareOfAll={(() => {
                const all = charts.byDirection.reduce((s, d) => s + d.value, 0);
                return all !== 0 ? (kpis.netCashFlow / all) * 100 : 0;
              })()}
            />
          ) : (
            (() => {
              const totalAbs = charts.byDirection.reduce((s, d) => s + Math.abs(d.value), 0) || 1;
              const items = charts.byDirection.map((d) => ({
                key: d.direction,
                label: d.direction,
                value: d.value,
                share: (Math.abs(d.value) / totalAbs) * 100,
              }));
              const { big, small } = splitSmall(items);
              const otherValue = small.reduce((s, d) => s + d.value, 0);
              const chartRows = [
                ...big.map((b) => ({ direction: b.label, value: b.value })),
                ...(small.length > 0
                  ? [{ direction: `Прочее · ${small.length}`, value: otherValue }]
                  : []),
              ].sort((a, b) => b.value - a.value);
              return (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartRows}
                      layout="vertical"
                      margin={{ top: 4, right: 56, left: 4, bottom: 4 }}
                      barCategoryGap={10}
                    >
                      <CartesianGrid {...grid} horizontal={false} />
                      <XAxis type="number" {...axis} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}М`} />
                      <YAxis dataKey="direction" type="category" width={100} {...axis} />
                      <Tooltip
                        cursor={chartTooltipCursor}
                        content={<ChartTooltipContent kind="money" defaultName="ЧДП" />}
                      />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18}>
                        {chartRows.map((d, i) => (
                          <Cell
                            key={i}
                            fill={d.value >= 0 ? "var(--color-income)" : "var(--color-expense)"}
                            fillOpacity={d.direction.startsWith("Прочее") ? 0.5 : 1}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              );
            })()
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle hint="приходы и платежи">Контрагенты</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["Приход", "Расход"] as const).map((kind) => {
            const rows = filteredCp.filter((c) => c.kind === kind);
            const totalKind = rows.reduce((s, r) => s + r.value, 0) || 1;
            const items = rows.map((r) => ({
              key: r.name,
              label: r.name,
              value: r.value,
              share: (r.value / totalKind) * 100,
            }));
            const { big, small } = splitSmall(items);
            const max = Math.max(1, ...big.map((r) => r.value));
            return (
              <div key={kind}>
                <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">{kind}</div>
                <ul className="space-y-2">
                  {big.map((r) => (
                    <li key={r.key}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">{r.label}</span>
                        <span className={`tabular font-medium ${kind === "Приход" ? "text-good" : "text-bad"}`}>
                          {fmtMoney(r.value)}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${kind === "Приход" ? "bg-income" : "bg-expense"}`}
                          style={{ width: `${(r.value / max) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                  <SmallItemsRow
                    items={small}
                    tone={kind === "Приход" ? "income" : "expense"}
                    label={kind === "Приход" ? "Мелкие покупатели" : "Мелкие поставщики"}
                  />
                </ul>
              </div>
            );
          })}
        </div>
      </Card>

      <Card padded={false}>
        <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
          <SectionTitle hint="Раздел → статья → месяцы">Отчёт ОДДС</SectionTitle>
        </div>
        <OddsTree rows={tables.oddsTree} />
      </Card>
    </div>
  );
}

function DirectionSummary({
  direction,
  income,
  expense,
  net,
  shareOfAll,
}: {
  direction: string;
  income: number;
  expense: number;
  net: number;
  shareOfAll: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <SummaryCell label="Поступления" value={fmtMoney(income)} tone="good" />
      <SummaryCell label="Платежи" value={fmtMoney(expense)} tone="bad" />
      <SummaryCell
        label="ЧДП"
        value={fmtMoney(net, { sign: true })}
        tone={net >= 0 ? "good" : "bad"}
      />
      <SummaryCell label="Доля в общем ЧДП" value={fmtPct(shareOfAll, 0)} hint={direction} />
    </div>
  );
}

function SummaryCell({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
  hint?: string;
}) {
  const color = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : "text-foreground";
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-lg font-semibold tabular ${color}`}>{value}</div>
      {hint && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

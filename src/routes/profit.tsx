import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
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
import { TrendingUp } from "lucide-react";
import { Card, Kpi, SectionTitle } from "@/components/finance/primitives";
import { SectionHeader } from "@/components/finance/SectionHeader";
import { SignificanceFilter, SignificanceFilterBar } from "@/components/finance/SignificanceFilter";
import { ActiveFilters } from "@/components/finance/ActiveFilters";
import { ProjectMatrix } from "@/components/finance/ProjectMatrix";
import { useProfit } from "@/hooks/use-finance";
import { fmtMoney, fmtPct } from "@/lib/format";
import { buildWeightMap } from "@/lib/significance";
import { ChartTooltipContent, chartTooltipCursor } from "@/components/finance/ChartTooltip";

export const Route = createFileRoute("/profit")({
  head: () => ({
    meta: [
      { title: "Прибыль — CFO" },
      { name: "description", content: "ОПиУ: выручка, валовая, MR%, fixed costs, чистая прибыль, NP margin, проекты." },
    ],
  }),
  component: ProfitPage,
});

const grid = { stroke: "var(--color-border)", strokeDasharray: "3 3", strokeOpacity: 0.5 } as const;
const axis = { stroke: "var(--color-muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const;

function ProfitPage() {
  const [project, setProject] = useState("");
  const [direction, setDirection] = useState("");
  const [article, setArticle] = useState("");
  const [section, setSection] = useState("");

  const { data, isLoading } = useProfit({ project, direction, article, section });

  const resetAll = () => {
    setProject("");
    setDirection("");
    setArticle("");
    setSection("");
  };

  if (isLoading) return <div className="text-muted-foreground">Загружаем данные…</div>;
  if (data?.status === "error" || !data?.data) {
    return (
      <div className="rounded-md border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">
        Ошибка API «profit»: {data?.error ?? "нет данных"}
      </div>
    );
  }
  const { kpis, charts, tables, meta } = data.data;

  return (
    <div className="space-y-5 sm:space-y-6">
      <SectionHeader
        accent="profit"
        icon={TrendingUp}
        title="Прибыль"
        subtitle="ОПиУ: выручка, валовая, чистая прибыль, рентабельность, проекты"
      />

      {/* Primary — крупные карточки ОПиУ */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <Kpi label="Чистая прибыль" value={fmtMoney(kpis.netProfit)} status={kpis.netProfit > 0 ? "good" : kpis.netProfit < 0 ? "bad" : undefined} emphasis="lg" hint={`Рентабельность ${fmtPct(kpis.netProfitMargin)}`} />
        <Kpi label="Выручка" value={fmtMoney(kpis.revenue)} emphasis="lg" hint={`Валовая ${fmtMoney(kpis.grossProfit)}`} />
      </div>
      {/* Secondary — компактные показатели */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Kpi label="Валовая прибыль" value={fmtMoney(kpis.grossProfit)} status="good" hint={`себестоимость ${fmtMoney(kpis.cogs)}`} />
        <Kpi label="Маржинальность" value={fmtPct(kpis.marginPct)} status={kpis.marginPct >= 35 ? "good" : kpis.marginPct > 0 ? "warn" : undefined} hint={kpis.marginPct > 0 ? "валовая / выручка" : "нет данных"} />
        <Kpi label="Рентабельность ЧП" value={fmtPct(kpis.netProfitMargin)} status={kpis.netProfitMargin >= 10 ? "good" : kpis.netProfitMargin > 0 ? "warn" : undefined} hint={kpis.netProfitMargin !== 0 ? "ЧП / выручка" : "нет данных"} />
        <Kpi label="Постоянные расходы, %" value={fmtPct(kpis.fixedCostsPct)} hint="доля от выручки" />
      </div>

      <Card>
        <SectionTitle hint="отсортированы по значимости в выбранном периоде">Фильтры</SectionTitle>
        <SignificanceFilterBar>
          <SignificanceFilter
            label="Проект"
            value={project}
            options={meta.projects ?? []}
            weights={buildWeightMap(tables.projectMatrix, (p) => p.project, (p) => p.revenue)}
            onChange={setProject}
          />
          <SignificanceFilter
            label="Направление"
            value={direction}
            options={meta.directions ?? []}
            weights={buildWeightMap(charts.revenueByDirection, (d) => d.direction, (d) => d.value)}
            onChange={setDirection}
          />
          <SignificanceFilter
            label="Статья"
            value={article}
            options={meta.articles ?? []}
            onChange={setArticle}
          />
          {meta.sections && meta.sections.length > 0 && (
            <SignificanceFilter
              label="Раздел ОПиУ"
              value={section}
              options={meta.sections}
              weights={buildWeightMap(tables.sectionSums, (s) => s.section, (s) => s.value)}
              onChange={setSection}
            />
          )}
        </SignificanceFilterBar>
        <ActiveFilters
          chips={[
            { label: "Проект", value: project, onClear: () => setProject("") },
            { label: "Направление", value: direction, onClear: () => setDirection("") },
            { label: "Статья", value: article, onClear: () => setArticle("") },
            ...(meta.sections && meta.sections.length > 0
              ? [{ label: "Раздел", value: section, onClear: () => setSection("") }]
              : []),
          ]}
          onResetAll={resetAll}
        />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="выручка vs MR%">Выручка и маржинальность</SectionTitle>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={charts.revenueMargin}>
                <CartesianGrid {...grid} />
                <XAxis dataKey="month" {...axis} />
                <YAxis yAxisId="l" {...axis} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}М`} />
                <YAxis yAxisId="r" orientation="right" {...axis} tickFormatter={(v) => `${v}%`} />
                <Tooltip cursor={chartTooltipCursor} content={<ChartTooltipContent kind="money" kindByKey={{ margin: "pct" }} nameByKey={{ margin: "MR, %" }} />} />
                <Bar yAxisId="l" dataKey="revenue" name="Выручка" fill="var(--color-chart-1)" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
                <Line yAxisId="r" type="monotone" dataKey="margin" name="MR, %" stroke="var(--color-warn)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionTitle hint="чистая прибыль и NP margin">Чистая прибыль</SectionTitle>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={charts.netProfitMargin}>
                <CartesianGrid {...grid} />
                <XAxis dataKey="month" {...axis} />
                <YAxis yAxisId="l" {...axis} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}М`} />
                <YAxis yAxisId="r" orientation="right" {...axis} tickFormatter={(v) => `${v}%`} />
                <Tooltip cursor={chartTooltipCursor} content={<ChartTooltipContent kind="money" kindByKey={{ margin: "pct" }} nameByKey={{ margin: "NP, %" }} />} />
                <Area yAxisId="l" type="monotone" dataKey="profit" name="Прибыль" stroke="var(--color-good)" fill="var(--color-good)" fillOpacity={0.18} />
                <Line yAxisId="r" type="monotone" dataKey="margin" name="NP, %" stroke="var(--color-chart-2)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="выручка по направлениям">Выручка по направлениям</SectionTitle>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.revenueByDirection}>
                <CartesianGrid {...grid} />
                <XAxis dataKey="direction" {...axis} />
                <YAxis {...axis} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}М`} />
                <Tooltip cursor={chartTooltipCursor} content={<ChartTooltipContent kind="money" defaultName="Выручка" />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="var(--color-chart-1)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <SectionTitle hint="валовая прибыль по направлениям">Валовая по направлениям</SectionTitle>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.grossProfitByDirection}>
                <CartesianGrid {...grid} />
                <XAxis dataKey="direction" {...axis} />
                <YAxis {...axis} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}М`} />
                <Tooltip cursor={chartTooltipCursor} content={<ChartTooltipContent kind="money" defaultName="Валовая прибыль" />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {charts.grossProfitByDirection.map((d, i) => (
                    <Cell key={i} fill={d.value >= 0 ? "var(--color-chart-2)" : "var(--color-bad)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card padded={false}>
        <div className="px-4 pt-4 sm:px-5 sm:pt-5">
          <SectionTitle hint="8 разделов ОПиУ">Структура ОПиУ</SectionTitle>
        </div>
        <ul className="px-2 pb-2 sm:px-3">
          {tables.sectionSums.map((s) => {
            const big = ["Выручка", "Валовая прибыль", "Операционная прибыль", "Чистая прибыль"].includes(s.section);
            const negative = s.value < 0;
            return (
              <li
                key={s.section}
                className={`flex items-center justify-between gap-3 rounded-md px-3 py-2 ${big ? "bg-accent/30 font-semibold" : ""}`}
              >
                <span className={`truncate ${big ? "" : "text-muted-foreground"}`}>{s.section}</span>
                <span className="flex items-baseline gap-3 tabular">
                  <span className={negative ? "text-bad" : big ? "text-good" : "text-foreground"}>
                    {fmtMoney(s.value, { sign: false })}
                  </span>
                  <span className="text-xs text-muted-foreground">{fmtPct(s.pctOfRevenue, 1)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card padded={false}>
        <div className="px-4 pt-4 sm:px-5 sm:pt-5">
          <SectionTitle hint="направление → проекты">Проекты</SectionTitle>
        </div>
        <ProjectMatrix rows={tables.projectMatrix} />
      </Card>
    </div>
  );
}

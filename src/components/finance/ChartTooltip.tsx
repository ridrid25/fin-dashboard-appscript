import * as React from "react";
import type { TooltipProps } from "recharts";
import { fmtMoney, fmtPct, fmtRatio, fmtDays } from "@/lib/format";

export type ValueKind = "money" | "pct" | "ratio" | "days" | "number";

function formatValue(v: unknown, kind: ValueKind): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  switch (kind) {
    case "money": return fmtMoney(n);
    case "pct":   return fmtPct(n);
    case "ratio": return fmtRatio(n);
    case "days":  return fmtDays(n);
    default:      return n.toLocaleString("ru-RU");
  }
}

const KEY_LABELS: Record<string, string> = {
  value: "Значение",
  income: "Поступления",
  expense: "Платежи",
  net: "ЧДП",
  balance: "Остаток",
  avgExpense: "Средний расход",
  revenue: "Выручка",
  profit: "Прибыль",
  margin: "Маржинальность",
  mr: "MR",
  ar: "Дебиторка",
  ap: "Кредиторка",
  equity: "Собств. капитал",
  liabilities: "Обязательства",
};

type Props = TooltipProps<number, string> & {
  kind?: ValueKind;
  kindByKey?: Record<string, ValueKind>;
  nameByKey?: Record<string, string>;
  defaultName?: string;
};

export function ChartTooltipContent({
  active,
  payload,
  label,
  kind = "money",
  kindByKey,
  nameByKey,
  defaultName,
}: Props) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      className="rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-lg"
      style={{ fontSize: 12, minWidth: 140 }}
    >
      {label !== undefined && label !== "" && (
        <div className="mb-1 text-[11px] font-medium text-muted-foreground">{String(label)}</div>
      )}
      <ul className="space-y-1">
        {payload.map((row, i) => {
          const key = String(row.dataKey ?? "");
          const k = (kindByKey && kindByKey[key]) || kind;
          const seriesName =
            (nameByKey && nameByKey[key]) ||
            (typeof row.name === "string" && row.name && row.name !== key ? row.name : undefined) ||
            KEY_LABELS[key] ||
            defaultName ||
            key;
          const color = (row.color || (row.payload && (row.payload as { fill?: string }).fill)) as string | undefined;
          return (
            <li key={i} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ background: color ?? "var(--color-primary)" }}
                />
                <span className="text-foreground/90">{seriesName}</span>
              </span>
              <span className="tabular font-semibold text-foreground">
                {formatValue(row.value, k)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export const chartTooltipCursor = { fill: "var(--color-accent)", opacity: 0.2 } as const;
export const chartTooltipCursorLine = { stroke: "var(--color-border)", strokeWidth: 1 } as const;

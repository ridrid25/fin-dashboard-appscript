import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { fmtMoney, fmtPct } from "@/lib/format";

export type SmallItem = {
  key: string;
  label: string;
  value: number;
  share?: number; // percent 0..100
};

// Centralised CFO-level thresholds for collapsing minor rows.
export const MAX_VISIBLE_ITEMS = 7;
export const MIN_VISIBLE_SHARE = 2; // percent
export const MIN_VISIBLE_AMOUNT = 1_000_000; // ₽

/** Split into [big, small]: keep top-7 OR share>=2% OR amount>=1M; rest collapses. */
export function splitSmall<T extends SmallItem>(items: T[]): { big: T[]; small: T[] } {
  const sorted = [...items].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const topKeys = new Set(sorted.slice(0, MAX_VISIBLE_ITEMS).map((i) => i.key));
  const big: T[] = [];
  const small: T[] = [];
  for (const it of sorted) {
    const share = it.share ?? 0;
    const isBig =
      topKeys.has(it.key) &&
      (share >= MIN_VISIBLE_SHARE || Math.abs(it.value) >= MIN_VISIBLE_AMOUNT);
    (isBig ? big : small).push(it);
  }
  // Guarantee at least 1 visible row if any data exists.
  if (big.length === 0 && sorted.length > 0) {
    big.push(sorted[0]);
    const idx = small.findIndex((s) => s.key === sorted[0].key);
    if (idx >= 0) small.splice(idx, 1);
  }
  return { big, small };
}

/** Renders the collapsed "Мелкие · N" row + expandable list. */
export function SmallItemsRow({
  items,
  tone = "expense",
  label = "Мелкие статьи",
  formatValue = (v) => fmtMoney(v),
}: {
  items: SmallItem[];
  tone?: "income" | "expense";
  label?: string;
  formatValue?: (v: number) => string;
}) {
  const [open, setOpen] = useState(false);
  const { total, totalShare } = useMemo(() => {
    const t = items.reduce((s, i) => s + i.value, 0);
    const sh = items.reduce((s, i) => s + (i.share ?? 0), 0);
    return { total: t, totalShare: sh };
  }, [items]);
  if (items.length === 0) return null;
  const barColor = tone === "income" ? "bg-income" : "bg-expense";
  const txtColor = tone === "income" ? "text-good" : "text-bad";

  return (
    <li className="border-t border-border/40 pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-sm hover:text-primary"
      >
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"}`}
          />
          {label} · {items.length}
        </span>
        <span className="tabular">
          <span className="font-semibold">{formatValue(total)}</span>
          {totalShare > 0 && (
            <span className="ml-2 text-xs text-muted-foreground">
              {fmtPct(totalShare, totalShare < 1 ? 1 : 0)}
            </span>
          )}
        </span>
      </button>
      {open && (
        <ul className="mt-2 space-y-1 pl-5">
          {items.map((it) => (
            <li
              key={it.key}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="truncate text-muted-foreground">{it.label}</span>
              <span className="tabular">
                <span className={txtColor}>{formatValue(it.value)}</span>
                {it.share !== undefined && it.share >= 0.1 && (
                  <span className="ml-2 text-muted-foreground">
                    {fmtPct(it.share, 1)}
                  </span>
                )}
              </span>
            </li>
          ))}
          <li className="flex items-center justify-between gap-2 border-t border-border/30 pt-1.5 text-xs">
            <span className="text-muted-foreground">Итого мелких</span>
            <span className="tabular font-medium">{formatValue(total)}</span>
          </li>
        </ul>
      )}
      {totalShare > 0 && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${barColor} opacity-50`}
            style={{ width: `${Math.min(100, totalShare)}%` }}
          />
        </div>
      )}
    </li>
  );
}

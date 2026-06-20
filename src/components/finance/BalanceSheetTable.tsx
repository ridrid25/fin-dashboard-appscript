import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { BalanceRow } from "@/types/finance";
import { fmtMoney } from "@/lib/format";

// Иерархия: section1 → section2 → section3 → section4 → amount.
// По умолчанию свернуто: видны только section1 + section2.
// Клик по section2 раскрывает section3 (с их суммами).
// Клик по section3 раскрывает строки section4.
type Leaf = { label: string; amount: number };
type Group = { label: string; amount: number; leaves: Leaf[] };
type Section = { label: string; amount: number; groups: Group[] };
type Side = { label: string; amount: number; sections: Section[] };

export function BalanceSheetTable({ rows }: { rows: BalanceRow[] }) {
  const tree = useMemo<Side[]>(() => {
    const sides = new Map<string, Side>();
    rows.forEach((r) => {
      if (!sides.has(r.section1)) sides.set(r.section1, { label: r.section1, amount: 0, sections: [] });
      const side = sides.get(r.section1)!;
      side.amount += r.amount;

      let section = side.sections.find((s) => s.label === r.section2);
      if (!section) {
        section = { label: r.section2, amount: 0, groups: [] };
        side.sections.push(section);
      }
      section.amount += r.amount;

      let group = section.groups.find((g) => g.label === r.section3);
      if (!group) {
        group = { label: r.section3, amount: 0, leaves: [] };
        section.groups.push(group);
      }
      group.amount += r.amount;
      group.leaves.push({ label: r.section4, amount: r.amount });
    });
    return Array.from(sides.values());
  }, [rows]);

  const assets = tree.find((s) => s.label === "Актив")?.amount ?? 0;
  const liab = tree.find((s) => s.label === "Пассив")?.amount ?? 0;
  const diff = assets - liab;
  const balanced = Math.abs(diff) < 1000; // допуск 1 тыс. ₽

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        {tree.map((side) => (
          <div key={side.label} className="rounded-xl border border-border/60 bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
              <div className="font-display text-base font-semibold">{side.label}</div>
              <div className="tabular text-sm font-semibold">{fmtMoney(side.amount)}</div>
            </div>
            <ul>
              {side.sections.map((s) => (
                <SectionNode key={s.label} label={s.label} amount={s.amount} groups={s.groups} />
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div
        className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs ${
          balanced
            ? "border-good/30 bg-good/10 text-good"
            : "border-warn/40 bg-warn/10 text-warn"
        }`}
      >
        <span>
          {balanced
            ? "Баланс сходится: Актив = Пассив"
            : `Баланс не сходится: разница ${fmtMoney(Math.abs(diff))}`}
        </span>
        <span className="tabular text-muted-foreground">
          Актив {fmtMoney(assets)} · Пассив {fmtMoney(liab)}
        </span>
      </div>
    </div>
  );
}

function SectionNode({
  label,
  amount,
  groups,
}: {
  label: string;
  amount: number;
  groups: Group[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-b border-border/40 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 bg-muted/30 px-4 py-2.5 text-left text-sm font-semibold hover:bg-muted/50"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-1.5">
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"}`} />
          {label}
        </span>
        <span className="tabular">{fmtMoney(amount)}</span>
      </button>
      {open && (
        <ul className="py-1">
          {groups.map((g) => (
            <GroupNode key={g.label} label={g.label} amount={g.amount} leaves={g.leaves} />
          ))}
        </ul>
      )}
    </li>
  );
}

function GroupNode({ label, amount, leaves }: { label: string; amount: number; leaves: Leaf[] }) {
  const [open, setOpen] = useState(false);
  const hasDetails = leaves.length > 1 || (leaves[0] && leaves[0].label !== label);
  return (
    <li>
      <button
        type="button"
        onClick={() => hasDetails && setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-3 px-4 py-1.5 text-left text-sm ${
          hasDetails ? "hover:bg-muted/30" : "cursor-default"
        }`}
        aria-expanded={open}
        disabled={!hasDetails}
      >
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          {hasDetails ? (
            <ChevronDown className={`h-3 w-3 transition-transform ${open ? "" : "-rotate-90"}`} />
          ) : (
            <span className="h-3 w-3" />
          )}
          {label}
        </span>
        <span className="tabular">{fmtMoney(amount)}</span>
      </button>
      {open && hasDetails && (
        <ul className="pb-1">
          {leaves.map((leaf) => (
            <li
              key={leaf.label}
              className="flex items-center justify-between gap-3 px-4 py-1 pl-10 text-xs text-muted-foreground"
            >
              <span className="truncate">{leaf.label}</span>
              <span className="tabular">{fmtMoney(leaf.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

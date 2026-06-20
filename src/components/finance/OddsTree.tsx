import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { OddsSectionRow } from "@/types/finance";
import { fmtMoney } from "@/lib/format";

// Иерархическая ОДДС: Раздел → Статья → месяцы. На mobile делается горизонтальный
// скролл; на desktop колонки месяцев видны сразу.
export function OddsTree({ rows }: { rows: OddsSectionRow[] }) {
  const months = rows[0]?.articles[0]?.months.map((m) => m.month) ?? [];
  const totalIncome = rows.reduce((s, r) => s + r.income, 0);
  const totalExpense = rows.reduce((s, r) => s + r.expense, 0);
  const totalNet = rows.reduce((s, r) => s + r.net, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-y border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="sticky left-0 z-10 bg-card px-4 py-2 sm:px-5">Раздел / статья</th>
            {months.map((m) => (
              <th key={m} className="px-2 py-2 text-right tabular">{m}</th>
            ))}
            <th className="px-4 py-2 pr-4 text-right tabular sm:pr-5">Итого</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <OddsSectionBlock key={s.section} section={s} />
          ))}
          <tr className="border-t border-border/70 bg-accent/30">
            <td className="sticky left-0 z-10 bg-accent/30 px-4 py-3 font-semibold sm:px-5">Итого</td>
            {months.map((m, i) => {
              const v = rows.reduce(
                (s, r) =>
                  s +
                  r.articles.reduce(
                    (ss, a) => ss + (a.kind === "Приход" ? 1 : -1) * (a.months[i]?.value ?? 0),
                    0,
                  ),
                0,
              );
              return (
                <td key={m} className={`px-2 py-3 text-right tabular text-xs ${v >= 0 ? "text-good" : "text-bad"}`}>
                  {fmtMoney(v)}
                </td>
              );
            })}
            <td className={`px-4 py-3 pr-4 text-right tabular font-semibold sm:pr-5 ${totalNet >= 0 ? "text-good" : "text-bad"}`}>
              {fmtMoney(totalNet, { sign: true })}
              <div className="text-[10px] font-normal text-muted-foreground">
                +{fmtMoney(totalIncome)} / −{fmtMoney(totalExpense)}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function OddsSectionBlock({ section }: { section: OddsSectionRow }) {
  const [open, setOpen] = useState(false);
  const months = section.articles[0]?.months ?? [];
  return (
    <>
      <tr className="border-b border-border/40 bg-muted/30">
        <td className="sticky left-0 z-10 bg-muted/30 px-4 py-2.5 sm:px-5">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 font-semibold hover:text-primary"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"}`} />
            {section.section}
          </button>
        </td>
        {months.map((mm, i) => {
          const v = section.articles.reduce(
            (s, a) => s + (a.kind === "Приход" ? 1 : -1) * (a.months[i]?.value ?? 0),
            0,
          );
          return (
            <td key={mm.month} className={`px-2 py-2.5 text-right tabular text-xs ${v >= 0 ? "text-good" : "text-bad"}`}>
              {v === 0 ? "—" : fmtMoney(v)}
            </td>
          );
        })}
        <td className={`px-4 py-2.5 pr-4 text-right tabular font-semibold sm:pr-5 ${section.net >= 0 ? "text-good" : "text-bad"}`}>
          {fmtMoney(section.net, { sign: true })}
        </td>
      </tr>
      {open &&
        section.articles.map((a) => (
          <tr key={a.article} className="border-b border-border/30">
            <td className="sticky left-0 z-10 bg-card px-4 py-2 pl-10 text-muted-foreground sm:px-5" title={a.article}>
              <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${a.kind === "Приход" ? "bg-good" : "bg-bad"}`} />
              <span className="inline-block max-w-[260px] truncate align-middle">{a.article}</span>
            </td>
            {a.months.map((mm) => (
              <td key={mm.month} className="px-2 py-2 text-right tabular text-xs text-muted-foreground">
                {mm.value === 0 ? "—" : fmtMoney(a.kind === "Приход" ? mm.value : -mm.value)}
              </td>
            ))}
            <td className={`px-4 py-2 pr-4 text-right tabular sm:pr-5 ${a.kind === "Приход" ? "text-good" : "text-bad"}`}>
              {fmtMoney(a.kind === "Приход" ? a.total : -a.total)}
            </td>
          </tr>
        ))}
    </>
  );
}

export function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-border bg-card px-2 text-sm text-foreground outline-none focus:border-ring"
      >
        <option value="">Все</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{children}</div>;
}

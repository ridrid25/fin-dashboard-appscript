import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { ProjectMatrixRow } from "@/types/finance";
import { fmtMoney, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

// Управленческий вид: верхний уровень — направления (свёрнуто).
// Раскрытие → top-5 проектов + строка «Остальные проекты · N» с собственным раскрытием.
export function ProjectMatrix({ rows }: { rows: ProjectMatrixRow[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, ProjectMatrixRow[]>();
    rows.forEach((r) => {
      if (!map.has(r.direction)) map.set(r.direction, []);
      map.get(r.direction)!.push(r);
    });
    const arr = Array.from(map.entries()).map(([direction, projs]) => {
      const dirRev = projs.reduce((s, r) => s + r.revenue, 0);
      const dirGp = projs.reduce((s, r) => s + r.grossProfit, 0);
      return { direction, projs, dirRev, dirGp };
    });
    // Направления — по убыванию выручки.
    arr.sort((a, b) => Math.abs(b.dirRev) - Math.abs(a.dirRev));
    return arr;
  }, [rows]);

  const totalRev = rows.reduce((s, r) => s + r.revenue, 0);
  const totalGp = rows.reduce((s, r) => s + r.grossProfit, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-y border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-2 sm:px-5">Направление / проект</th>
            <th className="px-3 py-2 text-right">Выручка</th>
            <th className="px-3 py-2 text-right">Валовая</th>
            <th className="px-4 py-2 pr-4 text-right sm:pr-5">MR%</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <Group key={g.direction} {...g} />
          ))}
          <tr className="border-t border-border/70 bg-accent/30">
            <td className="px-4 py-3 font-semibold sm:px-5">Итого</td>
            <td className="px-3 py-3 text-right tabular font-semibold">{fmtMoney(totalRev)}</td>
            <td className="px-3 py-3 text-right tabular font-semibold">{fmtMoney(totalGp)}</td>
            <td className="px-4 py-3 pr-4 text-right tabular font-semibold sm:pr-5">
              {totalRev !== 0 ? fmtPct((totalGp / totalRev) * 100) : "—"}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const TOP_PROJECTS = 5;

function Group({
  direction,
  dirRev,
  dirGp,
  projs,
}: {
  direction: string;
  dirRev: number;
  dirGp: number;
  projs: ProjectMatrixRow[];
}) {
  const [open, setOpen] = useState(false);
  const [restOpen, setRestOpen] = useState(false);

  const sorted = useMemo(
    () =>
      [...projs].sort((a, b) => {
        const r = Math.abs(b.revenue) - Math.abs(a.revenue);
        if (r !== 0) return r;
        return Math.abs(b.grossProfit) - Math.abs(a.grossProfit);
      }),
    [projs],
  );
  const top = sorted.slice(0, TOP_PROJECTS);
  const rest = sorted.slice(TOP_PROJECTS);
  const restRev = rest.reduce((s, p) => s + p.revenue, 0);
  const restGp = rest.reduce((s, p) => s + p.grossProfit, 0);

  return (
    <>
      <tr
        className="cursor-pointer border-b border-border/40 bg-muted/40 hover:bg-muted/60"
        onClick={() => setOpen((v) => !v)}
      >
        <td className="px-4 py-2.5 font-semibold sm:px-5" title={direction}>
          <span className="inline-flex items-center gap-2">
            <ChevronRight
              className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")}
            />
            <span className="truncate">{direction}</span>
            <span className="ml-1 shrink-0 rounded-full bg-background/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {projs.length}&nbsp;{plural(projs.length, ["проект", "проекта", "проектов"])}
            </span>
          </span>
        </td>
        <td className="px-3 py-2.5 text-right tabular font-semibold">{fmtMoney(dirRev)}</td>
        <td className="px-3 py-2.5 text-right tabular font-semibold">{fmtMoney(dirGp)}</td>
        <td className="px-4 py-2.5 pr-4 text-right tabular font-semibold sm:pr-5">
          {dirRev !== 0 ? fmtPct((dirGp / dirRev) * 100) : "—"}
        </td>
      </tr>

      {open &&
        top.map((p) => (
          <tr key={p.project} className="border-b border-border/20">
            <td className="px-4 py-2 pl-10 text-muted-foreground sm:px-5" title={p.project}>
              <span className="inline-block max-w-[220px] truncate align-middle sm:max-w-[320px]">{p.project}</span>
            </td>
            <td className="px-3 py-2 text-right tabular">{fmtMoney(p.revenue)}</td>
            <td className="px-3 py-2 text-right tabular">{fmtMoney(p.grossProfit)}</td>
            <td className="px-4 py-2 pr-4 text-right tabular sm:pr-5">{fmtPct(p.marginPct)}</td>
          </tr>
        ))}

      {open && rest.length > 0 && (
        <>
          <tr
            className="cursor-pointer border-b border-border/20 hover:bg-muted/30"
            onClick={() => setRestOpen((v) => !v)}
          >
            <td className="px-4 py-2 pl-10 text-muted-foreground sm:px-5">
              <span className="inline-flex items-center gap-2">
                <ChevronRight
                  className={cn("h-3.5 w-3.5 shrink-0 transition-transform", restOpen && "rotate-90")}
                />
                <span className="italic">Остальные проекты · {rest.length}</span>
              </span>
            </td>
            <td className="px-3 py-2 text-right tabular">{fmtMoney(restRev)}</td>
            <td className="px-3 py-2 text-right tabular">{fmtMoney(restGp)}</td>
            <td className="px-4 py-2 pr-4 text-right tabular sm:pr-5">
              {restRev !== 0 ? fmtPct((restGp / restRev) * 100) : "—"}
            </td>
          </tr>
          {restOpen &&
            rest.map((p) => (
              <tr key={p.project} className="border-b border-border/20 text-muted-foreground/90">
                <td className="px-4 py-1.5 pl-16 text-xs sm:px-5" title={p.project}>
                  <span className="inline-block max-w-[220px] truncate align-middle sm:max-w-[320px]">{p.project}</span>
                </td>
                <td className="px-3 py-1.5 text-right tabular text-xs">{fmtMoney(p.revenue)}</td>
                <td className="px-3 py-1.5 text-right tabular text-xs">{fmtMoney(p.grossProfit)}</td>
                <td className="px-4 py-1.5 pr-4 text-right tabular text-xs sm:pr-5">{fmtPct(p.marginPct)}</td>
              </tr>
            ))}
        </>
      )}
    </>
  );
}

function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const n1 = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}

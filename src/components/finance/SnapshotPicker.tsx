import { CalendarClock } from "lucide-react";
import { usePeriod } from "@/context/period-context";
import { formatDateRuShort } from "@/lib/format";

// Выбор среза капитала из meta.allSnapshotDates. Меняет только dateTo.
export function SnapshotPicker({ snapshots, current }: { snapshots: string[]; current: string }) {
  const { setDateTo } = usePeriod();
  const tip = "Доступные срезы капитала из Google Sheets";
  return (
    <label
      className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm"
      title={tip}
    >
      <CalendarClock className="h-4 w-4 text-muted-foreground" />
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Срез</span>
      <select
        value={current.slice(0, 10)}
        onChange={(e) => setDateTo(e.target.value)}
        aria-label={tip}
        className="bg-transparent text-sm font-medium tabular outline-none"
      >
        {snapshots.map((s) => (
          <option key={s} value={s}>
            {formatDateRuShort(s)}
          </option>
        ))}
      </select>
    </label>
  );
}

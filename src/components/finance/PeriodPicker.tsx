import { useState, useMemo, type ReactNode } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePeriod } from "@/context/period-context";
import type { PeriodPreset } from "@/lib/period-presets";

const MONTHS_SHORT = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const lastDay = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

function Chip({
  active,
  onClick,
  children,
  className = "",
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 rounded-md border px-2 text-xs font-medium transition-colors ${
        active
          ? "border-primary/60 bg-primary/15 text-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1.5 mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground first:mt-0">
      {children}
    </div>
  );
}

export function PeriodPicker() {
  const { preset, label, dateFrom, dateTo, setPreset, setCustomRange } = usePeriod();
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(dateFrom);
  const [customTo, setCustomTo] = useState(dateTo);

  const nowYear = new Date().getFullYear();
  const fromYear = Number(dateFrom.slice(0, 4)) || nowYear;
  const [year, setYear] = useState<number>(fromYear);

  // Активность: вычисляем из текущего диапазона.
  const active = useMemo(() => {
    const f = dateFrom;
    const t = dateTo;
    const monthActive = (y: number, m: number) =>
      f === isoDay(y, m, 1) && t === isoDay(y, m, lastDay(y, m));
    const quarterActive = (y: number, q: number) =>
      f === isoDay(y, q * 3, 1) && t === isoDay(y, q * 3 + 2, lastDay(y, q * 3 + 2));
    const fullYearActive = (y: number) => f === `${y}-01-01` && t === `${y}-12-31`;
    return { monthActive, quarterActive, fullYearActive };
  }, [dateFrom, dateTo]);

  const choosePreset = (p: PeriodPreset) => {
    setPreset(p);
    setOpen(false);
  };

  const chooseMonth = (m: number) => {
    setCustomRange(isoDay(year, m, 1), isoDay(year, m, lastDay(year, m)));
    setOpen(false);
  };

  const chooseQuarter = (q: number) => {
    setCustomRange(isoDay(year, q * 3, 1), isoDay(year, q * 3 + 2, lastDay(year, q * 3 + 2)));
    setOpen(false);
  };

  const chooseFullYear = () => {
    setCustomRange(`${year}-01-01`, `${year}-12-31`);
    setOpen(false);
  };

  const applyCustom = () => {
    setCustomRange(customFrom, customTo);
    setOpen(false);
  };

  const ytdActive = preset === "ytd" && fromYear === nowYear;

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        if (v) {
          setCustomFrom(dateFrom);
          setCustomTo(dateTo);
          setYear(Number(dateFrom.slice(0, 4)) || nowYear);
        }
        setOpen(v);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Выбрать период"
          className="inline-flex h-9 max-w-full items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="hidden text-xs text-muted-foreground sm:inline">Период:</span>
          <span className="truncate font-medium tabular">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(23.75rem,calc(100vw-1.5rem))] p-3">
        {/* Год */}
        <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-card/60 p-1">
          <button
            type="button"
            onClick={() => setYear((y) => y - 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Предыдущий год"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-8 flex-1 cursor-pointer rounded-md bg-transparent text-center text-sm font-semibold tabular text-foreground outline-none focus:bg-accent"
            aria-label="Год"
          >
            {Array.from({ length: 11 }, (_, i) => nowYear - 5 + i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setYear((y) => y + 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Следующий год"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <GroupLabel>Быстрые</GroupLabel>
        <div className="grid grid-cols-4 gap-1.5">
          <Chip active={preset === "thisMonth"} onClick={() => choosePreset("thisMonth")}>Этот мес.</Chip>
          <Chip active={preset === "lastMonth"} onClick={() => choosePreset("lastMonth")}>Прошлый</Chip>
          <Chip active={ytdActive} onClick={() => choosePreset("ytd")}>YTD</Chip>
          <Chip active={preset === "thisYear"} onClick={() => choosePreset("thisYear")}>Этот год</Chip>
        </div>

        <GroupLabel>Месяцы {year}</GroupLabel>
        <div className="grid grid-cols-4 gap-1.5">
          {MONTHS_SHORT.map((name, m) => (
            <Chip key={m} active={active.monthActive(year, m)} onClick={() => chooseMonth(m)}>
              {name}
            </Chip>
          ))}
        </div>

        <GroupLabel>Кварталы {year}</GroupLabel>
        <div className="grid grid-cols-4 gap-1.5">
          {[0, 1, 2, 3].map((q) => (
            <Chip key={q} active={active.quarterActive(year, q)} onClick={() => chooseQuarter(q)}>
              Q{q + 1}
            </Chip>
          ))}
        </div>

        <GroupLabel>Накопительно {year}</GroupLabel>
        <div className="grid grid-cols-4 gap-1.5">
          <Chip
            active={dateFrom === `${year}-01-01` && dateTo === isoDay(year, 2, lastDay(year, 2))}
            onClick={() => {
              setCustomRange(`${year}-01-01`, isoDay(year, 2, lastDay(year, 2)));
              setOpen(false);
            }}
          >
            3 мес.
          </Chip>
          <Chip
            active={dateFrom === `${year}-01-01` && dateTo === isoDay(year, 5, lastDay(year, 5))}
            onClick={() => {
              setCustomRange(`${year}-01-01`, isoDay(year, 5, lastDay(year, 5)));
              setOpen(false);
            }}
          >
            6 мес.
          </Chip>
          <Chip
            active={dateFrom === `${year}-01-01` && dateTo === isoDay(year, 8, lastDay(year, 8))}
            onClick={() => {
              setCustomRange(`${year}-01-01`, isoDay(year, 8, lastDay(year, 8)));
              setOpen(false);
            }}
          >
            9 мес.
          </Chip>
          <Chip active={active.fullYearActive(year)} onClick={chooseFullYear}>
            Год
          </Chip>
        </div>

        <GroupLabel>Произвольный период</GroupLabel>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            С даты
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-9 rounded-md border border-border bg-input/40 px-2 text-sm tabular text-foreground outline-none focus:border-ring"
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            По дату
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-9 rounded-md border border-border bg-input/40 px-2 text-sm tabular text-foreground outline-none focus:border-ring"
            />
          </label>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground tabular">{label}</span>
          <button
            type="button"
            onClick={applyCustom}
            className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Применить
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

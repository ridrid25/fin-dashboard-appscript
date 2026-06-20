import { Children, useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { fmtMoney } from "@/lib/format";
import { sortByFinancialSignificance, type WeightMap } from "@/lib/significance";

// Custom combobox: значения отсортированы по значимости в выбранном периоде.
// Сверху "Все", дальше top по сумме, ниже секция "Прочие" (вес < 1% от итога).
// Поиск, скролл, компактная высота, чип выбранного значения.
export function SignificanceFilter({
  label,
  value,
  options,
  weights = {},
  onChange,
  placeholder = "Все",
  showAmounts = true,
}: {
  label: string;
  value: string;
  options: string[];
  weights?: WeightMap;
  onChange: (v: string) => void;
  placeholder?: string;
  showAmounts?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const { big, small, hasWeights } = useMemo(() => {
    const ranked = sortByFinancialSignificance(options, weights);
    const hasW = Object.keys(weights).length > 0 && ranked.some((r) => r.weight > 0);
    if (!hasW) return { big: ranked, small: [], hasWeights: false };
    const big = ranked.filter((r) => r.share >= 1 || r.weight > 0 && ranked.indexOf(r) < 8);
    const small = ranked.filter((r) => !big.includes(r));
    return { big, small, hasWeights: true };
  }, [options, weights]);

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="group flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 text-sm text-foreground transition-colors hover:border-ring/50 focus:border-ring focus:outline-none"
          >
            <span className={cn("truncate text-left", !value && "text-muted-foreground")}>
              {value || placeholder}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {value && (
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange("");
                  }}
                  className="grid h-5 w-5 place-items-center rounded hover:bg-accent"
                  aria-label="Сбросить"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </span>
              )}
              <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={4}
          className="w-[min(360px,calc(100vw-2rem))] p-0"
        >
          <Command shouldFilter>
            <CommandInput placeholder={`Поиск · ${label.toLowerCase()}`} className="h-9" />
            <CommandList className="max-h-[320px]">
              <CommandEmpty>Ничего не найдено</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="__all__"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex items-center gap-2">
                    <Check className={cn("h-3.5 w-3.5", !value ? "opacity-100" : "opacity-0")} />
                    <span className="font-medium">Все · {label.toLowerCase()}</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">{options.length}</span>
                </CommandItem>
              </CommandGroup>
              {big.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading={hasWeights ? "По значимости" : "Все"}>
                    {big.map((opt) => (
                      <CommandItem
                        key={opt.value}
                        value={opt.value}
                        onSelect={() => {
                          onChange(opt.value);
                          setOpen(false);
                        }}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Check className={cn("h-3.5 w-3.5 shrink-0", value === opt.value ? "opacity-100" : "opacity-0")} />
                          <span className="truncate" title={opt.value}>{opt.value}</span>
                        </span>
                        {showAmounts && opt.weight > 0 && (
                          <span className="shrink-0 tabular text-[11px] text-muted-foreground">
                            {fmtMoney(opt.weight)} · {opt.share.toFixed(opt.share >= 10 ? 0 : 1)}%
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
              {small.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading={`Прочие · ${small.length}`}>
                    {small.map((opt) => (
                      <CommandItem
                        key={opt.value}
                        value={opt.value}
                        onSelect={() => {
                          onChange(opt.value);
                          setOpen(false);
                        }}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Check className={cn("h-3.5 w-3.5 shrink-0", value === opt.value ? "opacity-100" : "opacity-0")} />
                          <span className="truncate text-muted-foreground" title={opt.value}>{opt.value}</span>
                        </span>
                        {showAmounts && opt.weight > 0 && (
                          <span className="shrink-0 tabular text-[11px] text-muted-foreground">
                            {fmtMoney(opt.weight)}
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function SignificanceFilterBar({ children }: { children: React.ReactNode }) {
  // Сетка считает реальное число фильтров и раскладывает их в ровные колонки.
  // 1 → max-w-sm, 2 → 2 колонки, 3 → 3, 4 → 4, 5+ → auto-fit без перекоса.
  // На mobile всегда 1 колонка, на sm/md промежуточное состояние без дырок.
  const count = Children.toArray(children).filter(Boolean).length;
  const lg =
    count <= 1
      ? "lg:grid-cols-1 lg:max-w-sm"
      : count === 2
        ? "lg:grid-cols-2"
        : count === 3
          ? "lg:grid-cols-3"
          : count === 4
            ? "lg:grid-cols-4"
            : "lg:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]";
  const md =
    count <= 2 ? "md:grid-cols-2" : count === 4 ? "md:grid-cols-2" : "md:grid-cols-3";
  return (
    <div className={cn("grid grid-cols-1 gap-2 sm:grid-cols-2", md, lg)}>{children}</div>
  );
}

import { X } from "lucide-react";

export interface FilterChip {
  label: string;      // например "Направление"
  value: string;      // выбранное значение
  onClear: () => void;
}

// Показывает плашки активных фильтров + кнопку сброса всех.
// Если ничего не выбрано — выводит подсказку "Фильтры не применены".
export function ActiveFilters({
  chips,
  onResetAll,
}: {
  chips: FilterChip[];
  onResetAll: () => void;
}) {
  const active = chips.filter((c) => c.value);
  if (active.length === 0) {
    return (
      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Фильтры не применены</span>
      </div>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">Активные фильтры:</span>
      {active.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={c.onClear}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-accent/40 px-2.5 py-1 text-xs text-foreground hover:bg-accent"
          title="Снять фильтр"
        >
          <span className="text-muted-foreground">{c.label}:</span>
          <span className="font-medium">{c.value}</span>
          <X className="h-3 w-3 opacity-70" />
        </button>
      ))}
      <button
        type="button"
        onClick={onResetAll}
        className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs hover:bg-accent"
      >
        Сбросить фильтры
      </button>
    </div>
  );
}

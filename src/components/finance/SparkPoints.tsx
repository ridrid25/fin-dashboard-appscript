// Компактная альтернатива линейному графику, когда точек слишком мало (1–2):
// растянутая диагональная линия выглядит как «огромная пустая коробка».
// Здесь мы показываем доступные срезы списком — это честнее.
import { formatDateRuShort } from "@/lib/format";

export function SparkPoints({
  points,
  format,
  label,
}: {
  points: { month: string; value: number }[];
  format: (v: number) => string;
  label?: string;
}) {
  if (points.length === 0) {
    return <div className="grid h-24 place-items-center text-xs text-muted-foreground">Нет данных за выбранный период</div>;
  }
  // month может быть "2023-06" или "2023-06-28"
  const fmtMonth = (m: string) => {
    const s = String(m);
    if (/^\d{4}-\d{2}$/.test(s)) {
      const [y, mm] = s.split("-").map(Number);
      const NAMES = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
      return `${NAMES[(mm || 1) - 1]} ${y}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return formatDateRuShort(s);
    return s;
  };
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
      {label && <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>}
      <ul className="space-y-1.5">
        {points.map((p, i) => (
          <li key={i} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground tabular">{fmtMonth(p.month)}</span>
            <span className="tabular font-semibold">{format(p.value)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 text-[11px] text-muted-foreground">
        Доступно срезов: {points.length}. Для тренда нужно ≥ 3 точек.
      </div>
    </div>
  );
}

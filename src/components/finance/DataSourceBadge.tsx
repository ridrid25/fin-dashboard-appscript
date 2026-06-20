import { DATA_SOURCE } from "@/lib/finance-api";

// Служебный индикатор источника данных. По умолчанию скрыт — чтобы в production
// пользователь не видел технический ярлык. Включается явно переменной окружения
// VITE_SHOW_DATA_SOURCE_BADGE=true (для dev/debug режима).
const SHOW = String(import.meta.env.VITE_SHOW_DATA_SOURCE_BADGE ?? "").toLowerCase() === "true";

export function DataSourceBadge() {
  if (!SHOW) return null;
  const isLive = DATA_SOURCE === "live";
  return (
    <div className="pointer-events-none fixed bottom-1 right-2 z-50 hidden select-none sm:block">
      <span
        className={`tabular text-[10px] uppercase tracking-wider opacity-60 ${
          isLive ? "text-good" : "text-warn"
        }`}
      >
        Data source: {DATA_SOURCE}
      </span>
    </div>
  );
}

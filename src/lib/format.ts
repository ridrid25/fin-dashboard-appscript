// Форматтеры финансовых величин. Единицы подписаны явно.

// NBSP (U+00A0) между числом, единицей и ₽ — чтобы сумма никогда не переносилась.
const NBSP = "\u00A0";
export const fmtMoney = (n: number, opts: { compact?: boolean; sign?: boolean } = {}) => {
  const { compact = true, sign = false } = opts;
  const abs = Math.abs(n);
  let str: string;
  if (compact) {
    if (abs >= 1_000_000) str = (n / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2) + NBSP + "млн";
    else if (abs >= 1_000) str = (n / 1_000).toFixed(0) + NBSP + "тыс";
    else str = n.toFixed(0);
  } else {
    str = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n).replace(/\s/g, NBSP);
  }
  return (sign && n > 0 ? "+" : "") + str + NBSP + "₽";
};

// alias под целевой контракт
export const fmtCurrency = fmtMoney;

// Безопасная нормализация процента: API может прислать долю (0.54) или
// уже проценты (54 / 27.4). Если |v| <= 1.5 — считаем долей и умножаем на 100,
// иначе принимаем как готовый процент. Защищает UI от значений вроде "17016%".
export const toPct = (v: number): number => {
  if (!Number.isFinite(v)) return 0;
  return Math.abs(v) <= 1.5 ? v * 100 : v;
};

// проценты подаём как 27.4 (уже %), без деления.
export const fmtPercent = (n: number, digits = 1) => `${n.toFixed(digits)}%`;
export const fmtPct = fmtPercent;

export const fmtRatio = (n: number, digits = 2) => n.toFixed(digits);

export const fmtDays = (n: number) => `${Math.round(n)} дн.`;
// Cash buffer хранится в днях; для подписи «N мес.» делим на 30.
export const fmtMonths = (n: number) => `${n.toFixed(1)} мес.`;
export const daysToMonths = (days: number) => days / 30;

// Парсим только YYYY-MM-DD из iso, чтобы избежать UTC-сдвига на сутки.
function parseIsoDateParts(iso: string): { y: number; m: number; d: number } {
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  return { y: y || 1970, m: (m || 1), d: (d || 1) };
}

export const formatDateRu = (iso: string) => {
  const { y, m, d } = parseIsoDateParts(iso);
  return new Date(y, m - 1, d).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
};

// Короткий числовой формат: 28.06.2023 — без UTC-сдвигов.
export const formatDateRuShort = (iso: string) => {
  const { y, m, d } = parseIsoDateParts(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d)}.${pad(m)}.${y}`;
};

// Диапазон периода: "01.01.2023 — 30.06.2023" (NBSP вокруг тире — не переносится).
export const formatPeriodRange = (from: string, to: string) =>
  `${formatDateRuShort(from)}${"\u00A0"}—${"\u00A0"}${formatDateRuShort(to)}`;

// Разница в днях между двумя ISO-датами (без учёта времени/таймзоны).
export const daysBetweenIso = (a: string, b: string): number => {
  const pa = parseIsoDateParts(a);
  const pb = parseIsoDateParts(b);
  const da = Date.UTC(pa.y, pa.m - 1, pa.d);
  const db = Date.UTC(pb.y, pb.m - 1, pb.d);
  return Math.round((db - da) / 86400000);
};

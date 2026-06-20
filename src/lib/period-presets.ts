// Финансовые пресеты периодов. dateFrom/dateTo формата YYYY-MM-DD.
// Чистая функция: не зависит от React/состояния.

export type PeriodPreset =
  | "thisMonth"
  | "lastMonth"
  | "thisQuarter"
  | "lastQuarter"
  | "q1"
  | "q2"
  | "q3"
  | "q4"
  | "thisYear"
  | "lastYear"
  | "ytd"
  | "custom";

const MONTHS_SHORT = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfMonth = (y: number, m: number) => new Date(y, m, 1);
const endOfMonth = (y: number, m: number) => new Date(y, m + 1, 0);

export function computeRange(preset: PeriodPreset, now = new Date()): { dateFrom: string; dateTo: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const curQ = Math.floor(m / 3); // 0..3

  const quarter = (yy: number, q: number) => ({
    dateFrom: iso(startOfMonth(yy, q * 3)),
    dateTo: iso(endOfMonth(yy, q * 3 + 2)),
  });

  switch (preset) {
    case "thisMonth":
      return { dateFrom: iso(startOfMonth(y, m)), dateTo: iso(endOfMonth(y, m)) };
    case "lastMonth": {
      const ref = new Date(y, m - 1, 1);
      return { dateFrom: iso(startOfMonth(ref.getFullYear(), ref.getMonth())), dateTo: iso(endOfMonth(ref.getFullYear(), ref.getMonth())) };
    }
    case "thisQuarter":
      return quarter(y, curQ);
    case "lastQuarter": {
      const lq = curQ === 0 ? 3 : curQ - 1;
      const ly = curQ === 0 ? y - 1 : y;
      return quarter(ly, lq);
    }
    case "q1": return quarter(y, 0);
    case "q2": return quarter(y, 1);
    case "q3": return quarter(y, 2);
    case "q4": return quarter(y, 3);
    case "thisYear":
      return { dateFrom: `${y}-01-01`, dateTo: `${y}-12-31` };
    case "lastYear":
      return { dateFrom: `${y - 1}-01-01`, dateTo: `${y - 1}-12-31` };
    case "ytd":
      return { dateFrom: `${y}-01-01`, dateTo: iso(now) };
    case "custom":
      return { dateFrom: `${y}-01-01`, dateTo: iso(now) };
  }
}

// Человекочитаемая короткая подпись периода.
// Если диапазон совпадает с известным пресетом — показываем его «красивое» имя,
// иначе — DD.MM.YYYY–DD.MM.YYYY.
export function formatPeriodLabel(dateFrom: string, dateTo: string, preset: PeriodPreset): string {
  // Парсим только YYYY-MM-DD, чтобы не зависеть от таймзоны браузера
  // (new Date("2023-01-01") в западных таймзонах превращается в 31.12.2022).
  const parse = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return new Date(y || 1970, (m || 1) - 1, d || 1);
  };
  const from = parse(dateFrom);
  const to = parse(dateTo);
  const fy = from.getFullYear();
  const ty = to.getFullYear();
  const fm = from.getMonth();
  const tm = to.getMonth();

  const ddmm = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;

  // ровно один месяц
  if (fy === ty && fm === tm && from.getDate() === 1 && to.getDate() === endOfMonth(ty, tm).getDate()) {
    return `${MONTHS_SHORT[fm]} ${fy}`;
  }

  // ровно квартал
  if (fy === ty && fm % 3 === 0 && tm === fm + 2 && from.getDate() === 1 && to.getDate() === endOfMonth(ty, tm).getDate()) {
    return `Q${fm / 3 + 1} ${fy}`;
  }

  // ровно год
  if (fy === ty && fm === 0 && tm === 11 && from.getDate() === 1 && to.getDate() === 31) {
    return `${fy}`;
  }

  // накопительно с 1 января: 6 мес. / 9 мес.
  if (
    fy === ty &&
    fm === 0 &&
    from.getDate() === 1 &&
    to.getDate() === endOfMonth(ty, tm).getDate() &&
    (tm === 5 || tm === 8)
  ) {
    const months = tm + 1;
    return `${months} мес. ${fy}`;
  }

  // YTD: с 1 января по сегодня
  if (preset === "ytd" || (fy === ty && fm === 0 && from.getDate() === 1 && to.getTime() < endOfMonth(ty, 11).getTime())) {
    return `${fy} YTD`;
  }

  // несколько месяцев одного года
  if (fy === ty && from.getDate() === 1 && to.getDate() === endOfMonth(ty, tm).getDate()) {
    return `${MONTHS_SHORT[fm]}–${MONTHS_SHORT[tm]} ${fy}`;
  }

  return `${ddmm(from)}–${ddmm(to)}`;
}

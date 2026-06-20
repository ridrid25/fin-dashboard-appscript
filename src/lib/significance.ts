// Helpers to rank финансовые справочники по значимости в выбранном периоде,
// а не по алфавиту. Используется в custom combobox'ах.

export type WeightMap = Record<string, number>;

// Возвращает map значение → сумма. Принимает массив объектов с произвольным
// именем поля. Знак игнорируется — нас интересует модуль вклада.
export function buildWeightMap<T>(
  items: T[],
  keyOf: (item: T) => string,
  valueOf: (item: T) => number,
): WeightMap {
  const map: WeightMap = {};
  for (const it of items) {
    const k = keyOf(it);
    if (!k) continue;
    map[k] = (map[k] ?? 0) + Math.abs(valueOf(it));
  }
  return map;
}

export interface RankedOption {
  value: string;
  weight: number;
  share: number; // 0..100
}

// Возвращает options отсортированные по убыванию веса.
// Элементы без веса идут последними, в алфавитном порядке.
export function sortByFinancialSignificance(
  options: string[],
  weights: WeightMap = {},
): RankedOption[] {
  const total = Object.values(weights).reduce((s, v) => s + v, 0) || 0;
  return [...options]
    .map((value) => {
      const weight = weights[value] ?? 0;
      const share = total > 0 ? (weight / total) * 100 : 0;
      return { value, weight, share };
    })
    .sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      return a.value.localeCompare(b.value, "ru");
    });
}

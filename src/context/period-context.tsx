import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { computeRange, formatPeriodLabel, type PeriodPreset } from "@/lib/period-presets";
import { IS_LIVE_MODE } from "@/lib/finance-api";

interface PeriodState {
  dateFrom: string;
  dateTo: string;
  preset: PeriodPreset;
  label: string;
  setPreset: (p: PeriodPreset) => void;
  setDateFrom: (v: string) => void;
  setDateTo: (v: string) => void;
  setCustomRange: (from: string, to: string) => void;
}

const PeriodContext = createContext<PeriodState | null>(null);

const STORAGE_KEY = "cfo.period.v1";
const DEFAULT_PRESET: PeriodPreset = "thisYear";
// Live API сейчас содержит данные за 2023. Чтобы новый пользователь не видел
// пустой текущий год, по умолчанию открываем последний период с данными.
// Уважаем сохранённый выбор пользователя в localStorage — не перезаписываем.
const LIVE_DEFAULT = { dateFrom: "2023-01-01", dateTo: "2023-06-30" };

interface Persisted {
  preset: PeriodPreset;
  dateFrom: string;
  dateTo: string;
}

function loadInitial(): Persisted {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Persisted;
        if (p && p.preset && p.dateFrom && p.dateTo) return p;
      }
    } catch {
      /* ignore */
    }
  }
  if (IS_LIVE_MODE) {
    return { preset: "custom", dateFrom: LIVE_DEFAULT.dateFrom, dateTo: LIVE_DEFAULT.dateTo };
  }
  const r = computeRange(DEFAULT_PRESET);
  return { preset: DEFAULT_PRESET, dateFrom: r.dateFrom, dateTo: r.dateTo };
}

// Глобальный период. Живёт выше Outlet → не сбрасывается при навигации.
// Капитал использует только dateTo и НЕ должен трогать dateFrom — гарантируется
// раздельными setDateFrom/setDateTo.
export function PeriodProvider({ children }: { children: ReactNode }) {
  const [{ preset, dateFrom, dateTo }, setState] = useState<Persisted>(loadInitial);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ preset, dateFrom, dateTo }));
    } catch {
      /* ignore */
    }
  }, [preset, dateFrom, dateTo]);

  const setPreset = useCallback((p: PeriodPreset) => {
    if (p === "custom") {
      setState((s) => ({ ...s, preset: "custom" }));
      return;
    }
    const r = computeRange(p);
    setState({ preset: p, dateFrom: r.dateFrom, dateTo: r.dateTo });
  }, []);

  const setDateFrom = useCallback((v: string) => {
    setState((s) => ({ ...s, preset: "custom", dateFrom: v }));
  }, []);

  const setDateTo = useCallback((v: string) => {
    setState((s) => ({ ...s, preset: "custom", dateTo: v }));
  }, []);

  const setCustomRange = useCallback((from: string, to: string) => {
    setState({ preset: "custom", dateFrom: from, dateTo: to });
  }, []);

  const label = useMemo(() => formatPeriodLabel(dateFrom, dateTo, preset), [dateFrom, dateTo, preset]);

  const value = useMemo<PeriodState>(
    () => ({ dateFrom, dateTo, preset, label, setPreset, setDateFrom, setDateTo, setCustomRange }),
    [dateFrom, dateTo, preset, label, setPreset, setDateFrom, setDateTo, setCustomRange],
  );
  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
}

export function usePeriod() {
  const ctx = useContext(PeriodContext);
  if (!ctx) throw new Error("usePeriod must be used inside PeriodProvider");
  return ctx;
}

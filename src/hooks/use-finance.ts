import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { financeApi } from "@/lib/finance-api";
import { usePeriod } from "@/context/period-context";
import type { CapitalPayload, DashboardPayload, MoneyPayload, ProfitPayload } from "@/types/finance";

export interface MoneyFilters {
  account?: string | null;
  counterparty?: string | null;
  article?: string | null;
  direction?: string | null;
}
export interface ProfitFilters {
  project?: string | null;
  direction?: string | null;
  article?: string | null;
  section?: string | null;
}

const norm = (v: string | null | undefined) => (v ? v : null);

// Единые query keys, чтобы prefetch и useQuery попадали в один cache.
export const financeKeys = {
  dashboard: (dateFrom: string, dateTo: string) => ["dashboard", dateFrom, dateTo] as const,
  money: (dateFrom: string, dateTo: string, f: Required<MoneyFilters>) =>
    ["money", dateFrom, dateTo, f.account, f.counterparty, f.article, f.direction] as const,
  profit: (dateFrom: string, dateTo: string, f: Required<ProfitFilters>) =>
    ["profit", dateFrom, dateTo, f.project, f.direction, f.article, f.section] as const,
  capital: (dateTo: string) => ["capital", dateTo] as const,
};

const emptyMoney: Required<MoneyFilters> = { account: null, counterparty: null, article: null, direction: null };
const emptyProfit: Required<ProfitFilters> = { project: null, direction: null, article: null, section: null };

export function useDashboard() {
  const { dateFrom, dateTo } = usePeriod();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: financeKeys.dashboard(dateFrom, dateTo),
    queryFn: () => financeApi.dashboard({ dateFrom, dateTo }),
    placeholderData: keepPreviousData,
  });

  // Prefetch соседних страниц в фоне — переходы будут моментальными.
  useEffect(() => {
    if (query.status !== "success") return;
    qc.prefetchQuery({
      queryKey: financeKeys.money(dateFrom, dateTo, emptyMoney),
      queryFn: () => financeApi.money({ dateFrom, dateTo }),
    });
    qc.prefetchQuery({
      queryKey: financeKeys.profit(dateFrom, dateTo, emptyProfit),
      queryFn: () => financeApi.profit({ dateFrom, dateTo }),
    });
    qc.prefetchQuery({
      queryKey: financeKeys.capital(dateTo),
      queryFn: () => financeApi.capital({ dateTo }),
    });
  }, [query.status, qc, dateFrom, dateTo]);

  return query;
}

export function useMoney(filters: MoneyFilters = {}) {
  const { dateFrom, dateTo } = usePeriod();
  const f: Required<MoneyFilters> = {
    account: norm(filters.account),
    counterparty: norm(filters.counterparty),
    article: norm(filters.article),
    direction: norm(filters.direction),
  };
  return useQuery({
    queryKey: financeKeys.money(dateFrom, dateTo, f),
    queryFn: () => financeApi.money({ dateFrom, dateTo, ...f }),
    placeholderData: keepPreviousData,
  });
}

export function useProfit(filters: ProfitFilters = {}) {
  const { dateFrom, dateTo } = usePeriod();
  const f: Required<ProfitFilters> = {
    project: norm(filters.project),
    direction: norm(filters.direction),
    article: norm(filters.article),
    section: norm(filters.section),
  };
  return useQuery({
    queryKey: financeKeys.profit(dateFrom, dateTo, f),
    queryFn: () => financeApi.profit({ dateFrom, dateTo, ...f }),
    placeholderData: keepPreviousData,
  });
}

export function useCapital() {
  const { dateTo } = usePeriod();
  return useQuery({
    queryKey: financeKeys.capital(dateTo),
    queryFn: () => financeApi.capital({ dateTo }),
    placeholderData: keepPreviousData,
  });
}

// Типы для удобства за пределами хука.
export type { DashboardPayload, MoneyPayload, ProfitPayload, CapitalPayload };

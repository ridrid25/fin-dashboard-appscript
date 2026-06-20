// Facade for backend calls.
//
// Modes:
//   - live (VITE_APPS_SCRIPT_API_URL задан): GET ?api=...; ошибки API НЕ
//     подменяются mock-данными — возвращаем envelope { status:"error" }.
//   - mock (URL пуст): используются src/mocks/finance-mock.ts.

import {
  mockCapital,
  mockDashboard,
  mockMoney,
  mockProfit,
} from "@/mocks/finance-mock";
import {
  adaptCapital,
  adaptMoney,
  adaptProfit,
  composeDashboard,
} from "@/lib/finance-adapter";
import type {
  ApiResponse,
  CapitalParams,
  CapitalPayload,
  DashboardPayload,
  MoneyParams,
  MoneyPayload,
  PeriodParams,
  ProfitParams,
  ProfitPayload,
} from "@/types/finance";

const API_URL = (import.meta.env.VITE_APPS_SCRIPT_API_URL as string | undefined) ?? "";
export const IS_LIVE_MODE = Boolean(API_URL);
export const DATA_SOURCE: "live" | "mock" = IS_LIVE_MODE ? "live" : "mock";

function isEmptyFilter(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v !== "string") return false;
  const t = v.trim();
  if (!t) return true;
  return ["все", "all", "все счета", "все контрагенты", "все статьи", "все направления", "все проекты", "все разделы"].includes(t.toLowerCase());
}

function buildUrl(api: string, params: Record<string, unknown>): string {
  const url = new URL(API_URL);
  url.searchParams.set("api", api);
  for (const [k, v] of Object.entries(params)) {
    if (isEmptyFilter(v)) continue;
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function callApiRaw(api: string, params: Record<string, unknown>): Promise<ApiResponse<unknown>> {
  try {
    const res = await fetch(buildUrl(api, params), { method: "GET", credentials: "omit" });
    if (!res.ok) {
      return { status: "error", data: null, error: `HTTP ${res.status} ${res.statusText}` };
    }
    const json = (await res.json()) as ApiResponse<unknown>;
    if (!json || (json.status !== "success" && json.status !== "error")) {
      return { status: "error", data: null, error: "Некорректный envelope ответа Apps Script" };
    }
    return json;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { status: "error", data: null, error: `Ошибка вызова Apps Script API: ${msg}` };
  }
}

// ---------------- Public API ----------------

export async function fetchDashboard(params: PeriodParams): Promise<ApiResponse<DashboardPayload>> {
  if (!IS_LIVE_MODE) return mockDashboard(params);
  // Live Dashboard собирается из 3 endpoint-ов: money + profit + capital.
  // api=dashboard в текущем Apps Script привязан к снимку капитала и не
  // соответствует выбранному периоду — поэтому здесь не используется.
  const [moneyR, profitR, capitalR] = await Promise.all([
    fetchMoney({ ...params } as MoneyParams),
    fetchProfit({ ...params } as ProfitParams),
    fetchCapital({ dateTo: params.dateTo }),
  ]);
  if (moneyR.status === "error" || !moneyR.data) {
    return { status: "error", data: null, error: `money: ${moneyR.error ?? "нет данных"}` };
  }
  if (profitR.status === "error" || !profitR.data) {
    return { status: "error", data: null, error: `profit: ${profitR.error ?? "нет данных"}` };
  }
  try {
    const data = composeDashboard(
      params,
      moneyR.data,
      profitR.data,
      capitalR.status === "success" ? capitalR.data : null,
      capitalR.status === "error" ? capitalR.error : null,
    );
    return { status: "success", data, error: null };
  } catch (e) {
    return { status: "error", data: null, error: `Ошибка сборки dashboard: ${(e as Error).message}` };
  }
}

export async function fetchMoney(params: MoneyParams): Promise<ApiResponse<MoneyPayload>> {
  if (!IS_LIVE_MODE) return mockMoney(params);
  const raw = await callApiRaw("money", {
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    account: params.account,
    counterparty: params.counterparty,
    article: params.article,
    direction: params.direction,
  });
  if (raw.status === "error" || !raw.data) return { status: "error", data: null, error: raw.error ?? "Нет данных" };
  try {
    return { status: "success", data: adaptMoney(raw.data, params), error: null };
  } catch (e) {
    return { status: "error", data: null, error: `Ошибка маппинга money: ${(e as Error).message}` };
  }
}

export async function fetchProfit(params: ProfitParams): Promise<ApiResponse<ProfitPayload>> {
  if (!IS_LIVE_MODE) return mockProfit(params);
  const raw = await callApiRaw("profit", {
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    project: params.project,
    direction: params.direction,
    article: params.article,
    section: params.section,
  });
  if (raw.status === "error" || !raw.data) return { status: "error", data: null, error: raw.error ?? "Нет данных" };
  try {
    return { status: "success", data: adaptProfit(raw.data, params), error: null };
  } catch (e) {
    return { status: "error", data: null, error: `Ошибка маппинга profit: ${(e as Error).message}` };
  }
}

export async function fetchCapital(params: CapitalParams): Promise<ApiResponse<CapitalPayload>> {
  if (!IS_LIVE_MODE) return mockCapital(params);
  const raw = await callApiRaw("capital", { dateTo: params.dateTo });
  if (raw.status === "error" || !raw.data) return { status: "error", data: null, error: raw.error ?? "Нет данных" };
  try {
    return { status: "success", data: adaptCapital(raw.data, params), error: null };
  } catch (e) {
    return { status: "error", data: null, error: `Ошибка маппинга capital: ${(e as Error).message}` };
  }
}

export const financeApi = {
  dashboard: fetchDashboard,
  money: fetchMoney,
  profit: fetchProfit,
  capital: fetchCapital,
};

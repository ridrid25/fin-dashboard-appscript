import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// Глобальный cache для live API. Apps Script медленный, поэтому держим
// данные «свежими» 5 минут и в памяти 30 минут — переходы между
// Дэшборд/Деньги/Прибыль/Капитал берут результат из кэша без повторных
// запросов. refetchOnWindowFocus отключён, чтобы не дёргать API при
// возврате во вкладку.
export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};

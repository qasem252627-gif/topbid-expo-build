import { trpc } from "@/lib/trpc";
import { DEFAULT_IQD_PER_USD } from "@/lib/currency";

export function useExchangeRate() {
  const query = trpc.settings.exchangeRate.useQuery(undefined, {
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });
  return query.data?.usdToIqd ?? DEFAULT_IQD_PER_USD;
}

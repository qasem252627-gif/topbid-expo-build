import { trpc } from "@/lib/trpc";
import { DEFAULT_DELIVERY_FEE } from "@/lib/delivery-fee";
import type { CurrencyCode } from "@/lib/currency";

export function useDeliveryFee(): { amount: number; currency: CurrencyCode } {
  const query = trpc.settings.deliveryFee.useQuery(undefined, {
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });
  if (!query.data) return DEFAULT_DELIVERY_FEE;
  return { amount: query.data.amount, currency: query.data.currency };
}

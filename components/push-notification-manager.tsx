import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export function PushNotificationManager() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === "web") return;
    const openAuctionFromResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const data = response.notification.request.content.data;
      if (data?.type === "return-request" || data?.type === "delivery-confirmed") {
        router.push("/admin-returns");
        void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
        return;
      }
      const rawId = data?.auctionId;
      const auctionId = typeof rawId === "number" ? rawId : Number(rawId);
      if (!Number.isSafeInteger(auctionId) || auctionId <= 0) return;
      router.push({ pathname: "/auction/[id]", params: { id: String(auctionId) } });
      void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(openAuctionFromResponse);
    void Notifications.getLastNotificationResponseAsync()
      .then(openAuctionFromResponse)
      .catch(() => undefined);
    return () => subscription.remove();
  }, [router]);

  return null;
}

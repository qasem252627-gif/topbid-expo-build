import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useState } from "react";
import { Linking, Platform } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

type RegistrationState = "checking" | "signed-out" | "unsupported" | "off" | "denied" | "enabled" | "error";

function getProjectId() {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

export function useBidNotificationRegistration() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const registerDevice = trpc.notifications.registerDevice.useMutation();
  const [state, setState] = useState<RegistrationState>(Platform.OS === "web" ? "unsupported" : "checking");
  const supported = Platform.OS === "android" || Platform.OS === "ios";

  const register = useCallback(async (askPermission: boolean) => {
    if (!supported) {
      setState("unsupported");
      return false;
    }
    if (!user) {
      setState("signed-out");
      return false;
    }

    setState("checking");
    try {
      if (Platform.OS === "android") {
        const channelName = language === "ar" ? "تنبيهات المزايدة" : language === "ku" ? "ئاگادارکردنەوەی مزایدە" : "Bid alerts";
        await Notifications.setNotificationChannelAsync("bids", {
          name: channelName,
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 150, 250],
          lightColor: "#0D7C72",
        });
      }

      let permission = await Notifications.getPermissionsAsync();
      if (permission.status !== "granted" && askPermission) {
        permission = await Notifications.requestPermissionsAsync();
      }
      if (permission.status !== "granted") {
        setState(askPermission ? "denied" : "off");
        return false;
      }

      const projectId = getProjectId();
      if (!projectId) throw new Error("EXPO_PROJECT_ID_MISSING");
      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      await registerDevice.mutateAsync({
        token: token.data,
        language,
        platform: Platform.OS as "android" | "ios",
      });
      setState("enabled");
      return true;
    } catch {
      setState("error");
      return false;
    }
  }, [language, registerDevice.mutateAsync, supported, user]);

  useEffect(() => {
    if (!supported || !user) {
      setState(supported ? "signed-out" : "unsupported");
      return;
    }
    void register(false);
  }, [register, supported, user]);

  return {
    state,
    supported,
    enable: () => register(true),
    openSettings: () => Linking.openSettings().catch(() => undefined),
  };
}

import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";
import { HapticTab } from "@/components/haptic-tab";
import { useLanguage } from "@/lib/i18n";
import { favoritesCopy } from "@/lib/favorites-copy";

const teal = "#0D7C72";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const bottomPadding = Platform.OS === "web" ? 9 : Math.max(insets.bottom, 8);
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: teal,
      tabBarInactiveTintColor: "#83908D",
      tabBarButton: HapticTab,
      tabBarLabelStyle: { fontSize: 10, fontWeight: "700", marginTop: 1 },
      tabBarStyle: { paddingTop: 7, paddingBottom: bottomPadding, height: 55 + bottomPadding, backgroundColor: "#FFFFFF", borderTopColor: "#E8E5DE", borderTopWidth: 1, elevation: 0 },
    }}>
      <Tabs.Screen name="index" options={{ title: t("home"), tabBarIcon: ({ color, size }) => <Ionicons name="compass-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="my-bids" options={{ title: t("myBids"), tabBarIcon: ({ color, size }) => <Ionicons name="hammer-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="favorites" options={{ title: favoritesCopy[language].tab, tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="account" options={{ title: t("account"), tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color} /> }} />
    </Tabs>
  );
}

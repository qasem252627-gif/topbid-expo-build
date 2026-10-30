// Load environment variables with proper priority (system > .env)
import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import firebaseWebConfig from "./firebase-web-config.json";

const hasAndroidFirebaseConfig = existsSync(resolve(process.cwd(), "google-services.json"));
const hasIosFirebaseConfig = existsSync(resolve(process.cwd(), "GoogleService-Info.plist"));
const hasFirebaseNativeConfig = hasAndroidFirebaseConfig || hasIosFirebaseConfig;

// Bundle ID format: space.manus.<project_name_dots>.<timestamp>
// e.g., "my-app" created at 2024-01-15 10:30:45 -> "space.manus.my.app.t20240115103045"
// Bundle ID can only contain letters, numbers, and dots
// Android requires each dot-separated segment to start with a letter
const rawBundleId = "space.manus.mizadna.t051769136935157";
const bundleId =
  rawBundleId
    .replace(/[-_]/g, ".") // Replace hyphens/underscores with dots
    .replace(/[^a-zA-Z0-9.]/g, "") // Remove invalid chars
    .replace(/\.+/g, ".") // Collapse consecutive dots
    .replace(/^\.+|\.+$/g, "") // Trim leading/trailing dots
    .toLowerCase()
    .split(".")
    .map((segment) => {
      // Android requires each segment to start with a letter
      // Prefix with 'x' if segment starts with a digit
      return /^[a-zA-Z]/.test(segment) ? segment : "x" + segment;
    })
    .join(".") || "space.manus.app";
// Extract timestamp from bundle ID and prefix with "manus" for deep link scheme
// e.g., "space.manus.my.app.t20240115103045" -> "manus20240115103045"
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `manus${timestamp}`;

const env = {
  // App branding - update these values directly (do not use env vars)
  appName: "TopBid",
  appSlug: "mizadna",
  // Durable public CDN URL for the TopBid project logo.
  scheme: schemeFromBundleId,
  iosBundleId: bundleId,
  androidPackage: bundleId,
};

// Expo serializes this browser-safe subset into native and web bundles. The server-only
// MANUS_API_KEY and MANUS_JWT_SECRET must never enter this object.
const publicRuntime = {
  oauthPortalUrl:
    process.env.MANUS_OAUTH_PORTAL_URL ??
    process.env.VITE_OAUTH_PORTAL_URL ??
    process.env.EXPO_PUBLIC_OAUTH_PORTAL_URL ??
    "",
  oauthServerUrl:
    process.env.MANUS_OAUTH_API_URL ??
    process.env.OAUTH_SERVER_URL ??
    process.env.EXPO_PUBLIC_OAUTH_SERVER_URL ??
    "",
  appId:
    process.env.MANUS_PROJECT_ID ??
    process.env.VITE_APP_ID ??
    process.env.EXPO_PUBLIC_APP_ID ??
    "",
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
  nativeApiBaseUrl: process.env.EXPO_PUBLIC_NATIVE_API_BASE_URL ?? "https://mizadna-8cfvnbti.manus.space",
  nativeStorageBaseUrl: process.env.EXPO_PUBLIC_NATIVE_STORAGE_BASE_URL ?? "https://8328-i1fbcnsaxbidpv1lp3ay6-eed90bb6.us3.manus.computer",
  firebaseWebConfig,
  firebaseNativeConfigured: {
    android: hasAndroidFirebaseConfig,
    ios: hasIosFirebaseConfig,
  },
  firebasePhoneAuthTestMode: process.env.EXPO_PUBLIC_FIREBASE_PHONE_AUTH_TEST_MODE === "true",
};

const config: ExpoConfig & { logoUrl: string } = {
  logoUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663994885172/rKpeRTRgflnrRTro.png",
  name: env.appName,
  slug: env.appSlug,
  owner: "qasem1",
  version: "1.0.0",
  extra: {
    ...publicRuntime,
    supportPhone: process.env.EXPO_PUBLIC_SUPPORT_PHONE ?? "",
    supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? "",
    eas: { projectId: "991a249a-a9fb-4a7b-8058-d0f21618c868" },
  },
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    ...(hasIosFirebaseConfig ? { googleServicesFile: "./GoogleService-Info.plist" } : {}),
    "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false
      }
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#F0F2F4",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    package: env.androidPackage,
    ...(hasAndroidFirebaseConfig ? { googleServicesFile: "./google-services.json" } : {}),
    permissions: ["POST_NOTIFICATIONS"],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: env.scheme,
            host: "*",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-asset",
    "expo-router",
    "expo-notifications",
    "@react-native-community/datetimepicker",
    [
      "expo-image-picker",
      {
        photosPermission: "Allow TopBid to access your photos so you can add a product image to an auction.",
        cameraPermission: false,
        microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone.",
      },
    ],
    [
      "expo-audio",
      {
        microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone.",
      },
    ],
    [
      "expo-video",
      {
        supportsBackgroundPlayback: true,
        supportsPictureInPicture: true,
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 250,
        resizeMode: "contain",
        backgroundColor: "#F0F2F4",
        dark: {
          backgroundColor: "#F0F2F4",
        },
      },
    ],
    [
    "expo-build-properties",
      {
        android: {
          buildArchs: ["armeabi-v7a", "arm64-v8a"],
          minSdkVersion: 24,
        },
      },
    ],
    ...(hasFirebaseNativeConfig ? ["@react-native-firebase/app", "@react-native-firebase/auth"] : []),
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;

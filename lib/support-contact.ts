import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;

export const supportContact = {
  phone: typeof extra?.supportPhone === "string" ? extra.supportPhone.trim() : "",
  email: typeof extra?.supportEmail === "string" ? extra.supportEmail.trim() : "",
};

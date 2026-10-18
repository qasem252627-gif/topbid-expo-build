export async function requestFirebaseSmsCode(_phone: string, _containerId?: string): Promise<void> {
  throw new Error("FIREBASE_AUTH_UNAVAILABLE");
}

export async function confirmFirebaseSmsCode(_code: string): Promise<string> {
  throw new Error("FIREBASE_AUTH_UNAVAILABLE");
}

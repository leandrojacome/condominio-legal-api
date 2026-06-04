let _app: import("firebase-admin/app").App | null = null;

function getApp(): import("firebase-admin/app").App | null {
  if (_app) return _app;
  const raw = process.env["FIREBASE_SERVICE_ACCOUNT"];
  if (!raw) return null;
  try {
    const { initializeApp, cert, getApps } = require("firebase-admin/app") as typeof import("firebase-admin/app");
    if (getApps().length > 0) {
      _app = getApps()[0]!;
      return _app;
    }
    const serviceAccount = JSON.parse(raw) as object;
    _app = initializeApp({ credential: cert(serviceAccount) });
    return _app;
  } catch {
    return null;
  }
}

export async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  const app = getApp();
  if (!app) {
    console.log("[fcm] not configured — would send:", { token, title, body });
    return false;
  }
  try {
    const { getMessaging } = require("firebase-admin/messaging") as typeof import("firebase-admin/messaging");
    await getMessaging(app).send({
      token,
      notification: { title, body },
      ...(data !== undefined && { data }),
    });
    return true;
  } catch (err) {
    console.error("[fcm] send failed:", err);
    return false;
  }
}

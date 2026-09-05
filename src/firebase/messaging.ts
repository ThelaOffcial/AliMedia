import { getMessaging, getToken, deleteToken, onMessage, isSupported, type Messaging } from 'firebase/messaging';
import { ref, set, remove, get } from 'firebase/database';
import { db } from './config';
import app from './config';
import { SW_PATH } from '../pwa';

// Generate this in Firebase Console → Project settings (gear icon) → Cloud Messaging tab
// → "Web configuration" → "Web Push certificates" → Generate key pair.
// This is a public key (safe to ship in client code) — it is NOT the same as your apiKey.
const VAPID_KEY = 'REPLACE_WITH_YOUR_FCM_VAPID_KEY';

let messagingInstance: Messaging | null = null;
let supportChecked = false;
let supported = false;

async function getMessagingIfSupported(): Promise<Messaging | null> {
  if (!supportChecked) {
    supportChecked = true;
    try {
      supported = await isSupported();
    } catch {
      supported = false;
    }
  }
  if (!supported) return null;
  if (!messagingInstance) {
    messagingInstance = getMessaging(app);
  }
  return messagingInstance;
}

export type PushPermissionState = 'unsupported' | 'default' | 'granted' | 'denied';

/** Cheap synchronous check for the current permission — used to set initial UI state. */
export function getPushPermissionState(): PushPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return 'unsupported';
  }
  return Notification.permission as PushPermissionState;
}

/** RTDB keys can't contain . # $ [ ] / — FCM tokens can, so sanitize before using as a key. */
function tokenKey(token: string): string {
  return token.replace(/[.#$/[\]]/g, '_');
}

/**
 * Requests notification permission (if needed), registers the background service worker,
 * obtains an FCM token, and saves it to users/{uid}/fcmTokens/{token}. The sendPushOnNotification
 * Cloud Function (see /functions/index.js) reads tokens from that path to deliver pushes.
 */
export async function enablePushNotifications(uid: string): Promise<{ ok: boolean; error?: string }> {
  if (!uid) return { ok: false, error: 'not-signed-in' };
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return { ok: false, error: 'unsupported' };
  }

  const messaging = await getMessagingIfSupported();
  if (!messaging) return { ok: false, error: 'unsupported' };

  if (VAPID_KEY === 'REPLACE_WITH_YOUR_FCM_VAPID_KEY') {
    console.warn('[PUSH] No VAPID key set. Add one in src/firebase/messaging.ts (see comment above VAPID_KEY).');
    return { ok: false, error: 'no-vapid-key' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, error: 'denied' };
    }

    const registration = await navigator.serviceWorker.register(SW_PATH);
    await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) return { ok: false, error: 'no-token' };

    await set(ref(db, `users/${uid}/fcmTokens/${tokenKey(token)}`), {
      token,
      userAgent: (navigator.userAgent || '').slice(0, 200),
      updatedAt: Date.now(),
    });

    return { ok: true };
  } catch (e: any) {
    console.warn('[PUSH] enablePushNotifications failed:', e?.code || e);
    return { ok: false, error: e?.code || 'unknown' };
  }
}

/** Removes this device's token so it stops receiving pushes (e.g. user toggles the setting off). */
export async function disablePushNotifications(uid: string): Promise<void> {
  if (!uid || typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const messaging = await getMessagingIfSupported();
    const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
    if (messaging && registration) {
      const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration }).catch(
        () => null
      );
      if (token) {
        await remove(ref(db, `users/${uid}/fcmTokens/${tokenKey(token)}`));
      }
      await deleteToken(messaging).catch(() => {});
    }
  } catch (e) {
    console.warn('[PUSH] disablePushNotifications failed:', e);
  }
}

/** Whether this uid already has at least one saved token — used to reflect toggle state on screen load. */
export async function hasPushTokenSaved(uid: string): Promise<boolean> {
  if (!uid) return false;
  try {
    const snap = await get(ref(db, `users/${uid}/fcmTokens`));
    return snap.exists();
  } catch {
    return false;
  }
}

/**
 * Foreground messages: fires while an AliMedia tab is open and focused.
 * (Closed/backgrounded tabs are handled by the service worker's onBackgroundMessage instead.)
 * Returns an unsubscribe function.
 */
export async function subscribeToForegroundPush(
  onMessageReceived: (title: string, body: string) => void
): Promise<() => void> {
  const messaging = await getMessagingIfSupported();
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    const title = payload.notification?.title || payload.data?.title || 'AliMedia';
    const body = payload.notification?.body || payload.data?.body || '';
    onMessageReceived(title, body);
  });
}

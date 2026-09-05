export const SW_PATH = '/sw.js';

/**
 * Registers the service worker (Workbox precaching + FCM background push, see
 * src/sw.ts) as soon as the app loads. This runs unconditionally so
 * install-to-home-screen and offline app-shell caching work for every visitor,
 * not just those who opt into push notifications (src/firebase/messaging.ts
 * reuses this same registration when the user enables push).
 */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(SW_PATH).catch((err) => {
      console.warn('[PWA] Service worker registration failed:', err);
    });
  });
}

/// <reference lib="webworker" />
// Single service worker for the whole app. It's built by vite-plugin-pwa
// (strategies: 'injectManifest') into dist/sw.js and registered from
// src/pwa.ts. Combines two jobs that both need to own the root scope,
// so they live in one file instead of two competing service workers:
//   1. Workbox precaching of the built app shell -> install-to-home-screen
//      + "last loaded state" when offline.
//   2. Firebase Cloud Messaging background push handling (see also
//      src/firebase/messaging.ts, which registers this file and requests
//      the token; functions/index.js sends the actual pushes).

import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

declare let self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

// Injected at build time with the hashed list of built assets to precache.
precacheAndRoute(self.__WB_MANIFEST);

// Offline / app-shell fallback: any navigation (e.g. opening the app with no
// network) is served the cached index.html. The app itself already caches
// elephants/posts data to localStorage on top of this, so the shell loads
// and shows the last-synced content instead of a browser error page.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

// --- FCM background push (fires when no AliMedia tab is open/focused) ---

const firebaseConfig = {
  projectId: 'aliapp-e5196',
  appId: '1:879533198243:web:4aeee96c749639626e6816',
  apiKey: 'AIzaSyB4yIRYiqFCcJSZCw8yK3DXY3flLyTqP9k',
  authDomain: 'aliapp-e5196.firebaseapp.com',
  databaseURL: 'https://aliapp-e5196-default-rtdb.firebaseio.com',
  storageBucket: 'aliapp-e5196.firebasestorage.app',
  messagingSenderId: '879533198243',
};

const firebaseApp = initializeApp(firebaseConfig);
const messaging = getMessaging(firebaseApp);

onBackgroundMessage(messaging, (payload) => {
  const title = payload.notification?.title || payload.data?.title || 'AliMedia';
  const body = payload.notification?.body || payload.data?.body || '';
  const url = payload.data?.url || '/';

  self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url },
    tag: payload.data?.tag,
  });
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          (client as WindowClient).navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});

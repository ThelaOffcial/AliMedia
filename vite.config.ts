import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // We ship our own service worker (src/sw.ts) so it can also handle
        // FCM background push (see src/firebase/messaging.ts) alongside
        // Workbox precaching -- injectManifest lets Workbox inject the
        // precache list into that file instead of generating a separate one.
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        injectRegister: false, // registered manually in src/pwa.ts
        injectManifest: {
          swSrc: 'src/sw.ts',
          swDest: 'dist/sw.js',
        },
        manifest: {
          name: 'AliMedia -- Sri Lankan Elephant Registry',
          short_name: 'AliMedia',
          description:
            "Verified discovery platform and cultural registry for Sri Lanka's domesticated elephants and ceremonial tuskers.",
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#FAF9F5',
          theme_color: '#062E22',
          icons: [
            {src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any'},
            {src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any'},
            {src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'},
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify: file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

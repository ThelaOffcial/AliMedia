import React, { useEffect, useState } from 'react';

type Props = {
  language?: 'en' | 'si';
};

/**
 * Lightweight online/offline banner. Uses navigator.onLine + online/offline
 * events so users on flaky connections know content may be cached/stale.
 */
export function OfflineBanner({ language = 'en' }: Props) {
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    // Sync in case the initial value was wrong (e.g. SSR-ish edge cases)
    setOffline(!navigator.onLine);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline) return null;

  const si = language === 'si';
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 z-40 max-w-[min(92vw,28rem)] px-4 py-2 rounded-full shadow-lg border border-amber-300/60 bg-amber-50 text-amber-950 dark:bg-amber-950/90 dark:text-amber-100 dark:border-amber-700/50 text-xs font-semibold flex items-center gap-2"
    >
      <span
        className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse"
        aria-hidden="true"
      />
      <span>
        {si
          ? 'ඔබ offline — සුරකින ලද අන්තර්ගතය පෙන්වයි'
          : "You're offline — showing saved content"}
      </span>
    </div>
  );
}

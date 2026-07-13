import { Workbox } from 'workbox-window';

export type PwaUpdatePrompt = { reload: () => void };

/**
 * Registers `/sw.js` and invokes `onUpdateAvailable` when a new service worker is waiting.
 * Call only from the browser in production (not localhost).
 */
export function registerServiceWorker(
  onUpdateAvailable: (prompt: PwaUpdatePrompt) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  if (!('serviceWorker' in navigator)) {
    return () => {};
  }

  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return () => {};
  }

  if (process.env.NODE_ENV !== 'production') {
    return () => {};
  }

  const wb = new Workbox('/sw.js');

  const onWaiting = (): void => {
    onUpdateAvailable({
      reload: () => {
        const onControlling = (): void => {
          wb.removeEventListener('controlling', onControlling);
          window.location.reload();
        };
        wb.addEventListener('controlling', onControlling);
        void wb.messageSkipWaiting();
      },
    });
  };

  wb.addEventListener('waiting', onWaiting);

  void wb.register().catch((error: unknown) => {
    console.warn('Service worker registration failed', error);
  });

  return () => {
    wb.removeEventListener('waiting', onWaiting);
  };
}

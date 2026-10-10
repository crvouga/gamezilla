// @io-wall-ok — service-worker registration is a browser-only entry adapter.
import { Workbox } from 'workbox-window';

export type PwaUpdatePrompt = { readonly reload: () => void };

export type RegisterServiceWorkerArgs = {
  readonly onUpdateAvailable: (prompt: PwaUpdatePrompt) => void;
  readonly onRegisterError: (error: unknown) => void;
  readonly networkAllowed?: (() => boolean) | undefined;
};

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

/**
 * Registers `/sw.js` and invokes `onUpdateAvailable` when a new service worker
 * is waiting. Only active in production browser bundles (not localhost).
 */
export function registerServiceWorker(
  args: RegisterServiceWorkerArgs
): () => void {
  const noop = (): void => undefined;
  if (typeof window === 'undefined') return noop;
  if (!('serviceWorker' in navigator)) return noop;
  if (isLocalHostname(window.location.hostname)) return noop;
  if (!import.meta.env.PROD) return noop;

  const wb = new Workbox('/sw.js');
  const onWaiting = (): void => {
    args.onUpdateAvailable({
      reload: () => {
        const onControlling = (): void => {
          wb.removeEventListener('controlling', onControlling);
          window.location.reload();
        };
        wb.addEventListener('controlling', onControlling);
        wb.messageSkipWaiting();
      },
    });
  };
  wb.addEventListener('waiting', onWaiting);
  void wb
    .register()
    .then(async (registration) => {
      if (args.networkAllowed?.() === false) await registration?.unregister();
    })
    .catch(args.onRegisterError);
  return () => {
    wb.removeEventListener('waiting', onWaiting);
  };
}

/** Remove the app's update registration while its network gate is closed. */
export async function unregisterServiceWorker(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  await registration?.unregister();
}

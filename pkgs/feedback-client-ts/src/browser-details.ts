import type { DiagnosticProvider } from '@pkgs/feedback-shared-ts/types';

/**
 * The device and the version of the app, as every bug report names them.
 * Read at the moment of reporting, so they describe the app the bug was in.
 */
export function browserDetails(
  window: Window,
  build: string
): DiagnosticProvider[] {
  return [
    {
      name: 'device',
      collect: () => ({
        agent: window.navigator.userAgent,
        width: window.innerWidth,
        height: window.innerHeight,
        pixelRatio: window.devicePixelRatio,
        language: window.navigator.language,
        online: window.navigator.onLine,
        installed: window.matchMedia('(display-mode: standalone)').matches,
      }),
    },
    {
      name: 'app',
      collect: () => ({
        version: build,
        path: window.location.pathname,
        theme: window.document.documentElement.dataset['theme'] ?? null,
      }),
    },
  ];
}

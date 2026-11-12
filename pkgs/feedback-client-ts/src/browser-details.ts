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
        languages: window.navigator.languages,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        touch: window.navigator.maxTouchPoints > 0,
        online: window.navigator.onLine,
        installed: window.matchMedia('(display-mode: standalone)').matches,
      }),
    },
    {
      name: 'app',
      collect: () => ({
        version: build,
        // Which deployment, and only the path: a ? or # can carry sign-in secrets.
        origin: window.location.origin,
        path: window.location.pathname,
        theme: window.document.documentElement.dataset['theme'] ?? null,
      }),
    },
  ];
}

// @io-wall-ok — standalone browser adapter

import { wallClock, wallTimers } from '@pkgs/clock-shared-ts/wall';
import { createCacheApiObjectStore } from '@pkgs/object-store-opfs-shared-ts/impl-cache-api';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import '@pkgs/tailwind-shared-ts/tailwind.css';
import '@pkgs/ui-root-client-ts/tokens.css';
import '@pkgs/ui-root-client-ts/hosts.css';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import { browserDetails } from './browser-details';
import type { ThemePort } from './bug-report-surface';
import { mountBugReports } from './mount-bug-reports';
import type { ConnectionPort, MotionPort } from './ports';
import { browserScreenshotPort } from './wall-screenshot';

/** Long enough after starting that it never competes with the app for the connection. */
const PREPARE_AFTER_MS = 8000;

type PermissionedMotion = {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

function browserMotion(): MotionPort {
  const motion = (globalThis as { DeviceMotionEvent?: PermissionedMotion })
    .DeviceMotionEvent;
  const ask = motion?.requestPermission?.bind(motion);
  return {
    // A pointer that is a finger: a desktop reports motion support it does not have.
    available: motion !== undefined && matchMedia('(pointer: coarse)').matches,
    needsPermission: ask !== undefined,
    requestPermission: async () =>
      ask === undefined || (await ask()) === 'granted',
    subscribe(listener) {
      const onMotion = (event: DeviceMotionEvent) => {
        const moved = event.accelerationIncludingGravity;
        if (moved?.x == null || moved.y == null || moved.z == null) return;
        listener({ x: moved.x, y: moved.y, z: moved.z });
      };
      addEventListener('devicemotion', onMotion);
      return () => removeEventListener('devicemotion', onMotion);
    },
  };
}

const browserConnection: ConnectionPort = {
  online: () => navigator.onLine,
  subscribe(listener) {
    addEventListener('online', listener);
    addEventListener('offline', listener);
    return () => {
      removeEventListener('online', listener);
      removeEventListener('offline', listener);
    };
  },
};

const browserTheme: ThemePort = {
  read: () =>
    document.documentElement.dataset['theme'] === 'light' ? 'light' : 'dark',
  subscribe(listener) {
    const observer = new MutationObserver(listener);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  },
};

/**
 * Starts bug reporting in a browser, then the app. Bug reporting comes
 * first and stands apart, so an app that fails to start can be reported.
 */
export function bootBrowserBugReports(options: {
  readonly endpoint: string;
  /** The version of the app a bug report names. */
  readonly build?: string;
  readonly startApplication: () => Promise<unknown>;
  readonly applicationErrorEvent?: string;
  readonly http?: HttpClient;
}) {
  const host = document.createElement('aside');
  host.setAttribute('data-component', 'BugReportHost');
  document.body.append(host);
  const screenshot = browserScreenshotPort(document);
  const bugReports = mountBugReports({
    window,
    document,
    host,
    endpoint: options.endpoint,
    http: options.http ?? { fetch: globalThis.fetch.bind(globalThis) },
    // Private browsing may offer no storage: a bug can still be reported, just not kept.
    store:
      'caches' in globalThis
        ? createCacheApiObjectStore({
            baseDir: 'bug-reports',
            caches: globalThis.caches,
          })
        : new ObjectStoreImplInMemory(),
    clock: wallClock,
    timers: wallTimers,
    createId: () => crypto.randomUUID(),
    screenshot,
    connection: browserConnection,
    motion: browserMotion(),
    theme: browserTheme,
    providers: browserDetails(window, options.build ?? 'unknown'),
    ...(options.applicationErrorEvent
      ? { applicationErrorEvent: options.applicationErrorEvent }
      : {}),
  });
  wallTimers.setTimeout(screenshot.prepare, PREPARE_AFTER_MS);
  const failed = (error: unknown): void => {
    window.dispatchEvent(new ErrorEvent('error', { error }));
  };
  try {
    void options.startApplication().catch(failed);
  } catch (error) {
    failed(error);
  }
  return bugReports;
}

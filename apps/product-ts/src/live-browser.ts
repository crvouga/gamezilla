import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
// @io-wall-ok — live health: a real browser drives the deployed web client.
/**
 * A real Chrome browser (`Bun.WebView`) against
 * a deployed web client and API — the same bundle, CDN, Worker and database
 * a person hits. One fresh device per scenario: its own storage, nothing
 * carried over.
 */

import { join } from 'node:path';
import type { JourneyBrowser } from '@libs/runtime-harness-ts/journey-types';
import { wallClock, wallTimers } from '@pkgs/clock-shared-ts/wall';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server-ts/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server-ts/wall-node-fs';
import { writeUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import { BunWebviewDriver } from '@pkgs/ui-testing-bun-webview-shared-ts/bun-webview-driver';
import {
  browserNetworkEvidence,
  nativeHealthEvidence,
} from './browser-network-evidence';

const NAVIGATION_POLL_MS = 250;
/** Phone-sized: the layout most people use. */
const VIEWPORT = { width: 390, height: 844 } as const;
const CHROME_BACKEND = { type: 'chrome', url: false } as const;
/** Uploaded by the Health and Release workflows when a journey fails. */
export const EVIDENCE_DIR =
  process.env['CRITICAL_JOURNEY_EVIDENCE_DIR'] ??
  join(import.meta.dir, '../.cache/critical-journeys');

export type LiveTarget = {
  readonly webOrigin: string;
  readonly apiOrigin: string;
  /** The OAuth callback relay's origin (`authRelayOrigin`). */
  readonly oauthCallbackOrigin: string;
  readonly http: HttpClient;
};

export type Device = {
  readonly apiOrigin: string;
  readonly view: Pick<Bun.WebView, 'navigate' | 'evaluate' | 'cdp'> & {
    screenshot(options: { encoding: 'buffer' }): Promise<Buffer>;
  };
  readonly driver: Driver;
  readonly console: string[];
  readonly network: string[];
  close(): Promise<void>;
};

function formatConsoleArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

/** A fresh device (not yet on the site): its own storage, console captured. */
export async function openDevice(
  target: Pick<LiveTarget, 'webOrigin' | 'apiOrigin'>,
  createView: (options: Bun.WebView.ConstructorOptions) => Bun.WebView = (
    options
  ) => new Bun.WebView(options)
): Promise<Device> {
  // Chrome shares its first profile for the whole process. Bun owns that
  // profile's lifetime; closing one device must not remove it under later views.
  const dataStore = 'ephemeral' as const;
  const consoleLines: string[] = [];
  const view = createView({
    ...VIEWPORT,
    backend: CHROME_BACKEND,
    dataStore,
    console: (type, ...args) => {
      consoleLines.push(`[${type}] ${args.map(formatConsoleArg).join(' ')}`);
    },
  });
  // Chrome keeps one profile per process (the first view's directory), so
  // wipe both origins: every scenario starts as a device that never visited.
  await view.navigate('about:blank');
  // Chrome associates socket throttling with the session when a socket opens.
  // Enable it before the app creates rooms, not only when going offline.
  await view.cdp('Network.enable');
  const network = browserNetworkEvidence(view);
  for (const origin of [target.webOrigin, target.apiOrigin]) {
    await view.cdp('Storage.clearDataForOrigin', {
      origin,
      storageTypes: 'all',
    });
  }
  const driver = new BunWebviewDriver({
    view,
    baseUrl: target.webOrigin,
    popupOptions: { dataStore, backend: CHROME_BACKEND },
    timers: wallTimers,
  });
  return {
    apiOrigin: target.apiOrigin,
    view,
    driver,
    console: consoleLines,
    network,
    close: () => driver.close(),
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    wallTimers.setTimeout(resolve, ms);
  });
}

export async function readLocation(
  view: Pick<Bun.WebView, 'evaluate'>
): Promise<string> {
  const href = await view.evaluate('location.href');
  return typeof href === 'string' ? href : '';
}

/** Wait for precache installation before the device loses its connection. */
const SHELL_STATE_SCRIPT = `(function () {
  var sw = navigator.serviceWorker;
  if (!sw) throw new Error('the browser has no service worker support');
  return sw.ready.then(function (reg) {
    if (!reg.active) throw new Error('the offline shell has no active worker');
    return 'active';
  });
})()`;

export async function waitForCachedShell(
  view: Pick<Bun.WebView, 'evaluate'>
): Promise<void> {
  const state = await view.evaluate(SHELL_STATE_SCRIPT);
  if (state !== 'active') throw new Error('the offline shell is not ready');
}

/**
 * The device has no network. Chrome exposes this through CDP
 * (`Network.emulateNetworkConditions`); other engines have no equivalent.
 */
export async function emulateOffline(
  view: Pick<Bun.WebView, 'evaluate' | 'cdp'>
): Promise<void> {
  await waitForCachedShell(view);
  await view.cdp('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });
}

export function journeyBrowser(
  device: Device,
  target: LiveTarget
): JourneyBrowser {
  return {
    oauthCallbackOrigin: target.oauthCallbackOrigin,
    waitForNavigation: async (match, timeoutMs) => {
      const deadline = wallClock.now() + timeoutMs;
      let lastUrl = '';
      for (;;) {
        try {
          lastUrl = await readLocation(device.view);
          if (match(lastUrl)) return lastUrl;
        } catch {
          // A document replacement can briefly make evaluation unavailable.
        }
        if (wallClock.now() >= deadline) {
          throw new Error(
            `no matching navigation within ${String(timeoutMs)}ms (current URL: ${lastUrl})`
          );
        }
        await delay(NAVIGATION_POLL_MS);
      }
    },
  };
}

async function pageUrl(device: Device): Promise<string> {
  try {
    return String(await device.view.evaluate('location.href'));
  } catch {
    return '(unknown)';
  }
}

/** Screenshot, HTML, URL and console of the failed page under `EVIDENCE_DIR/<id>/`. */
export async function saveEvidence(
  id: string,
  device: Device,
  error: unknown,
  http: HttpClient
): Promise<string> {
  const store = createNodeFsObjectStore({
    rootDir: EVIDENCE_DIR,
    fs: wallNodeFs(),
    layout: 'tree',
  });
  const key = (name: string): string => `${id}/${name}`;
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  const summary = `scenario: ${id}\nurl: ${await pageUrl(device)}\n\n${message}\n`;
  await writeUtf8(store, key('error.txt'), summary);
  await writeUtf8(
    store,
    key('native-health.json'),
    await nativeHealthEvidence(
      http,
      `${device.apiOrigin}/api/health`,
      wallTimers
    )
  );
  try {
    const connection = await device.view.evaluate(`(async () => {
      const state = {
        online: navigator.onLine,
        offlinePreference: localStorage.getItem('app.prefs/work-offline'),
        requests: performance.getEntriesByType('resource').map(entry => ({
          url: new URL(entry.name).origin + new URL(entry.name).pathname,
          status: entry.responseStatus,
          duration: entry.duration
        }))
      };
      try {
        const response = await fetch(${JSON.stringify(`${device.apiOrigin}/api/health`)}, {
          signal: AbortSignal.timeout(5000)
        });
        state.health = { status: response.status, body: await response.text() };
      } catch (error) {
        state.health = { error: String(error) };
      }
      return JSON.stringify(state);
    })()`);
    await writeUtf8(store, key('connection.json'), String(connection));
  } catch {
    // A crashed document cannot report its connection state.
  }
  await writeUtf8(store, key('console.log'), `${device.console.join('\n')}\n`);
  await writeUtf8(store, key('network.log'), `${device.network.join('\n')}\n`);
  try {
    const png = await device.view.screenshot({ encoding: 'buffer' });
    await store.put(key('screenshot.png'), new Uint8Array(png), 'image/png');
  } catch {
    // A crashed page cannot be captured; the HTML and console still help.
  }
  try {
    const html = await device.driver.snapshotHtml();
    if (html !== null) {
      await writeUtf8(
        store,
        key('page.html'),
        html,
        'text/html; charset=utf-8'
      );
    }
  } catch {
    // As above.
  }
  return join(EVIDENCE_DIR, id);
}

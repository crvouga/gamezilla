// @io-wall-ok — live health: a real browser drives the deployed web client.
/**
 * A real Chrome browser (`Bun.WebView`) against
 * a deployed web client and API — the same bundle, CDN, Worker and database
 * a person hits. One fresh device per scenario: its own storage, nothing
 * carried over.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { JourneyBrowser } from '@libs/runtime/harness/critical-journeys';
import { wallClock, wallTimers } from '@pkgs/clock';
import type { HttpClient } from '@pkgs/http-client';
import { writeUtf8 } from '@pkgs/object-store/helpers';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs/wall-node-fs';
import { BunWebviewDriver } from '@pkgs/ui-testing-bun-webview';

const NAVIGATION_POLL_MS = 250;
/** Phone-sized: the layout most people use. */
const VIEWPORT = { width: 390, height: 844 } as const;
/** Uploaded by the Health and Deploy workflows when a journey fails. */
export const EVIDENCE_DIR = join(
  import.meta.dir,
  '../../.cache/critical-journeys'
);

export type LiveTarget = {
  readonly webOrigin: string;
  readonly apiOrigin: string;
  /** The OAuth callback relay's origin (`authRelayOrigin`). */
  readonly oauthCallbackOrigin: string;
  readonly http: HttpClient;
};

export type Device = {
  readonly view: Bun.WebView;
  readonly driver: BunWebviewDriver;
  readonly console: string[];
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
  const directory = await mkdtemp(join(tmpdir(), 'critical-journey-'));
  const dataStore = { directory };
  const consoleLines: string[] = [];
  const view = createView({
    ...VIEWPORT,
    backend: 'chrome',
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
  for (const origin of [target.webOrigin, target.apiOrigin]) {
    await view.cdp('Storage.clearDataForOrigin', {
      origin,
      storageTypes: 'all',
    });
  }
  const driver = new BunWebviewDriver({
    view,
    baseUrl: target.webOrigin,
    popupOptions: { dataStore, backend: 'chrome' },
    timers: wallTimers,
  });
  return {
    view,
    driver,
    console: consoleLines,
    close: async () => {
      await driver.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    wallTimers.setTimeout(resolve, ms);
  });
}

export async function readLocation(view: Bun.WebView): Promise<string> {
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

export async function waitForCachedShell(view: Bun.WebView): Promise<void> {
  const state = await view.evaluate(SHELL_STATE_SCRIPT);
  if (state !== 'active') throw new Error('the offline shell is not ready');
}

/**
 * The device has no network. Chrome exposes this through CDP
 * (`Network.emulateNetworkConditions`); other engines have no equivalent.
 */
export async function emulateOffline(view: Bun.WebView): Promise<void> {
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
  error: unknown
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
  await writeUtf8(store, key('console.log'), `${device.console.join('\n')}\n`);
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

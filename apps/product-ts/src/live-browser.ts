import { createBrowserNavigation } from '@libs/harness-ts/browser-navigation';
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
import { createIsolatedProcess } from '@pkgs/os-server-ts/wall-isolated-process';
import type { IsolatedWorker } from '@pkgs/os-server-ts/wall-isolated-worker';
import type { Screencast } from '@pkgs/ui-testing-bun-webview-server-ts/chrome-screencast';
import { connectIsolatedBrowser } from '@pkgs/ui-testing-bun-webview-server-ts/wall-io';
import { nativeHealthEvidence } from './browser-network-evidence';

/** Uploaded by the Health and Release workflows when a journey fails. */
export const EVIDENCE_DIR =
  process.env['CRITICAL_JOURNEY_EVIDENCE_DIR'] ??
  join(import.meta.dir, '../.cache/critical-journeys');

export type LiveTarget = {
  readonly googleAuthorizationOrigin: string;
  readonly webOrigin: string;
  readonly apiOrigin: string;
  /** The OAuth callback relay's origin (`authRelayOrigin`). */
  readonly oauthCallbackOrigin: string;
  readonly http: HttpClient;
};

export type Device = {
  readonly screencast: Screencast;
  readonly apiOrigin: string;
  readonly view: Pick<Bun.WebView, 'navigate' | 'evaluate' | 'cdp'> & {
    screenshot(options: { encoding: 'buffer' }): Promise<Buffer>;
  };
  readonly driver: Driver;
  readonly console: string[];
  readonly network: string[];
  close(): Promise<void>;
};

/** Each fresh device owns a Chrome process and its profile until close. */
export async function openDevice(
  target: Pick<LiveTarget, 'webOrigin' | 'apiOrigin'>,
  spawn: () => IsolatedWorker = () =>
    createIsolatedProcess(
      new URL('./isolated-browser-entry.ts', import.meta.url)
    )
): Promise<Device> {
  const browser = await connectIsolatedBrowser(
    { webOrigin: target.webOrigin, apiOrigin: target.apiOrigin },
    spawn()
  );
  return { ...browser, apiOrigin: target.apiOrigin };
}

export async function readLocation(
  view: Pick<Bun.WebView, 'evaluate'>
): Promise<string> {
  const href = await view.evaluate('location.href');
  return typeof href === 'string' ? href : '';
}

/**
 * The device has no network. Chrome exposes this through CDP
 * (`Network.emulateNetworkConditions`); other engines have no equivalent.
 */
export async function emulateOffline(
  view: Pick<Bun.WebView, 'evaluate' | 'cdp'>
): Promise<void> {
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
    googleAuthorizationOrigin: target.googleAuthorizationOrigin,
    oauthCallbackOrigin: target.oauthCallbackOrigin,
    ...createBrowserNavigation({
      readUrl: () => readLocation(device.view),
      clock: wallClock,
      timers: wallTimers,
    }),
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

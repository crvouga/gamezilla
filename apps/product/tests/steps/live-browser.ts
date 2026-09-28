// @io-wall-ok — live health: a real browser drives the deployed web client.
/**
 * A real browser (`Bun.WebView`: WebKit on macOS, Chrome elsewhere) against
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
import { resolveE2eBrowser } from '@pkgs/ui-testing-bun-webview/e2e-browser';

const POPUP_POLL_MS = 250;
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
export async function openDevice(target: LiveTarget): Promise<Device> {
  const directory = await mkdtemp(join(tmpdir(), 'critical-journey-'));
  const dataStore = { directory };
  const consoleLines: string[] = [];
  const view = new Bun.WebView({
    ...VIEWPORT,
    dataStore,
    console: (type, ...args) => {
      consoleLines.push(`[${type}] ${args.map(formatConsoleArg).join(' ')}`);
    },
  });
  // Chrome keeps one profile per process (the first view's directory), so
  // wipe both origins: every scenario starts as a device that never visited.
  if (resolveE2eBrowser().engine === 'chrome') {
    await view.navigate('about:blank');
    for (const origin of [target.webOrigin, target.apiOrigin]) {
      await view.cdp('Storage.clearDataForOrigin', {
        origin,
        storageTypes: 'all',
      });
    }
  }
  const driver = new BunWebviewDriver({
    view,
    baseUrl: target.webOrigin,
    popupOptions: { dataStore },
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

async function popupUrls(view: Bun.WebView): Promise<string[]> {
  const raw = await view.evaluate(
    'JSON.stringify((window.__bunWebviewPopups || { open: [] }).open.map(function (e) { return e.url; }))'
  );
  return typeof raw === 'string' ? (JSON.parse(raw) as string[]) : [];
}

export function journeyBrowser(
  device: Device,
  target: LiveTarget
): JourneyBrowser {
  return {
    apiOrigin: target.apiOrigin,
    http: target.http,
    waitForPopup: async (match, timeoutMs) => {
      const deadline = wallClock.now() + timeoutMs;
      for (;;) {
        const urls = await popupUrls(device.view);
        const found = urls.find(match);
        if (found !== undefined) return found;
        if (wallClock.now() >= deadline) {
          throw new Error(
            `no matching popup within ${String(timeoutMs)}ms (opened: ${urls.join(', ') || 'none'})`
          );
        }
        await delay(POPUP_POLL_MS);
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

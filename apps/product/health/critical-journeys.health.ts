// @io-wall-ok — live health probe: a real browser drives the production web client.
/**
 * Synthetic monitoring. Every critical journey
 * (`@libs/runtime/sim/critical-journeys`) runs here in a real browser
 * (`Bun.WebView`: WebKit on macOS, Chrome elsewhere) against the production
 * web client and API — the same bundle, CDN, Worker and database a person
 * hits. The same journeys run in `bun check` against the sim, so a failure
 * here is the deployment, not the test.
 *
 * - One fresh device per journey: its own storage, nothing carried over.
 * - Signed-in journeys sign in as the synthetic-monitor user: the runner
 *   trades `SYNTHETIC_MONITOR_TOKEN` for a one-time `/sso-callback?code=`
 *   URL and the browser finishes the real sign-in path from there.
 * - A failure saves a screenshot, the page HTML, the page URL and the
 *   browser console under `apps/product/.cache/critical-journeys/<journey>/`
 *   (uploaded by the Health workflow).
 *
 * Runs last in every deploy and on the Health workflow's schedule.
 */

import { describe, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { envOrigins, isProductionEnv } from '@libs/infra/public/env-file';
import { envFile } from '@libs/infra/public/envs';
import {
  CRITICAL_JOURNEYS,
  type CriticalJourney,
  confirmSignedIn,
  type JourneyBrowser,
} from '@libs/runtime/sim/critical-journeys';
import { requestSyntheticMonitorRedirect } from '@pkgs/auth-inhouse/shared';
import { wallClock, wallTimers } from '@pkgs/clock';
import { createGlobalHttpClient, type HttpClient } from '@pkgs/http-client';
import { writeUtf8 } from '@pkgs/object-store/helpers';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs/wall-node-fs';
import { BunWebviewDriver } from '@pkgs/ui-testing-bun-webview';
import { resolveE2eBrowser } from '@pkgs/ui-testing-bun-webview/e2e-browser';

/** A journey is a handful of 20 s steps plus sign-in, on real latency. */
const JOURNEY_TIMEOUT_MS = 180_000;
const POPUP_POLL_MS = 250;
const API_PATH_PREFIX = '/api';
/** Phone-sized: the layout most people use. */
const VIEWPORT = { width: 390, height: 844 } as const;
const ARTIFACT_DIR = join(import.meta.dir, '../.cache/critical-journeys');
/** Seeds what journeys write this run (avatar seed, search query). */
const RUN_ID = wallClock.now().toString(36);

type Target = {
  readonly webOrigin: string;
  readonly apiOrigin: string;
  readonly http: HttpClient;
};

type Device = {
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
async function openDevice(target: Target): Promise<Device> {
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
  // wipe both origins: every journey starts as a device that never visited.
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

/** Sign in as the synthetic-monitor user through the real callback path. */
async function signIn(device: Device, target: Target): Promise<void> {
  const token = process.env['SYNTHETIC_MONITOR_TOKEN']?.trim() ?? '';
  if (token === '') {
    throw new Error(
      'SYNTHETIC_MONITOR_TOKEN is missing from the secrets env: signed-in journeys cannot sign in'
    );
  }
  const redirectUrl = await requestSyntheticMonitorRedirect({
    http: target.http,
    apiOrigin: target.apiOrigin,
    apiPathPrefix: API_PATH_PREFIX,
    token,
    callbackUrl: `${target.webOrigin}/sso-callback`,
  });
  await device.view.navigate(redirectUrl);
  await confirmSignedIn(device.driver);
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

function journeyBrowser(device: Device, target: Target): JourneyBrowser {
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

/** Screenshot, HTML, URL and console of the failed page; returns the dir. */
async function saveFailure(
  journey: CriticalJourney,
  device: Device,
  error: unknown
): Promise<string> {
  const store = createNodeFsObjectStore({
    rootDir: ARTIFACT_DIR,
    fs: wallNodeFs(),
    layout: 'tree',
  });
  const key = (name: string): string => `${journey.id}/${name}`;
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  const summary = `journey: ${journey.id}\nurl: ${await pageUrl(device)}\n\n${message}\n`;
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
  return join(ARTIFACT_DIR, journey.id);
}

async function runJourney(
  journey: CriticalJourney,
  target: Target
): Promise<void> {
  const device = await openDevice(target);
  try {
    await device.driver.launch();
    if (journey.access === 'signed-in') await signIn(device, target);
    await journey.run({
      ui: device.driver,
      runId: RUN_ID,
      browser: journeyBrowser(device, target),
    });
  } catch (error) {
    const dir = await saveFailure(journey, device, error);
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `critical journey "${journey.id}" broke in production: ${reason}\nevidence: ${dir}`,
      { cause: error }
    );
  } finally {
    await device.close();
  }
}

/** Journeys sign in and write for real: production environments only. */
const env = envFile(process.env['SECRETS_ENV']?.trim() || 'dev');

describe.skipIf(!isProductionEnv(env))(`critical journeys (${env.env})`, () => {
  const target: Target = {
    webOrigin: envOrigins(env).web,
    apiOrigin: envOrigins(env).api,
    http: createGlobalHttpClient(),
  };
  for (const journey of CRITICAL_JOURNEYS) {
    test(
      `${journey.id}: ${journey.title}`,
      () => runJourney(journey, target),
      JOURNEY_TIMEOUT_MS
    );
  }
});

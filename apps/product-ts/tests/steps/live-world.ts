import {
  BROWSER_FAILURE_LAYOUT,
  browserFailureLog,
  browserFailureSummary,
  readBrowserStorageEvidence,
} from '@apps/product-ts/browser-failure-summary';
import { readSyncResponseEvidence } from '@apps/product-ts/browser-network-evidence';
import {
  actOnLiveDevice,
  type LiveDevices,
  openGuestDevice,
  requireDevice,
  runLiveCleanups,
} from '@apps/product-ts/live-journey-devices';
// @io-wall-ok — live health: the world every `liveDomains` scenario runs in.
/**
 * The world a live scenario (`@synthetic` features, `specs/journeys/`) runs in:
 * the environment `SECRETS_ENV` names, plain HTTP, and — only once a journey
 * step asks — a fresh real-browser device. A failed step saves the page's
 * evidence before the scenario's deferred cleanups (ending a hosted space)
 * run and the device closes.
 */

import type { Device, LiveTarget } from '@apps/product-ts/live-browser';
import {
  emulateOffline,
  journeyBrowser,
  openDevice,
  readLocation,
  saveEvidence,
} from '@apps/product-ts/live-browser';
import { prepareCriticalJourneyAccess } from '@apps/product-ts/prepare-critical-journey-access';
import type { EnvFile, EnvOrigins } from '@libs/infra-shared-ts/env-file';
import { authRelayOrigin, envOrigins } from '@libs/infra-shared-ts/env-file';
import { envFile } from '@libs/infra-shared-ts/envs';
import {
  atTabShell,
  confirmSignedIn,
  JOURNEY_WAIT_MS,
} from '@libs/runtime-harness-ts/journey-gestures';
import type {
  JourneyAccess,
  JourneyGestures,
  JourneyHost,
  JourneyWorld,
} from '@libs/runtime-harness-ts/journey-types';
import { spaceLinkFromLocation } from '@libs/runtime-harness-ts/journey-types';
import { requestSyntheticMonitorSignIn } from '@pkgs/auth-inhouse-shared-ts/synthetic-monitor';
import { wallClock, wallTimers } from '@pkgs/clock-shared-ts/wall';
import type { ScenarioContext } from '@pkgs/gherkin-shared-ts/registry';
import { setWorld } from '@pkgs/gherkin-shared-ts/registry';
import { createGlobalHttpClient } from '@pkgs/http-client-shared-ts/global';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import { liveJourneyPeerDevice } from './live-peer-device';
import { wallWait } from './wall-wait';

const API_PATH_PREFIX = '/api';
const SSO_CALLBACK_PATH = '/sso-callback';
/** Seeds what journeys write this run (avatar seed, search query). */
const RUN_ID = wallClock.now().toString(36);

export type LiveWorld = JourneyWorld & {
  readonly ctx: ScenarioContext;
  /** The environment under test (`SECRETS_ENV`). */
  readonly env: EnvFile;
  readonly origins: EnvOrigins;
  readonly http: HttpClient;
  /** Values a step hands to a later step. */
  readonly memo: Map<string, unknown>;
};

/** A secret from the run's environment; fails the step when missing. */
export function requireSecret(name: string): string {
  const value = process.env[name]?.trim() ?? '';
  if (value.length === 0) {
    throw new Error(`${name} is missing from the secrets env`);
  }
  return value;
}

/** Sign in as the synthetic-monitor user through the real callback path. */
async function signIn(
  device: Device,
  target: LiveTarget,
  options: { peer?: boolean; continuationToken?: string } = {}
): Promise<string> {
  const issued = await requestSyntheticMonitorSignIn({
    http: target.http,
    apiOrigin: target.apiOrigin,
    apiPathPrefix: API_PATH_PREFIX,
    token: requireSecret('SYNTHETIC_MONITOR_TOKEN'),
    ...options,
    callbackUrl: `${target.webOrigin}${SSO_CALLBACK_PATH}`,
  });
  await device.view.navigate(issued.redirectUrl);
  // The header (and its account menu) shows before the lazy callback route
  // reads `?code=` from the URL. Leaving first drops the code, so wait for
  // the callback to finish and move on by itself.
  await journeyBrowser(device, target).waitForNavigation(
    (url) => new URL(url).pathname !== SSO_CALLBACK_PATH,
    JOURNEY_WAIT_MS
  );
  await confirmSignedIn(device.driver);
  return issued.continuationToken;
}

type Browsing = {
  readonly host: JourneyHost;
  /** Save the open page's evidence, if a device is open. */
  evidence(id: string, cause: unknown): Promise<string | null>;
  /**
   * Run the due cleanups, then close the device. A cleanup's failure fails
   * the scenario only when no step already did (the step's error wins).
   */
  close(): Promise<void>;
};

type FailureFlag = { failed: boolean };

async function openLiveDevice(
  target: LiveTarget,
  devices: LiveDevices,
  access: JourneyAccess
): Promise<void> {
  const opened = await openDevice(target);
  devices.host = opened;
  devices.shown = opened;
  // `launch()` only waits for document navigation. Let the initial lazy
  // tab route settle before leaving for the hosted-auth callback.
  await prepareCriticalJourneyAccess({
    access,
    launch: () => opened.driver.launch(),
    waitForTabShell: () => atTabShell(opened.driver),
    signIn: async () => {
      await signIn(opened, target);
    },
  });
}

async function ensureHost(
  target: LiveTarget,
  devices: LiveDevices
): Promise<Device> {
  if (devices.host === null) await openLiveDevice(target, devices, 'anonymous');
  return requireDevice(devices.host, 'device');
}

function liveJourneyHost(
  target: LiveTarget,
  devices: LiveDevices,
  cleanups: Map<string, JourneyGestures>
): JourneyHost {
  const peer = liveJourneyPeerDevice(
    target,
    devices,
    (device, continuationToken) =>
      signIn(device, target, {
        peer: true,
        ...(continuationToken === undefined ? {} : { continuationToken }),
      })
  );
  return {
    runId: RUN_ID,
    now: () => Promise.resolve(wallClock.now()),
    elapse: wallWait.sleep,
    get browser() {
      return devices.host === null
        ? null
        : journeyBrowser(devices.host, target);
    },
    // The deployed bundle is a production build: no puzzle answers on the page.
    showsPuzzleAnswers: false,
    open: (access) => openLiveDevice(target, devices, access),
    peerDevice: peer,
    openPeer: peer.open,
    act: async (name, gestures) => {
      const current = await ensureHost(target, devices);
      await actOnLiveDevice(devices, current, gestures, name);
    },
    actAsGuest: async (name, gestures) => {
      const current = requireDevice(devices.guest, 'guest');
      await actOnLiveDevice(devices, current, gestures, name);
    },
    spaceLink: async () =>
      spaceLinkFromLocation(
        await readLocation(requireDevice(devices.host, 'device').view)
      ),
    openLink: (link) =>
      requireDevice(devices.host, 'device').view.navigate(
        new URL(link, target.webOrigin).href
      ),
    openGuest: (link) => openGuestDevice(target, devices, link),
    offline: async () => {
      await emulateOffline(requireDevice(devices.host, 'device').view);
    },
    online: async () => {
      await requireDevice(devices.host, 'device').view.cdp(
        'Network.emulateNetworkConditions',
        {
          offline: false,
          latency: 0,
          downloadThroughput: -1,
          uploadThroughput: -1,
        }
      );
    },
    reopen: () => requireDevice(devices.host, 'device').driver.launch(),
    defer: (key, cleanup) => {
      cleanups.set(key, cleanup);
    },
    settle: (key) => {
      cleanups.delete(key);
    },
  };
}

/**
 * Print what each open device shows, its geometry, requests and console. A
 * failure that reaches the log without this leaves no way to say why.
 */
async function printBrowserState(devices: LiveDevices): Promise<void> {
  const details: string[] = [];
  const summaries: string[] = [];
  for (const [name, current] of [
    ['host', devices.host],
    ['peer', devices.guest],
    ...devices.previousPeers.map(
      (device, index) => [`earlier peer ${index + 1}`, device] as const
    ),
  ] as const) {
    if (current !== null) {
      const storage = await readBrowserStorageEvidence(
        (script) => current.view.evaluate(script),
        wallTimers
      );
      summaries.push(`browser failure storage (${name}): ${String(storage)}`);
    }
    const layout = await current?.view
      .evaluate(BROWSER_FAILURE_LAYOUT)
      .catch((error: unknown) => {
        summaries.push(
          `browser failure geometry error (${name}): ${String(error)}`
        );
        return null;
      });
    if (layout !== null && layout !== undefined)
      summaries.push(`browser failure geometry (${name}): ${String(layout)}`);
    const html = await current?.driver
      .snapshotHtml()
      .catch((error: unknown) => {
        summaries.push(
          `browser failure snapshot error (${name}): ${String(error)}`
        );
        return null;
      });
    if (typeof html === 'string')
      summaries.push(
        `browser failure state (${name}): ${browserFailureSummary(html)}`
      );
    if (current !== null) {
      const transport = [...current.network];
      const responses = await readSyncResponseEvidence(current.view, transport);
      details.push(
        `browser failure transport (${name}): ${[...transport, ...responses].join('\n')}`
      );
      details.push(
        `browser failure console (${name}): ${current.console.slice(-40).join('\n')}`
      );
    }
  }
  console.error(browserFailureLog(details, summaries));
}

async function closeBrowsing(
  devices: LiveDevices,
  cleanups: Map<string, JourneyGestures>,
  failureFlag: FailureFlag
): Promise<void> {
  let failure: unknown = null;
  try {
    const host = devices.host;
    if (host !== null) {
      failure = await runLiveCleanups(devices, cleanups, async (key, error) => {
        console.error(`cleanup ${key} failed: ${String(error)}`);
        // Later cleanups navigate and can conceal the failing screen.
        if (!failureFlag.failed)
          await printBrowserState(devices).catch(() => undefined);
      });
      await host.close();
    }
  } finally {
    const peers = [...devices.previousPeers, devices.guest];
    const closed = await Promise.allSettled(
      peers.map((device) => device?.close())
    );
    for (const result of closed)
      if (result.status === 'rejected') failure ??= result.reason;
  }
  if (failure === null) return;
  if (!failureFlag.failed) throw failure;
  console.error(
    `cleanup after the failed step also failed: ${String(failure)}`
  );
}

function browsing(target: LiveTarget): Browsing {
  const devices: LiveDevices = {
    host: null,
    guest: null,
    shown: null,
    previousPeers: [],
  };
  const cleanups = new Map<string, JourneyGestures>();
  const failureFlag: FailureFlag = { failed: false };
  return {
    host: liveJourneyHost(target, devices, cleanups),
    evidence: async (id, cause) => {
      failureFlag.failed = true;
      await printBrowserState(devices);
      const device = devices.shown ?? devices.host;
      return device === null
        ? Promise.resolve(null)
        : saveEvidence(id, device, cause, target.http);
    },
    close: () => closeBrowsing(devices, cleanups, failureFlag),
  };
}

type LiveScenario = LiveWorld & { readonly browsing: Browsing };

/** Register the live world for this package's `liveDomains` features. */
export function useLiveWorld(target?: LiveTarget): void {
  const env = envFile(process.env['SECRETS_ENV']?.trim() || 'dev');
  const origins = envOrigins(env);
  const http = createGlobalHttpClient();
  setWorld<LiveScenario>({
    create: (ctx) => {
      const scenario = browsing(
        target ?? {
          webOrigin: origins.web,
          apiOrigin: origins.api,
          oauthCallbackOrigin: authRelayOrigin(),
          http,
        }
      );
      return Promise.resolve({
        ctx,
        env,
        origins,
        http,
        memo: new Map(),
        journey: scenario.host,
        browsing: scenario,
      });
    },
    failed: async (w, cause) => {
      const dir = await w.browsing.evidence(w.ctx.testId, cause);
      if (dir !== null) console.error(`evidence: ${dir}`);
    },
    dispose: (w) => w.browsing.close(),
  });
}

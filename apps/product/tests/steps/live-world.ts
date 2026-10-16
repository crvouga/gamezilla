// @io-wall-ok — live health: the world every `liveDomains` scenario runs in.
/**
 * The world a live scenario (`@synthetic` features, `specs/journeys/`) runs in:
 * the environment `SECRETS_ENV` names, plain HTTP, and — only once a journey
 * step asks — a fresh real-browser device. A failed step saves the page's
 * evidence before the scenario's deferred cleanups (ending a hosted space)
 * run and the device closes.
 */

import type { Device, LiveTarget } from '@apps/product/live-browser';
import {
  emulateOffline,
  journeyBrowser,
  openDevice,
  readLocation,
  saveEvidence,
} from '@apps/product/live-browser';
import { prepareCriticalJourneyAccess } from '@apps/product/prepare-critical-journey-access';
import type { EnvFile, EnvOrigins } from '@libs/infra-shared/env-file';
import { authRelayOrigin, envOrigins } from '@libs/infra-shared/env-file';
import { envFile } from '@libs/infra-shared/envs';
import {
  atTabShell,
  confirmSignedIn,
  JOURNEY_WAIT_MS,
} from '@libs/runtime-harness/journey-gestures';
import type {
  JourneyAccess,
  JourneyGestures,
  JourneyHost,
  JourneyWorld,
} from '@libs/runtime-harness/journey-types';
import { spaceLinkFromLocation } from '@libs/runtime-harness/journey-types';
import { requestSyntheticMonitorRedirect } from '@pkgs/auth-inhouse-shared/synthetic-monitor';
import { wallClock } from '@pkgs/clock-shared/wall';
import type { ScenarioContext } from '@pkgs/gherkin-shared/registry';
import { hostLimit, setWorld } from '@pkgs/gherkin-shared/registry';
import { createGlobalHttpClient } from '@pkgs/http-client-shared/global';
import type { HttpClient } from '@pkgs/http-client-shared/types';

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
async function signIn(device: Device, target: LiveTarget): Promise<void> {
  const redirectUrl = await requestSyntheticMonitorRedirect({
    http: target.http,
    apiOrigin: target.apiOrigin,
    apiPathPrefix: API_PATH_PREFIX,
    token: requireSecret('SYNTHETIC_MONITOR_TOKEN'),
    callbackUrl: `${target.webOrigin}${SSO_CALLBACK_PATH}`,
  });
  await device.view.navigate(redirectUrl);
  // The header (and its account menu) shows before the lazy callback route
  // reads `?code=` from the URL. Leaving first drops the code, so wait for
  // the callback to finish and move on by itself.
  await journeyBrowser(device, target).waitForNavigation(
    (url) => new URL(url).pathname !== SSO_CALLBACK_PATH,
    JOURNEY_WAIT_MS
  );
  await confirmSignedIn(device.driver);
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

type LiveDevices = {
  host: Device | null;
  guest: Device | null;
  /** The device the last gesture ran on — what a failure should capture. */
  shown: Device | null;
};

type FailureFlag = { failed: boolean };

function requireDevice(device: Device | null, who: string): Device {
  if (device === null) {
    throw new Error(`no ${who}: a journey opens the app first`);
  }
  return device;
}

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
    signIn: () => signIn(opened, target),
  });
}

async function ensureHost(
  target: LiveTarget,
  devices: LiveDevices
): Promise<Device> {
  if (devices.host === null) await openLiveDevice(target, devices, 'anonymous');
  return requireDevice(devices.host, 'device');
}

async function openGuestDevice(
  target: LiveTarget,
  devices: LiveDevices,
  link: string
): Promise<void> {
  if (devices.guest === null) devices.guest = await openDevice(target);
  const guest = requireDevice(devices.guest, 'guest');
  devices.shown = guest;
  await guest.view.navigate(new URL(link, target.webOrigin).href);
}

function liveJourneyHost(
  target: LiveTarget,
  devices: LiveDevices,
  cleanups: Map<string, JourneyGestures>
): JourneyHost {
  return {
    runId: RUN_ID,
    now: () => Promise.resolve(wallClock.now()),
    get browser() {
      return devices.host === null
        ? null
        : journeyBrowser(devices.host, target);
    },
    // The deployed bundle is a production build: no puzzle answers on the page.
    showsPuzzleAnswers: false,
    open: (access) => openLiveDevice(target, devices, access),
    openPeer: async (access) => {
      if (access === 'signed-in')
        throw hostLimit(
          'two account journeys need independent browser storage and a second synthetic-monitor account; this host has one account and Chrome views share storage'
        );
      await openGuestDevice(target, devices, '/');
    },
    act: async (_name, gestures) => {
      const current = await ensureHost(target, devices);
      devices.shown = current;
      await gestures(current.driver);
    },
    actAsGuest: async (_name, gestures) => {
      const current = requireDevice(devices.guest, 'guest');
      devices.shown = current;
      await gestures(current.driver);
    },
    spaceLink: async () =>
      spaceLinkFromLocation(
        await readLocation(requireDevice(devices.host, 'device').view)
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

async function closeBrowsing(
  devices: LiveDevices,
  cleanups: Map<string, JourneyGestures>,
  failureFlag: FailureFlag
): Promise<void> {
  let failure: unknown = null;
  try {
    const host = devices.host;
    if (host !== null) {
      for (const cleanup of cleanups.values()) {
        await cleanup(host.driver).catch((error: unknown) => {
          failure ??= error;
        });
      }
      await host.close();
    }
  } finally {
    if (devices.guest !== null) await devices.guest.close();
  }
  if (failure === null) return;
  if (!failureFlag.failed) throw failure;
  console.error(
    `cleanup after the failed step also failed: ${String(failure)}`
  );
}

function browsing(target: LiveTarget): Browsing {
  const devices: LiveDevices = { host: null, guest: null, shown: null };
  const cleanups = new Map<string, JourneyGestures>();
  const failureFlag: FailureFlag = { failed: false };
  return {
    host: liveJourneyHost(target, devices, cleanups),
    evidence: (id, cause) => {
      failureFlag.failed = true;
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

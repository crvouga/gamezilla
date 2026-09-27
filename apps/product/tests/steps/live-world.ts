// @io-wall-ok — live health: the world every `liveDomains` scenario runs in.
/**
 * The world a live scenario (`specs/health/`, `specs/journeys/`) runs in:
 * the environment `SECRETS_ENV` names, plain HTTP, and — only once a journey
 * step asks — a fresh real-browser device. A failed step saves the page's
 * evidence before the scenario's deferred cleanups (ending a hosted space)
 * run and the device closes.
 */

import { prepareCriticalJourneyAccess } from '@apps/product/sim/prepare-critical-journey-access';
import {
  type EnvFile,
  type EnvOrigins,
  envOrigins,
} from '@libs/infra/public/env-file';
import { envFile } from '@libs/infra/public/envs';
import {
  atTabShell,
  confirmSignedIn,
  type JourneyGestures,
  type JourneyHost,
  type JourneyWorld,
} from '@libs/runtime/sim/critical-journeys';
import { requestSyntheticMonitorRedirect } from '@pkgs/auth-inhouse/shared';
import { wallClock } from '@pkgs/clock';
import { type ScenarioContext, setWorld } from '@pkgs/gherkin/registry';
import { createGlobalHttpClient, type HttpClient } from '@pkgs/http-client';
import {
  type Device,
  journeyBrowser,
  type LiveTarget,
  openDevice,
  saveEvidence,
} from './live-browser';

const API_PATH_PREFIX = '/api';
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
    callbackUrl: `${target.webOrigin}/sso-callback`,
  });
  await device.view.navigate(redirectUrl);
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

function browsing(target: LiveTarget): Browsing {
  let device: Device | null = null;
  let stepFailed = false;
  const cleanups = new Map<string, JourneyGestures>();
  const openedDevice = (): Device => {
    if (device === null) {
      throw new Error('no device: a journey opens the app first');
    }
    return device;
  };
  const host: JourneyHost = {
    runId: RUN_ID,
    get browser() {
      return device === null ? null : journeyBrowser(device, target);
    },
    // The deployed bundle is a production build: no puzzle answers on the page.
    showsPuzzleAnswers: false,
    open: async (access) => {
      const opened = await openDevice(target);
      device = opened;
      // `launch()` only waits for document navigation. Let the initial lazy
      // tab route settle before leaving for the hosted-auth callback.
      await prepareCriticalJourneyAccess({
        access,
        launch: () => opened.driver.launch(),
        waitForTabShell: () => atTabShell(opened.driver),
        signIn: () => signIn(opened, target),
      });
    },
    act: (_name, gestures) => gestures(openedDevice().driver),
    defer: (key, cleanup) => {
      cleanups.set(key, cleanup);
    },
    settle: (key) => {
      cleanups.delete(key);
    },
  };
  return {
    host,
    evidence: (id, cause) => {
      stepFailed = true;
      return device === null
        ? Promise.resolve(null)
        : saveEvidence(id, device, cause);
    },
    close: async () => {
      if (device === null) return;
      let failure: unknown = null;
      for (const cleanup of cleanups.values()) {
        await cleanup(device.driver).catch((error: unknown) => {
          failure ??= error;
        });
      }
      await device.close();
      if (failure === null) return;
      if (!stepFailed) throw failure;
      console.error(
        `cleanup after the failed step also failed: ${String(failure)}`
      );
    },
  };
}

type LiveScenario = LiveWorld & { readonly browsing: Browsing };

/** Register the live world for this package's `liveDomains` features. */
export function useLiveWorld(): void {
  const env = envFile(process.env['SECRETS_ENV']?.trim() || 'dev');
  const origins = envOrigins(env);
  const http = createGlobalHttpClient();
  setWorld<LiveScenario>({
    create: (ctx) => {
      const scenario = browsing({
        webOrigin: origins.web,
        apiOrigin: origins.api,
        http,
      });
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

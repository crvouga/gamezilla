// @io-wall-ok — tools composition root.

/**
 * Boot the whole product on loopback: backing services, simulated Google and
 * Apple,
 * N API instances, the balancer in front of them, and (optionally) the built
 * web bundle.
 *
 * Every port is OS-assigned and every piece of state lives under one
 * instance directory, so several stacks run side by side with no
 * coordination beyond the manifest each one writes.
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { PLUS_MEMBERSHIP_OFFER } from '@libs/billing/public/offer';
import { membershipCallbackPath } from '@pkgs/billing';
import {
  MOCK_BILLING_PROVIDER,
  MockBillingBindingKeys,
  mockBillingCatalogFromOffer,
} from '@pkgs/billing-mock';
import { MEMBERSHIP_PROVIDER_MODULES } from '@pkgs/billing-providers';

import { bootInfra, type InfraHandles } from './boot-infra';
import {
  type PortReservation,
  reservePort,
  waitForApiBooted,
  waitForHttp,
} from './free-port';
import { startLoadBalancer } from './load-balancer';
import { type StackManifest, writeManifest } from './manifest';
import type { StackOptions } from './stack-options';
import { type IdpState, type StackIdps, startStackIdps } from './start-idps';

const REPO_ROOT = join(import.meta.dir, '../../../..');
const AUTH_SECRET = 'localhost-stack-auth-secret-0123456789';
const BILLING_SECRET_KEY = 'sk_test_mock_localhost_stack';
const BILLING_WEBHOOK_SECRET = 'whsec_mock_localhost_stack';
/** Product super-app serves both `/` and the always-available `/harness`. */
const PRODUCT_DEV_ARGS = [
  'run',
  '--cwd',
  'apps/product',
  'dev',
  '--',
  '--host',
  '127.0.0.1',
] as const;

export type LocalhostStack = {
  readonly manifest: StackManifest;
  readonly manifestPath: string;
  stop(): Promise<void>;
};

function nodeId(index: number): string {
  return `api-${String.fromCharCode(97 + index)}`;
}

/**
 * The mock payment provider, on its own port with its own SQLite file in the
 * instance directory — reached by the API nodes exactly as they reach any provider,
 * and sending its webhooks to the balancer.
 */
async function startBillingProvider(args: {
  readonly apiOrigin: string;
  readonly port: number;
  readonly dataDir: string;
}): Promise<ChildProcess> {
  const child = spawn('bun', ['pkgs/billing-mock-provider/scripts/serve.ts'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      BILLING_MOCK_PORT: String(args.port),
      BILLING_MOCK_CATALOG: JSON.stringify(
        mockBillingCatalogFromOffer(PLUS_MEMBERSHIP_OFFER)
      ),
      BILLING_MOCK_SECRET_KEY: BILLING_SECRET_KEY,
      BILLING_MOCK_WEBHOOK_URL: `${args.apiOrigin}${membershipCallbackPath(PLUS_MEMBERSHIP_OFFER, MOCK_BILLING_PROVIDER)}`,
      BILLING_MOCK_WEBHOOK_SECRET: BILLING_WEBHOOK_SECRET,
      BILLING_MOCK_STATE_PATH: join(args.dataDir, 'billing.sqlite'),
    },
  });
  await waitForHttp(`http://127.0.0.1:${String(args.port)}/health`);
  return child;
}

function waitForChildExit(child: ChildProcess): Promise<void> {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  child.once('error', reject);
  child.once('exit', (code, signal) => {
    if (code === 0) {
      resolve();
      return;
    }
    reject(
      new Error(
        `child exited with ${signal === null ? `code ${String(code)}` : signal}`
      )
    );
  });
  return promise;
}

/** SIGTERM, then wait for the exit so teardown leaves no orphan listener. */
async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = waitForChildExit(child).catch(() => undefined);
  try {
    child.kill('SIGTERM');
  } catch {
    // already gone
  }
  await exited;
}

function startApiNode(args: {
  readonly id: string;
  readonly port: number;
  readonly apiOrigin: string;
  readonly idpEnv: Readonly<Record<string, string>>;
  readonly billingOrigin: string;
  readonly webOrigin: string | null;
  readonly infraEnv: Readonly<Record<string, string>>;
}): ChildProcess {
  return spawn('bun', ['run', 'apps/server/scripts/serve-api-node.ts'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...args.infraEnv,
      ...args.idpEnv,
      API_NODE_ID: args.id,
      API_NODE_PORT: String(args.port),
      SECRETS_ENV: 'dev',
      API_URL: args.apiOrigin,
      AUTH_SECRET,
      // The stack bills through the mock alone: no real provider's
      // credentials from the parent environment are configured beside it.
      ...Object.fromEntries(
        MEMBERSHIP_PROVIDER_MODULES.flatMap((module) =>
          module.secrets.map((secret) => [secret.name, ''])
        )
      ),
      BILLING_PROVIDER: MOCK_BILLING_PROVIDER,
      [MockBillingBindingKeys.origin]: args.billingOrigin,
      [MockBillingBindingKeys.secretKey]: BILLING_SECRET_KEY,
      [MockBillingBindingKeys.webhookSecret]: BILLING_WEBHOOK_SECRET,
      WEB_CLIENT_ORIGIN: args.webOrigin ?? '',
    },
  });
}

async function startWeb(args: {
  readonly origin: string;
  readonly apiOrigin: string;
  readonly frozen: boolean;
  readonly testHooks: boolean;
}): Promise<ChildProcess> {
  const child = spawn('bun', PRODUCT_DEV_ARGS, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_PORT: new URL(args.origin).port,
      VITE_API_URL: args.apiOrigin,
      VITE_LOCAL_PREVIEW_API_ORIGIN: args.apiOrigin,
      ...(args.frozen ? { PRODUCT_DEV_FROZEN: '1' } : {}),
      ...(args.testHooks ? { VITE_TEST_HOOKS: '1' } : {}),
    },
  });
  await waitForHttp(`${args.origin}/harness`);
  return child;
}

/**
 * Resolve the provider's SQLite file. `instance` keeps it inside the instance
 * data directory (so `--keep-data` makes it survive, and a wipe takes it with
 * the rest); `path` uses exactly the caller's file and is never removed here.
 */
function resolveIdpState(options: StackOptions, dataDir: string): IdpState {
  if (options.idpStateMode === 'memory') return { mode: 'memory', path: null };
  if (options.idpStateMode === 'instance') {
    return { mode: 'instance', path: join(dataDir, 'idp.sqlite') };
  }
  const path = options.idpStatePath;
  if (path === null) throw new Error('idp state path mode without a path');
  mkdirSync(dirname(path), { recursive: true });
  return { mode: 'path', path };
}

function instanceDataDir(options: StackOptions): string {
  const dir = join(REPO_ROOT, '.cache', 'localhost-stack', options.instanceId);
  if (!options.keepData) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

type ApiTier = {
  readonly children: ChildProcess[];
  readonly backends: { readonly id: string; readonly origin: string }[];
};

async function startApiTier(args: {
  readonly options: StackOptions;
  readonly apiOrigin: string;
  readonly idpEnv: Readonly<Record<string, string>>;
  readonly billingOrigin: string;
  readonly webOrigin: string | null;
  readonly infra: InfraHandles;
}): Promise<ApiTier> {
  const children: ChildProcess[] = [];
  const backends: { readonly id: string; readonly origin: string }[] = [];
  for (let index = 0; index < args.options.apiNodes; index += 1) {
    const reservation = reservePort();
    await reservation.release();
    const id = nodeId(index);
    children.push(
      startApiNode({
        id,
        port: reservation.port,
        apiOrigin: args.apiOrigin,
        idpEnv: args.idpEnv,
        billingOrigin: args.billingOrigin,
        webOrigin: args.webOrigin,
        infraEnv: args.infra.env,
      })
    );
    backends.push({
      id,
      origin: `http://127.0.0.1:${String(reservation.port)}`,
    });
  }
  await Promise.all(
    backends.map(async (backend) => {
      await waitForHttp(`${backend.origin}/api/health`, 90_000);
      // Health only proves the listener bound; this proves the worker booted.
      await waitForApiBooted(backend.origin);
    })
  );
  return { children, backends };
}

async function stopIdps(idps: StackIdps): Promise<void> {
  await Promise.all([stopChild(idps.google), stopChild(idps.apple)]);
}

/** Boots infra and the simulated IdPs, unwinding whichever side succeeded on failure. */
async function bootInfraAndIdps(args: {
  readonly options: StackOptions;
  readonly dataDir: string;
  readonly apiOrigin: string;
  /** Freed just before the IdP processes bind them. */
  readonly idpReservations: {
    readonly google: PortReservation;
    readonly apple: PortReservation;
  };
  readonly idpState: IdpState;
}): Promise<{ infra: InfraHandles; idps: StackIdps }> {
  const infraPromise = bootInfra({
    options: args.options,
    dataDir: args.dataDir,
  });
  const { google, apple } = args.idpReservations;
  await google.release();
  await apple.release();
  const idpPromise = startStackIdps({
    repoRoot: REPO_ROOT,
    apiOrigin: args.apiOrigin,
    ports: { google: google.port, apple: apple.port },
    state: args.idpState,
  });
  try {
    const [infra, idps] = await Promise.all([infraPromise, idpPromise]);
    return { infra, idps };
  } catch (error) {
    const [infraResult, idpResult] = await Promise.allSettled([
      infraPromise,
      idpPromise,
    ]);
    if (infraResult.status === 'fulfilled') await infraResult.value.stop();
    if (idpResult.status === 'fulfilled') await stopIdps(idpResult.value);
    throw error;
  }
}

type BillingAndApi = {
  readonly billingChild: ChildProcess;
  readonly api: ApiTier;
};

/** The payment provider, then the API nodes that bill through it. */
async function startBillingAndApi(args: {
  readonly options: StackOptions;
  readonly apiOrigin: string;
  readonly idpEnv: Readonly<Record<string, string>>;
  readonly billingPort: number;
  readonly releaseBillingPort: () => Promise<void>;
  readonly webOrigin: string | null;
  readonly infra: InfraHandles;
  readonly dataDir: string;
  readonly unwind: () => Promise<void>;
}): Promise<BillingAndApi> {
  await args.releaseBillingPort();
  let billingChild: ChildProcess;
  try {
    billingChild = await startBillingProvider({
      apiOrigin: args.apiOrigin,
      port: args.billingPort,
      dataDir: args.dataDir,
    });
  } catch (error) {
    await args.unwind();
    throw error;
  }
  try {
    const api = await startApiTier({
      options: args.options,
      apiOrigin: args.apiOrigin,
      idpEnv: args.idpEnv,
      billingOrigin: `http://127.0.0.1:${String(args.billingPort)}`,
      webOrigin: args.webOrigin,
      infra: args.infra,
    });
    return { billingChild, api };
  } catch (error) {
    await stopChild(billingChild);
    await args.unwind();
    throw error;
  }
}

function loopback(port: number): string {
  return `http://127.0.0.1:${String(port)}`;
}

/**
 * Every port up front. The balancer's must be known before anything else
 * boots: it is the API origin baked into OAuth redirect URIs and the IdP
 * clients.
 */
function reserveStackPorts(options: StackOptions) {
  return {
    lbReservation: reservePort(),
    idpReservations: { google: reservePort(), apple: reservePort() },
    billingReservation: reservePort(),
    webReservation: options.withWeb ? reservePort() : null,
  };
}

export async function bootLocalhostStack(
  options: StackOptions
): Promise<LocalhostStack> {
  const dataDir = instanceDataDir(options);
  const idpState = resolveIdpState(options, dataDir);
  const { lbReservation, idpReservations, billingReservation, webReservation } =
    reserveStackPorts(options);
  const webOrigin =
    webReservation === null ? null : loopback(webReservation.port);
  const apiOrigin = loopback(lbReservation.port);
  const billingOrigin = loopback(billingReservation.port);

  // Infra and the simulated providers boot independently; the product Vite
  // server starts after the API origin is available and serves `/harness`.
  const { infra, idps } = await bootInfraAndIdps({
    options,
    dataDir,
    apiOrigin,
    idpReservations,
    idpState,
  });
  const { api, billingChild } = await startBillingAndApi({
    options,
    apiOrigin,
    idpEnv: idps.apiEnv,
    billingPort: billingReservation.port,
    releaseBillingPort: () => billingReservation.release(),
    webOrigin,
    infra,
    dataDir,
    // Unwind what already booted if the provider or an API node fails.
    unwind: async () => {
      await stopIdps(idps);
      await infra.stop();
    },
  });
  await lbReservation.release();
  const balancer = startLoadBalancer({
    port: lbReservation.port,
    backends: api.backends,
  });
  await waitForHttp(`${balancer.origin}/api/health`);

  await webReservation?.release();
  const webChild =
    webOrigin === null
      ? null
      : await startWeb({
          origin: webOrigin,
          apiOrigin,
          frozen: options.frozenWeb,
          testHooks: options.testHooks,
        });

  const manifest: StackManifest = {
    instanceId: options.instanceId,
    startedAtMs: Date.now(),
    apiOrigin: balancer.origin,
    apiNodes: api.backends,
    webOrigin: webOrigin ?? '',
    idpOrigins: {
      google: loopback(idpReservations.google.port),
      apple: loopback(idpReservations.apple.port),
    },
    billingOrigin,
    databaseUrl: infra.databaseUrl,
    s3Endpoint: infra.s3Endpoint,
    mqttWssUrl: infra.mqttWssUrl,
    mqttUrl: infra.mqttUrl,
    observabilityCollectorUrl: infra.observabilityCollectorUrl,
    observabilityTraceDir: infra.observabilityTraceDir,
    observabilityTempoUrl: infra.observabilityTempoUrl,
    observabilityGrafanaUrl: infra.observabilityGrafanaUrl,
    dataDir,
  };
  const path = writeManifest(REPO_ROOT, manifest);

  return {
    manifest,
    manifestPath: path,
    async stop() {
      if (webChild !== null) await stopChild(webChild);
      await Promise.all(api.children.map((child) => stopChild(child)));
      await stopIdps(idps);
      await stopChild(billingChild);
      await balancer.stop();
      await infra.stop();
    },
  };
}

// @io-wall-ok — tools composition root.

/**
 * Boot the whole product on loopback: backing services, a simulated Google,
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
import { mockBillingCatalogFromOffer } from '@pkgs/billing-mock';

import { bootInfra, type InfraHandles } from './boot-infra';
import { reservePort, waitForApiBooted, waitForHttp } from './free-port';
import { startLoadBalancer } from './load-balancer';
import { type StackManifest, writeManifest } from './manifest';
import type { IdpStateMode, StackOptions } from './stack-options';

const REPO_ROOT = join(import.meta.dir, '../../../..');
const AUTH_SECRET = 'localhost-stack-auth-secret-0123456789';
const GOOGLE_CLIENT_ID = 'localhost-stack.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = 'localhost-stack-google-secret';
const BILLING_SECRET_KEY = 'sk_test_mock_localhost_stack';
const BILLING_WEBHOOK_SECRET = 'whsec_mock_localhost_stack';
/** Product super-app serves both `/` and the always-available `/simulator`. */
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

async function startIdp(args: {
  readonly apiOrigin: string;
  readonly port: number;
  readonly state: { readonly mode: IdpStateMode; readonly path: string | null };
}): Promise<ChildProcess> {
  const child = spawn(
    'bun',
    [
      '--conditions=browser',
      '--conditions=development',
      '--preload',
      './pkgs/bun-test-solid/src/register.ts',
      'pkgs/idp-google-sim/scripts/serve.ts',
    ],
    {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        IDP_PORT: String(args.port),
        IDP_STATE_MODE: args.state.mode,
        ...(args.state.path === null
          ? {}
          : { IDP_STATE_PATH: args.state.path }),
        IDP_CLIENT_ID: GOOGLE_CLIENT_ID,
        IDP_CLIENT_SECRET: GOOGLE_CLIENT_SECRET,
        IDP_REDIRECT_URIS: `${args.apiOrigin}/api/auth/callback/google`,
        IDP_APP_NAME: 'Gamezilla',
      },
    }
  );
  await waitForHttp(
    `http://127.0.0.1:${String(args.port)}/.well-known/openid-configuration`
  );
  return child;
}

/**
 * The mock payment provider, on its own port with its own SQLite file in the
 * instance directory — reached by the API nodes exactly as they reach Stripe,
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
      BILLING_MOCK_WEBHOOK_URL: `${args.apiOrigin}${PLUS_MEMBERSHIP_OFFER.callbackPath}`,
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
  readonly idpOrigin: string;
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
      API_NODE_ID: args.id,
      API_NODE_PORT: String(args.port),
      SECRETS_ENV: 'dev',
      API_URL: args.apiOrigin,
      AUTH_SECRET,
      WEB_CLIENT_GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID,
      WEB_CLIENT_GOOGLE_CLIENT_SECRET: GOOGLE_CLIENT_SECRET,
      GOOGLE_IDP_ORIGIN: args.idpOrigin,
      BILLING_PROVIDER: 'mock',
      BILLING_MOCK_ORIGIN: args.billingOrigin,
      BILLING_MOCK_SECRET_KEY: BILLING_SECRET_KEY,
      BILLING_MOCK_WEBHOOK_SECRET: BILLING_WEBHOOK_SECRET,
      WEB_CLIENT_ORIGIN: args.webOrigin ?? '',
      OBSERVABILITY_BACKEND: 'noop',
    },
  });
}

async function startWeb(args: {
  readonly origin: string;
  readonly apiOrigin: string;
  readonly frozen: boolean;
  readonly e2eHooks: boolean;
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
      ...(args.e2eHooks ? { VITE_E2E: '1' } : {}),
    },
  });
  await waitForHttp(`${args.origin}/simulator`);
  return child;
}

/**
 * Resolve the provider's SQLite file. `instance` keeps it inside the instance
 * data directory (so `--keep-data` makes it survive, and a wipe takes it with
 * the rest); `path` uses exactly the caller's file and is never removed here.
 */
function resolveIdpState(
  options: StackOptions,
  dataDir: string
): { readonly mode: IdpStateMode; readonly path: string | null } {
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
  readonly idpOrigin: string;
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
        idpOrigin: args.idpOrigin,
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

/** Boots infra and the simulated IdP, unwinding whichever side succeeded on failure. */
async function bootInfraAndIdp(args: {
  readonly options: StackOptions;
  readonly dataDir: string;
  readonly apiOrigin: string;
  readonly idpPort: number;
  readonly idpState: {
    readonly mode: IdpStateMode;
    readonly path: string | null;
  };
  /** Frees the reserved IdP port just before the IdP process binds it. */
  readonly releaseIdpPort: () => Promise<void>;
}): Promise<{ infra: InfraHandles; idpChild: ChildProcess }> {
  const infraPromise = bootInfra({
    options: args.options,
    dataDir: args.dataDir,
  });
  await args.releaseIdpPort();
  const idpPromise = startIdp({
    apiOrigin: args.apiOrigin,
    port: args.idpPort,
    state: args.idpState,
  });
  try {
    const [infra, idpChild] = await Promise.all([infraPromise, idpPromise]);
    return { infra, idpChild };
  } catch (error) {
    const [infraResult, idpResult] = await Promise.allSettled([
      infraPromise,
      idpPromise,
    ]);
    if (infraResult.status === 'fulfilled') await infraResult.value.stop();
    if (idpResult.status === 'fulfilled') await stopChild(idpResult.value);
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
  readonly idpOrigin: string;
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
      idpOrigin: args.idpOrigin,
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

export async function bootLocalhostStack(
  options: StackOptions
): Promise<LocalhostStack> {
  const dataDir = instanceDataDir(options);
  const idpState = resolveIdpState(options, dataDir);
  // The balancer's port must be known before anything else boots: it is the
  // API origin baked into OAuth redirect URIs and the IdP client.
  const lbReservation = reservePort();
  const idpReservation = reservePort();
  const billingReservation = reservePort();
  const webReservation = options.withWeb ? reservePort() : null;
  const webOrigin =
    webReservation === null
      ? null
      : `http://127.0.0.1:${String(webReservation.port)}`;
  const apiOrigin = `http://127.0.0.1:${String(lbReservation.port)}`;
  const idpOrigin = `http://127.0.0.1:${String(idpReservation.port)}`;
  const billingOrigin = `http://127.0.0.1:${String(billingReservation.port)}`;

  // Infra and the simulated Google boot independently; the product Vite
  // server starts after the API origin is available and serves `/simulator`.
  const { infra, idpChild } = await bootInfraAndIdp({
    options,
    dataDir,
    apiOrigin,
    idpPort: idpReservation.port,
    idpState,
    releaseIdpPort: () => idpReservation.release(),
  });
  const { api, billingChild } = await startBillingAndApi({
    options,
    apiOrigin,
    idpOrigin,
    billingPort: billingReservation.port,
    releaseBillingPort: () => billingReservation.release(),
    webOrigin,
    infra,
    dataDir,
    // Unwind what already booted if the provider or an API node fails.
    unwind: async () => {
      await stopChild(idpChild);
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
          e2eHooks: options.e2eHooks,
        });

  const manifest: StackManifest = {
    instanceId: options.instanceId,
    startedAtMs: Date.now(),
    apiOrigin: balancer.origin,
    apiNodes: api.backends,
    webOrigin: webOrigin ?? '',
    idpOrigin,
    billingOrigin,
    databaseUrl: infra.databaseUrl,
    s3Endpoint: infra.s3Endpoint,
    mqttWssUrl: infra.mqttWssUrl,
    mqttUrl: infra.mqttUrl,
    dataDir,
  };
  const path = writeManifest(REPO_ROOT, manifest);

  return {
    manifest,
    manifestPath: path,
    async stop() {
      if (webChild !== null) await stopChild(webChild);
      await Promise.all(api.children.map((child) => stopChild(child)));
      await stopChild(idpChild);
      await stopChild(billingChild);
      await balancer.stop();
      await infra.stop();
    },
  };
}

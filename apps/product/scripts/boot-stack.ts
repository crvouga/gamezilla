// @io-wall-ok — tools composition root.

/**
 * Boot the whole product on loopback: backing services, simulated Google,
 * Apple and Stripe, N API instances, the balancer in front of them, and
 * (optionally) the built web bundle.
 *
 * Every port is OS-assigned and every piece of state lives under one
 * instance directory, so several stacks run side by side with no
 * coordination beyond the manifest each one writes. With a reports credential,
 * every API instance reads the one reports bucket OpenTofu provisions
 * (`gamezilla-reports`), the same store every deployment reads.
 */

import type { ChildProcess } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  createServer as createStripeServer,
  type StripeServer,
} from '@crvouga/mockingbird-service-stripe/server';
import { PLUS_MEMBERSHIP_OFFER } from '@libs/billing-shared/plus-membership-offer';
import { GLOBAL } from '@libs/infra-shared/global';
import { MEMBERSHIP_PROVIDER_MODULES } from '@pkgs/billing-providers-server/billing-providers';
import { membershipCallbackPath } from '@pkgs/billing-root-shared/providers';
import { STRIPE_MEMBERSHIP_PROVIDER } from '@pkgs/billing-stripe-server/provider-module';
import { STRIPE_PROVIDER } from '@pkgs/billing-stripe-server/stripe-membership';
import {
  StripeBindingKeys,
  StripeSecretKeys,
} from '@pkgs/billing-stripe-shared/secret-keys';
import { createLogger } from '@pkgs/logger-shared/logger';
import { spawnOwned as spawn } from '@pkgs/os-server/dev-owner-spawn';
import type { InfraHandles } from './boot-infra';
import { bootInfra } from './boot-infra';
import type { PortReservation } from './free-port';
import { reservePort, waitForApiBooted, waitForHttp } from './free-port';
import { startLoadBalancer } from './load-balancer';
import type { StackManifest } from './manifest';
import { writeManifest } from './manifest';
import { mockingbirdSqliteFile } from './mockingbird-sqlite';
import {
  loadReportsDevSecrets,
  reportsDevEnv,
} from './reports-dev-credentials';
import type { StackOptions } from './stack-options';
import type { IdpState, StackIdps } from './start-idps';
import { startStackIdps } from './start-idps';

const REPO_ROOT = join(import.meta.dir, '../../..');
const AUTH_SECRET = 'localhost-stack-auth-secret-0123456789';
const BILLING_SECRET_KEY = 'sk_test_localhost_stack';
/**
 * The product web app (`/` and `/harness`). This is Vite itself: the package
 * `dev` script is this stack, so the web child must not call it.
 */
const PRODUCT_DEV_ARGS = [
  'run',
  '--cwd',
  'apps/product',
  'vite',
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

/** Stripe, simulated, with its webhook endpoint's signing secret. */
type BillingProvider = {
  readonly server: StripeServer;
  readonly webhookSecret: string;
};

/**
 * Stripe, simulated (`@crvouga/mockingbird-service-stripe`), on its own port
 * with its state in the instance directory. Its catalog, billing portal
 * configuration and webhook endpoint are what `billing:sync` reconciles into
 * Stripe — the same module, over the same adapter — so the API nodes reach it
 * and hear from it (signed webhooks, through the balancer) as they do Stripe.
 */
async function startBillingProvider(args: {
  readonly apiOrigin: string;
  readonly port: number;
  readonly dataDir: string;
}): Promise<BillingProvider> {
  const server = await createStripeServer({
    port: args.port,
    sqlite: mockingbirdSqliteFile(join(args.dataDir, 'billing.sqlite')),
    accounts: [{ id: 'acct_localhost_stack', keys: [BILLING_SECRET_KEY] }],
  });
  const bindings: Readonly<Record<string, string>> = {
    [StripeSecretKeys.secretKey]: BILLING_SECRET_KEY,
    [StripeBindingKeys.apiOrigin]: server.url,
  };
  await STRIPE_MEMBERSHIP_PROVIDER.reconcile?.({
    readSecret: (name) => Promise.resolve(bindings[name] ?? null),
    offer: PLUS_MEMBERSHIP_OFFER,
    now: () => Date.now(),
    fetch: (input, init) => fetch(input, init),
    callbackUrl: `${args.apiOrigin}${membershipCallbackPath(PLUS_MEMBERSHIP_OFFER, STRIPE_PROVIDER)}`,
    log: createLogger({
      name: 'localhost-stack:billing',
      now: () => Date.now(),
    }),
  });
  const endpoint = server.runtime.instance().apiWebhookEndpoints()[0];
  if (endpoint === undefined) {
    await server.close();
    throw new Error('billing: reconcile left the simulated Stripe no webhook');
  }
  return { server, webhookSecret: endpoint.secret };
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

/**
 * Read credential for the shared reports bucket. Loaded once per stack and
 * handed to every API instance, so they list the same commits.
 */
function reportsEnvForStack(): Readonly<Record<string, string>> {
  return reportsDevEnv(loadReportsDevSecrets(REPO_ROOT), GLOBAL.reports.bucket);
}

function startApiNode(args: {
  readonly id: string;
  readonly port: number;
  readonly apiOrigin: string;
  readonly idpEnv: Readonly<Record<string, string>>;
  readonly billing: BillingProvider;
  readonly webOrigin: string | null;
  readonly infraEnv: Readonly<Record<string, string>>;
  readonly reportsEnv: Readonly<Record<string, string>>;
  readonly roomServiceToken: string;
}): ChildProcess {
  return spawn('bun', ['run', 'apps/server/scripts/serve-api-node.ts'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...args.infraEnv,
      ...args.reportsEnv,
      ...args.idpEnv,
      API_NODE_ID: args.id,
      API_NODE_PORT: String(args.port),
      LOCAL_ROOM_SERVICE_TOKEN: args.roomServiceToken,
      SECRETS_ENV: 'dev',
      API_URL: args.apiOrigin,
      AUTH_SECRET,
      // The stack bills through the simulated Stripe alone: no real
      // provider's credentials from the parent environment reach it.
      ...Object.fromEntries(
        MEMBERSHIP_PROVIDER_MODULES.flatMap((module) =>
          module.secrets.map((secret) => [secret.name, ''])
        )
      ),
      BILLING_PROVIDER: STRIPE_PROVIDER,
      [StripeSecretKeys.secretKey]: BILLING_SECRET_KEY,
      [StripeSecretKeys.webhookSecret]: args.billing.webhookSecret,
      [StripeBindingKeys.apiOrigin]: args.billing.server.url,
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
  readonly billing: BillingProvider;
  readonly webOrigin: string | null;
  readonly infra: InfraHandles;
}): Promise<ApiTier> {
  const reportsEnv = reportsEnvForStack();
  const roomServiceToken = crypto.randomUUID();
  process.stdout.write(
    reportsEnv['REPORTS_BUCKET']
      ? `[stack] spec reports: ${GLOBAL.reports.bucket} (every API instance)\n`
      : '[stack] spec reports unavailable: shared read credentials are missing or invalid; continuing startup.\n'
  );
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
        billing: args.billing,
        webOrigin: args.webOrigin,
        infraEnv: args.infra.env,
        reportsEnv,
        roomServiceToken,
      })
    );
    backends.push({
      id,
      origin: `http://127.0.0.1:${String(reservation.port)}`,
    });
  }
  for (const backend of backends) {
    await waitForHttp(`${backend.origin}/api/health`, 90_000);
    // Health only proves the listener bound; this proves the worker booted.
    await waitForApiBooted(backend.origin);
  }
  return { children, backends };
}

async function stopIdps(idps: StackIdps): Promise<void> {
  await Promise.all([idps.google.close(), idps.apple.close()]);
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
  readonly billing: BillingProvider;
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
  let billing: BillingProvider;
  try {
    billing = await startBillingProvider({
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
      billing,
      webOrigin: args.webOrigin,
      infra: args.infra,
    });
    return { billing, api };
  } catch (error) {
    await billing.server.close();
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
    webReservation: options.withWeb ? reservePort(options.webPort ?? 0) : null,
  };
}

export async function bootLocalhostStack(
  options: StackOptions,
  externalWeb = false
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
  const { api, billing } = await startBillingAndApi({
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
    webOrigin === null || externalWeb
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
      await billing.server.close();
      await balancer.stop();
      await infra.stop();
    },
  };
}

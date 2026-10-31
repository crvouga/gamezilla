// @io-wall-ok — tools composition root.

/**
 * Boot the whole product on loopback: backing services, simulated Google,
 * Apple and Stripe, N API instances, the balancer in front of them, and
 * (optionally) the built web bundle.
 *
 * Every port is OS-assigned and every piece of state lives under one
 * instance directory, so several stacks run side by side with no
 * coordination beyond the manifest each one writes. Reports use the local
 * Mockingbird object store; no deployed credentials enter the stack.
 */

import type { ChildProcess } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  createServer as createStripeServer,
  type StripeServer,
} from '@crvouga/mockingbird-service-stripe/server';
import { PLUS_MEMBERSHIP_OFFER } from '@libs/billing-shared-ts/plus-membership-offer';
import { NAMESPACE } from '@libs/product-identity-shared-ts/product-identity';
import type { Denial } from '@pkgs/aedes-server-ts/start';
import { MEMBERSHIP_PROVIDER_MODULES } from '@pkgs/billing-providers-server-ts/billing-providers';
import { membershipCallbackPath } from '@pkgs/billing-root-shared-ts/providers';
import { STRIPE_MEMBERSHIP_PROVIDER } from '@pkgs/billing-stripe-server-ts/provider-module';
import { STRIPE_PROVIDER } from '@pkgs/billing-stripe-server-ts/stripe-membership';
import {
  StripeBindingKeys,
  StripeSecretKeys,
} from '@pkgs/billing-stripe-shared-ts/secret-keys';
import { spawnOwned as spawn } from '@pkgs/dev-owner-server-ts/dev-owner-spawn';
import { createLogger } from '@pkgs/logger-shared-ts/logger';
import type { InfraHandles } from './boot-infra';
import { bootInfra } from './boot-infra';
import type { DatabaseLink } from './database-link';
import type { PortReservation } from './free-port';
import {
  plannedPort,
  reservePort,
  waitForApiBooted,
  waitForHttp,
} from './free-port';
import { startLoadBalancer } from './load-balancer';
import type { LocalAdminIdentity } from './local-admin-accounts';
import { localAdminEnv } from './local-admin-env';
import { localApiEnv } from './local-api-env';
import { configureLocalPopulation } from './local-population';
import { localProcessEnv } from './local-process-env';
import { isolatedSharedDataEnv } from './local-shared-data-env';
import type { StackManifest } from './manifest';
import { instanceDataDir, writeManifest } from './manifest';
import { mockingbirdSqliteFile } from './mockingbird-sqlite';
import {
  expectChildExit,
  observeChildFailures,
  waitForChildDiagnostics,
} from './process-observability';
import type { StackOptions } from './stack-options';
import type { IdpState, StackIdps } from './start-idps';
import { startStackIdps } from './start-idps';
import {
  startSyntheticPopulationSidecars,
  syntheticPopulationStackSecrets,
} from './synthetic-population-sidecars';

const REPO_ROOT = join(import.meta.dir, '../../..');
const BILLING_SECRET_KEY = 'sk_test_localhost_stack';
/**
 * The product web app (`/` and `/harness`). This is Vite itself: the package
 * `dev` script is this stack, so the web child must not call it.
 */
const PRODUCT_DEV_ARGS = [
  'run',
  '--cwd',
  'apps/product-ts',
  'vite',
  '--',
  '--host',
  '127.0.0.1',
] as const;

export type LocalhostStack = {
  readonly manifest: StackManifest;
  readonly manifestPath: string;
  /** What the API's requests asked of the database; null when it had a direct address. */
  readonly databaseLink: DatabaseLink | null;
  /** What the broker refused browsers, as AWS IoT would. */
  brokerDenials(): readonly Denial[];
  stop(): Promise<void>;
};

function nodeId(index: number): string {
  return `api-${String.fromCharCode(97 + index)}`;
}

/** Stripe, simulated, with its webhook endpoint's signing secret. */
export type BillingProvider = {
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
export async function startBillingProvider(args: {
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
export async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    await waitForChildDiagnostics(child);
    return;
  }
  expectChildExit(child);
  const exited = waitForChildExit(child).catch(() => undefined);
  try {
    child.kill('SIGTERM');
  } catch {
    // already gone
  }
  await exited;
  await waitForChildDiagnostics(child);
}

function startApiNode(args: {
  readonly dataDir: string;
  readonly instanceId: string;
  readonly id: string;
  readonly port: number;
  readonly apiOrigin: string;
  readonly idpEnv: Readonly<Record<string, string>>;
  readonly billing: BillingBinding;
  readonly webOrigin: string | null;
  readonly infraEnv: Readonly<Record<string, string>>;
  readonly roomServiceToken: string;
}): ChildProcess {
  const child = spawn(
    'bun',
    ['--no-env-file', 'run', 'apps/server-ts/scripts/serve-api-node.ts'],
    {
      cwd: REPO_ROOT,
      stdio: ['inherit', 'inherit', 'pipe'],
      env: {
        ...localApiEnv(process.env),
        ...args.infraEnv,
        ...args.idpEnv,
        API_NODE_ID: args.id,
        API_NODE_PORT: String(args.port),
        LOCAL_ROOM_SERVICE_TOKEN: args.roomServiceToken,
        API_URL: args.apiOrigin,
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
        [StripeBindingKeys.apiOrigin]: args.billing.origin,
        WEB_CLIENT_ORIGIN: args.webOrigin ?? '',
      },
    }
  );
  observeChildFailures(child, args, `${NAMESPACE}-api-${args.id}`);
  return child;
}

export async function startWeb(args: {
  readonly dataDir: string;
  readonly instanceId: string;
  readonly origin: string;
  readonly apiOrigin: string;
  readonly frozen: boolean;
  readonly testHooks: boolean;
}): Promise<ChildProcess> {
  const child = spawn('bun', PRODUCT_DEV_ARGS, {
    cwd: REPO_ROOT,
    stdio: ['inherit', 'inherit', 'pipe'],
    env: {
      ...localProcessEnv(process.env),
      LOCALHOST_STACK: '1',
      VITE_PORT: new URL(args.origin).port,
      VITE_API_URL: args.apiOrigin,
      VITE_LOCAL_PREVIEW_API_ORIGIN: args.apiOrigin,
      ...(args.frozen ? { PRODUCT_DEV_FROZEN: '1' } : {}),
      ...(args.testHooks ? { VITE_TEST_HOOKS: '1' } : {}),
    },
  });
  observeChildFailures(child, args, `${NAMESPACE}-web`);
  await waitForHttp(`${args.origin}/harness`);
  return child;
}

/**
 * Resolve the provider's SQLite file. `instance` keeps it inside the instance
 * data directory (so `--keep-data` makes it survive, and a wipe takes it with
 * the rest); `path` uses exactly the caller's file and is never removed here.
 */
export function resolveIdpState(
  options: StackOptions,
  dataDir: string
): IdpState {
  if (options.idpStateMode === 'memory') return { mode: 'memory', path: null };
  if (options.idpStateMode === 'instance') {
    return { mode: 'instance', path: join(dataDir, 'idp.sqlite') };
  }
  const path = options.idpStatePath;
  if (path === null) throw new Error('idp state path mode without a path');
  mkdirSync(dirname(path), { recursive: true });
  return { mode: 'path', path };
}

export type ApiTier = {
  readonly children: ChildProcess[];
  readonly backends: { readonly id: string; readonly origin: string }[];
};

/** The webhook secret is all an API node needs to know of the provider. */
export type BillingBinding = {
  readonly origin: string;
  readonly webhookSecret: string;
};

export async function startApiTier(args: {
  readonly sharedDataBindings?: Readonly<Record<string, string>>;
  readonly adminIdentities: readonly LocalAdminIdentity[];
  readonly dataDir: string;
  readonly options: StackOptions;
  readonly apiOrigin: string;
  readonly idpEnv: Readonly<Record<string, string>>;
  readonly billing: BillingBinding;
  readonly webOrigin: string | null;
  /** How the nodes reach the backing services (`infraEnv`). */
  readonly infraEnv: Readonly<Record<string, string>>;
  /** Where the nodes reach Postgres when that is not `infraEnv`'s direct address. */
  readonly nodeDatabaseUrl?: string | undefined;
  readonly syntheticPopulationSecrets: Readonly<Record<string, string>>;
  /** Planned ports, one per node; without them each asks the OS for its own. */
  readonly ports?: readonly number[] | undefined;
}): Promise<ApiTier> {
  const databaseUrl = args.infraEnv['DATABASE_URL'];
  if (databaseUrl === undefined)
    throw new Error('Local API needs DATABASE_URL');
  const adminEnv = await localAdminEnv(databaseUrl, args.adminIdentities);
  const sharedDataEnv =
    args.sharedDataBindings ?? isolatedSharedDataEnv(args.infraEnv);
  const roomServiceToken = crypto.randomUUID();
  const children: ChildProcess[] = [];
  const backends: { readonly id: string; readonly origin: string }[] = [];
  for (let index = 0; index < args.options.apiNodes; index += 1) {
    const planned = args.ports?.[index];
    const reservation =
      planned === undefined ? reservePort() : plannedPort(planned);
    await reservation.release();
    const id = nodeId(index);
    children.push(
      startApiNode({
        dataDir: args.dataDir,
        instanceId: args.options.instanceId,
        id,
        port: reservation.port,
        apiOrigin: args.apiOrigin,
        idpEnv: args.idpEnv,
        billing: args.billing,
        webOrigin: args.webOrigin,
        infraEnv: {
          ...args.infraEnv,
          ...args.syntheticPopulationSecrets,
          ...adminEnv,
          ...sharedDataEnv,
          ...(args.nodeDatabaseUrl === undefined
            ? {}
            : { DATABASE_URL: args.nodeDatabaseUrl }),
        },
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
    await configureLocalPopulation(
      infra.databaseUrl,
      args.options.syntheticPopulationWorkers
    );
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
  readonly sharedDataBindings?: Readonly<Record<string, string>>;
  readonly adminIdentities: readonly LocalAdminIdentity[];
  readonly options: StackOptions;
  readonly apiOrigin: string;
  readonly idpEnv: Readonly<Record<string, string>>;
  readonly billingPort: number;
  readonly releaseBillingPort: () => Promise<void>;
  readonly webOrigin: string | null;
  readonly infra: InfraHandles;
  readonly dataDir: string;
  readonly syntheticPopulationSecrets: Readonly<Record<string, string>>;
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
      ...(args.sharedDataBindings === undefined
        ? {}
        : { sharedDataBindings: args.sharedDataBindings }),
      adminIdentities: args.adminIdentities,
      dataDir: args.dataDir,
      options: args.options,
      apiOrigin: args.apiOrigin,
      idpEnv: args.idpEnv,
      billing: {
        origin: billing.server.url,
        webhookSecret: billing.webhookSecret,
      },
      webOrigin: args.webOrigin,
      infraEnv: args.infra.env,
      nodeDatabaseUrl: args.infra.databaseLink?.url,
      syntheticPopulationSecrets: args.syntheticPopulationSecrets,
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

async function startApplicationClients(input: {
  dataDir: string;
  options: StackOptions;
  apiOrigin: string;
  webOrigin: string | null;
  webReservation: PortReservation | null;
  externalWeb: boolean;
  token: string;
}): Promise<() => Promise<void>> {
  const children: ChildProcess[] = [];
  const stop = async () => {
    await Promise.all(children.map(stopChild));
  };
  try {
    await startSyntheticPopulationSidecars({
      repoRoot: REPO_ROOT,
      origin: input.apiOrigin,
      count: input.options.syntheticPopulationWorkers,
      token: input.token,
      track: (child) => children.push(child),
    });
    await input.webReservation?.release();
    if (input.webOrigin !== null && !input.externalWeb)
      children.push(
        await startWeb({
          dataDir: input.dataDir,
          instanceId: input.options.instanceId,
          origin: input.webOrigin,
          apiOrigin: input.apiOrigin,
          frozen: input.options.frozenWeb,
          testHooks: input.options.testHooks,
        })
      );
    return stop;
  } catch (error) {
    await stop();
    throw error;
  }
}

function backingServiceManifest(infra: InfraHandles) {
  return {
    databaseUrl: infra.databaseUrl,
    s3Endpoint: infra.s3Endpoint,
    mqttWssUrl: infra.mqttWssUrl,
    mqttUrl: infra.mqttUrl,
    observabilityCollectorUrl: infra.observabilityCollectorUrl,
    observabilityTraceDir: infra.observabilityTraceDir,
    observabilityTempoUrl: infra.observabilityTempoUrl,
    observabilityGrafanaUrl: infra.observabilityGrafanaUrl,
  };
}

function sharedSourceOptions(
  mode: 'shared' | 'isolated',
  env: Readonly<Record<string, string>>
) {
  return mode === 'isolated'
    ? { sharedDataBindings: isolatedSharedDataEnv(env) }
    : {};
}

function stackManifest(args: {
  readonly options: StackOptions;
  readonly dataDir: string;
  readonly api: ApiTier;
  readonly infra: InfraHandles;
  readonly origins: {
    readonly api: string;
    readonly web: string;
    readonly billing: string;
    readonly google: string;
    readonly apple: string;
  };
}): StackManifest {
  return {
    instanceId: args.options.instanceId,
    startedAtMs: Date.now(),
    apiOrigin: args.origins.api,
    apiNodes: args.api.backends,
    webOrigin: args.origins.web,
    idpOrigins: { google: args.origins.google, apple: args.origins.apple },
    billingOrigin: args.origins.billing,
    ...backingServiceManifest(args.infra),
    dataDir: args.dataDir,
  };
}

/**
 * The balancer in front of the API nodes, over the network `options` asks
 * for, on the port it was holding.
 */
async function startIngress(
  reservation: PortReservation,
  backends: Parameters<typeof startLoadBalancer>[0]['backends'],
  options: StackOptions
): Promise<ReturnType<typeof startLoadBalancer>> {
  await reservation.release();
  const balancer = startLoadBalancer({
    port: reservation.port,
    backends,
    latency: {
      ms: options.edgeLatencyMs,
      sleep: (ms) => Bun.sleep(ms),
    },
  });
  await waitForHttp(`${balancer.origin}/api/health`);
  return balancer;
}

/** What a run reads back from the backing services once it is over. */
function stackProbes(
  infra: InfraHandles
): Pick<LocalhostStack, 'databaseLink' | 'brokerDenials'> {
  return {
    databaseLink: infra.databaseLink,
    brokerDenials: infra.brokerDenials,
  };
}

export async function bootLocalhostStack(
  options: StackOptions,
  externalWeb = false,
  sourceStorage: 'shared' | 'isolated' = 'shared'
): Promise<LocalhostStack> {
  const dataDir = instanceDataDir(REPO_ROOT, options);
  const syntheticPopulationSecrets = syntheticPopulationStackSecrets(dataDir);
  const idpState = resolveIdpState(options, dataDir);
  const { lbReservation, idpReservations, billingReservation, webReservation } =
    reserveStackPorts(options);
  const webOrigin = webReservation && loopback(webReservation.port);
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
    ...sharedSourceOptions(sourceStorage, infra.env),
    adminIdentities: idps.adminIdentities,
    options,
    apiOrigin,
    idpEnv: idps.apiEnv,
    billingPort: billingReservation.port,
    releaseBillingPort: () => billingReservation.release(),
    webOrigin,
    infra,
    dataDir,
    syntheticPopulationSecrets,
    // Unwind what already booted if the provider or an API node fails.
    unwind: async () => {
      await stopIdps(idps);
      await infra.stop();
    },
  });
  const balancer = await startIngress(lbReservation, api.backends, options);
  const stopClients = await startApplicationClients({
    dataDir,
    options,
    apiOrigin: balancer.origin,
    webOrigin,
    webReservation,
    externalWeb,
    token: syntheticPopulationSecrets['POPULATION_WORKER_TOKEN']!,
  }).catch(async (error: unknown) => {
    await Promise.all(api.children.map(stopChild));
    await stopIdps(idps);
    await billing.server.close();
    await balancer.stop();
    await infra.stop();
    throw error;
  });

  const manifest = stackManifest({
    options,
    dataDir,
    api,
    infra,
    origins: {
      api: balancer.origin,
      web: webOrigin ?? '',
      billing: billingOrigin,
      google: loopback(idpReservations.google.port),
      apple: loopback(idpReservations.apple.port),
    },
  });
  return {
    manifest,
    manifestPath: writeManifest(REPO_ROOT, manifest),
    ...stackProbes(infra),
    async stop() {
      await stopClients();
      await Promise.all(api.children.map((child) => stopChild(child)));
      await stopIdps(idps);
      await billing.server.close();
      await balancer.stop();
      await infra.stop();
    },
  };
}

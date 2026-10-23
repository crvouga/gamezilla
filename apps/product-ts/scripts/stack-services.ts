// @io-wall-ok — tools composition root.

/**
 * How the stack's processes find each other.
 *
 * Each service is its own Turborepo task (`dev:<service>`), and a task cannot
 * depend on one that never exits. So a service publishes what its dependents
 * need to its instance directory once it can serve, and a dependent waits for
 * that file: the address and the readiness signal are the same thing. A
 * service the options turn off publishes `off`, and one that could not start
 * publishes why, so nothing waits out a timeout on a service that is not
 * coming.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import type { LocalAdminIdentity } from './local-admin-accounts';
import type { StackPlan } from './stack-plan';

/** What each service tells the ones that depend on it. */
export type StackServices = {
  readonly postgres: { readonly databaseUrl: string };
  readonly openai: { readonly url: string };
  readonly s3: { readonly endpoint: string };
  readonly mqtt: { readonly wssUrl: string; readonly mqttUrl: string };
  readonly observability: {
    readonly collectorUrl: string;
    readonly logsUrl: string;
    readonly metricsUrl: string;
    readonly traceDir: string | null;
    readonly tempoUrl: string | null;
    readonly grafanaUrl: string | null;
  };
  readonly idp: {
    readonly adminIdentities: readonly LocalAdminIdentity[];
    readonly google: string;
    readonly apple: string;
    /** Worker bindings for both providers. */
    readonly apiEnv: Readonly<Record<string, string>>;
  };
  readonly billing: { readonly origin: string; readonly webhookSecret: string };
  readonly server: {
    /** The balancer, never an instance. */
    readonly apiOrigin: string;
    readonly nodes: readonly { readonly id: string; readonly origin: string }[];
  };
  readonly population: { readonly workers: number };
  readonly web: { readonly origin: string };
};

export type ServiceName = keyof StackServices;

export const SERVICE_NAMES = [
  'postgres',
  'openai',
  's3',
  'mqtt',
  'observability',
  'idp',
  'billing',
  'server',
  'population',
  'web',
] as const satisfies readonly ServiceName[];

type Published<T> =
  | { readonly state: 'ready'; readonly value: T }
  | { readonly state: 'off' }
  | { readonly state: 'failed'; readonly reason: string };

const WAIT_MS = 300_000;
const POLL_MS = 100;

function servicePath(plan: StackPlan, name: ServiceName): string {
  return join(plan.dataDir, 'services', `${name}.json`);
}

function publish<K extends ServiceName>(
  plan: StackPlan,
  name: K,
  published: Published<StackServices[K]>
): void {
  const path = servicePath(plan, name);
  mkdirSync(join(plan.dataDir, 'services'), { recursive: true });
  // Renamed into place: a waiting process never reads half a file.
  const temp = `${path}.${String(process.pid)}.tmp`;
  writeFileSync(temp, JSON.stringify(published), 'utf8');
  renameSync(temp, path);
}

export function publishReady<K extends ServiceName>(
  plan: StackPlan,
  name: K,
  value: StackServices[K]
): void {
  publish(plan, name, { state: 'ready', value });
}

export function publishOff(plan: StackPlan, name: ServiceName): void {
  publish(plan, name, { state: 'off' });
}

export function publishFailed(
  plan: StackPlan,
  name: ServiceName,
  reason: string
): void {
  publish(plan, name, { state: 'failed', reason });
}

/** A stopped service is no longer there to be found. */
export function withdrawService(plan: StackPlan, name: ServiceName): void {
  rmSync(servicePath(plan, name), { force: true });
}

/** Every service starts from nothing published: the last boot's are stale. */
export function withdrawAllServices(dataDir: string): void {
  rmSync(join(dataDir, 'services'), { recursive: true, force: true });
}

/**
 * What `name` published, once it can serve; null when this stack runs without
 * it. Throws when the service failed to start or never came up.
 */
export async function awaitService<K extends ServiceName>(
  plan: StackPlan,
  name: K,
  timeoutMs = WAIT_MS
): Promise<StackServices[K] | null> {
  const path = servicePath(plan, name);
  const deadline = Date.now() + timeoutMs;
  while (!existsSync(path)) {
    if (Date.now() >= deadline) {
      throw new Error(`timed out waiting for ${name} to start`);
    }
    await Bun.sleep(POLL_MS);
  }
  const published = JSON.parse(readFileSync(path, 'utf8')) as Published<
    StackServices[K]
  >;
  if (published.state === 'failed') {
    throw new Error(`${name} failed to start: ${published.reason}`);
  }
  return published.state === 'off' ? null : published.value;
}

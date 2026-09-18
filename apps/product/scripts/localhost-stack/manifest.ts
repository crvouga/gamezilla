// @io-wall-ok — tools composition root.

/**
 * The address book for one running stack.
 *
 * Every port in a stack is OS-assigned, so nothing can be hard-coded by a
 * consumer. The manifest is the single published answer to "where is this
 * instance?", written to disk under the instance id so several stacks (and
 * several test runs) coexist without negotiating.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const STACK_MANIFEST_ENV = 'LOCALHOST_STACK_MANIFEST';

export type StackManifest = {
  readonly instanceId: string;
  readonly startedAtMs: number;
  /** The single API origin: a round-robin balancer, never an instance. */
  readonly apiOrigin: string;
  /** Instances behind the balancer, in rotation order. */
  readonly apiNodes: readonly {
    readonly id: string;
    readonly origin: string;
  }[];
  readonly webOrigin: string;
  /** Simulated Google, on its own origin with its own state. */
  readonly idpOrigin: string;
  readonly databaseUrl: string;
  readonly s3Endpoint: string | null;
  readonly mqttWssUrl: string | null;
  readonly mqttUrl: string | null;
  readonly dataDir: string;
};

export function stackRootDir(repoRoot: string): string {
  return join(repoRoot, '.cache', 'localhost-stack');
}

export function manifestPath(repoRoot: string, instanceId: string): string {
  return join(stackRootDir(repoRoot), `${instanceId}.json`);
}

export function writeManifest(
  repoRoot: string,
  manifest: StackManifest
): string {
  const path = manifestPath(repoRoot, manifest.instanceId);
  mkdirSync(stackRootDir(repoRoot), { recursive: true });
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return path;
}

export function readManifest(path: string): StackManifest {
  return JSON.parse(readFileSync(path, 'utf8')) as StackManifest;
}

export function removeManifest(repoRoot: string, instanceId: string): void {
  rmSync(manifestPath(repoRoot, instanceId), { force: true });
}

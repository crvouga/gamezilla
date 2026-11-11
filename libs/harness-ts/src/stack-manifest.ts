/**
 * Read the address book of a running localhost stack.
 *
 * Nothing here assumes a port: a stack publishes its manifest path in
 * `LOCALHOST_STACK_MANIFEST`, which is the only coupling between the tests
 * and the system under test.
 */

import type { StackIdpOrigins } from './stack-idp-accounts';

export type StackAddresses = {
  readonly apiOrigin: string;
  readonly webOrigin: string;
  readonly idpOrigins: StackIdpOrigins;
  readonly databaseUrl: string;
  /**
   * The broker over WebSocket. Spec workers resolve packages under the
   * `browser` condition, where the MQTT client speaks only WebSocket.
   */
  readonly mqttWssUrl: string | null;
  readonly mqttUrl: string | null;
};

/**
 * A run's seed on a shared stack. Every scenario writes into the one stack
 * database, so a fixed seed would have concurrent runs mint the same ids
 * (two matched games with one match id, and the second never created). The
 * report records the seed, so a run can still be replayed.
 */
export function stackRunSeed(): number {
  const [value = 1] = crypto.getRandomValues(new Uint32Array(1));
  return value >>> 1;
}

export const STACK_MANIFEST_ENV = 'LOCALHOST_STACK_MANIFEST';

export function stackManifestPath(): string | null {
  const raw = process.env[STACK_MANIFEST_ENV]?.trim();
  return raw !== undefined && raw.length > 0 ? raw : null;
}

/** Throws when the caller asked for stack mode without a running stack. */
export async function readStackAddresses(): Promise<StackAddresses> {
  const path = stackManifestPath();
  if (path === null) {
    throw new Error(
      `${STACK_MANIFEST_ENV} is required for stack mode — start one with \`bun run dev\``
    );
  }
  const { readFileSync } = await import('node:fs');
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as StackAddresses;
  return parsed;
}

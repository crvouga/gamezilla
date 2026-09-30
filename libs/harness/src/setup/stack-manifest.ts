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
};

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

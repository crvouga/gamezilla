// @io-wall-ok — live health: this environment's secrets, exported live.
/**
 * This environment's secrets as the secret store holds them now, exported
 * once per scenario into the world's memo. The process env `secrets-run`
 * injected at the start of a run can be stale: an apply may have replaced a
 * value since.
 */

import { expect } from 'bun:test';
import { exportSecretsMapLive } from '@libs/secrets-server/secrets-io';
import type { LiveWorld } from './live-world';

const STORED = 'stored-secrets';

/** This environment's secrets, exported from the secret store once per scenario. */
export async function liveSecrets(
  w: LiveWorld
): Promise<ReadonlyMap<string, string>> {
  const memo = w.memo.get(STORED) as ReadonlyMap<string, string> | undefined;
  if (memo !== undefined) return memo;
  const exported = await exportSecretsMapLive(w.env.env);
  expect(exported.size).toBeGreaterThan(0);
  w.memo.set(STORED, exported);
  return exported;
}

/** One secret's trimmed live value, or `''` when it is not set. */
export async function liveSecretOrEmpty(
  w: LiveWorld,
  name: string
): Promise<string> {
  return (await liveSecrets(w)).get(name)?.trim() ?? '';
}

/** One secret's live value; throws when it is not set. */
export async function liveSecret(w: LiveWorld, name: string): Promise<string> {
  const value = await liveSecretOrEmpty(w, name);
  if (value.length === 0) {
    throw new Error(`${name} is missing from ${w.env.env}'s secrets`);
  }
  return value;
}

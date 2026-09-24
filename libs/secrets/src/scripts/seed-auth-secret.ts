#!/usr/bin/env bun
/**
 * One-shot: rename BETTER_AUTH_SECRET → AUTH_SECRET (if present), then
 * seed AUTH_SECRET in any env still missing it. Safe to re-run.
 * For a fresh secrets env, before the first provision has seeded it.
 * Allowlisted for better-auth vocabulary (legacy secret name only).
 */
import { ok } from '../shared/fmt';
import { SECRETS_ENVS } from '../shared/secrets/secret';
import {
  deleteSecretIn,
  ensureSeedInAllEnvsSecrets,
  exportSecretsMapLive,
  setSecretIn,
} from '../shared/secrets/secrets';

const LEGACY = 'BETTER_AUTH_SECRET';

for (const env of SECRETS_ENVS) {
  const stored = await exportSecretsMapLive(env);
  const current = (stored.get('AUTH_SECRET') ?? '').trim();
  const legacy = (stored.get(LEGACY) ?? '').trim();

  if (current.length === 0 && legacy.length > 0) {
    await setSecretIn(env, 'AUTH_SECRET', legacy);
    ok('AUTH_SECRET', `renamed from ${LEGACY} in ${env}`);
  } else if (current.length > 0) {
    ok('AUTH_SECRET', `already present in ${env}`);
  }

  if (legacy.length > 0) {
    try {
      await deleteSecretIn(env, LEGACY);
      ok(LEGACY, `purged orphan from ${env}`);
    } catch (e) {
      console.warn(
        `Failed to purge ${env}/${LEGACY}: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
}

const seeded = await ensureSeedInAllEnvsSecrets();
for (const r of seeded) {
  if (r.name !== 'AUTH_SECRET') continue;
  if (r.action === 'seeded') {
    ok(r.name, `seeded in ${r.env}`);
  } else {
    ok(r.name, `present in ${r.env}`);
  }
}

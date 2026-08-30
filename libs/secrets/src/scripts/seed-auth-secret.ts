#!/usr/bin/env bun
/**
 * One-shot: rename BETTER_AUTH_SECRET → AUTH_SECRET (if present), then
 * seed AUTH_SECRET in any env still missing it. Safe to re-run.
 */
import { ok } from '../shared/fmt';
import { SECRETS_ENVS } from '../shared/secrets/secret';
import {
  ensureSeedInAllEnvsSecrets,
  exportSecretsMap,
  setSecretIn,
} from '../shared/secrets/secrets';

const LEGACY = 'BETTER_AUTH_SECRET';

for (const env of SECRETS_ENVS) {
  const stored = await exportSecretsMap(env);
  const current = (stored.get('AUTH_SECRET') ?? '').trim();
  if (current.length > 0) {
    ok('AUTH_SECRET', `already present in ${env}`);
    continue;
  }
  const legacy = (stored.get(LEGACY) ?? '').trim();
  if (legacy.length === 0) continue;
  await setSecretIn(env, 'AUTH_SECRET', legacy);
  ok('AUTH_SECRET', `renamed from ${LEGACY} in ${env}`);
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

#!/usr/bin/env bun
/**
 * Converge every environment on the shared secrets environment (see
 * `shared-reconcile.ts`), in two phases around the fleet stack's apply
 * (the Release workflow's deploy:fleet job):
 *
 *   promote  copy unanimous values into the shared env (additive; the fleet
 *            apply itself reads its state passphrase from there)
 *   prune    delete the copies that would shadow the import — only after the
 *            fleet apply gave every environment that import
 *
 * Either phase fails, changing nothing for that name, on a copy that
 * disagrees. Both are no-ops once converged.
 *
 *   SECRETS_ENV=shared bun run libs/secrets-server-ts/scripts/secrets-run.ts -- \
 *     bun run libs/secrets-server-ts/scripts/secrets-reconcile-shared.ts <promote|prune>
 */
// @io-wall-ok — composition root (Infisical admin CLI)
import { ENV_FILES } from '@libs/infra-shared-ts/envs';
import { ok, warn } from '@libs/secrets-server-ts/fmt';
import {
  deleteSecretIn,
  exportOwnSecretsLive,
  setSecretIn,
} from '@libs/secrets-server-ts/secrets-io';
import { planSharedReconcile } from '@libs/secrets-shared-ts/shared-reconcile';
import {
  SHARED_SECRET_NAMES,
  SHARED_SECRETS_ENV,
} from '@libs/secrets-shared-ts/shared-secrets';

type Phase = 'promote' | 'prune';

function parsePhase(argv: readonly string[]): Phase {
  const phase = argv.find((arg) => arg !== '--');
  if (phase === 'promote' || phase === 'prune') return phase;
  throw new Error('usage: secrets-reconcile-shared.ts <promote|prune>');
}

async function main(): Promise<number> {
  const phase = parsePhase(process.argv.slice(2));
  const envs = new Map<string, ReadonlyMap<string, string>>();
  for (const env of Object.keys(ENV_FILES)) {
    envs.set(env, await exportOwnSecretsLive(env));
  }
  const plan = planSharedReconcile({
    names: SHARED_SECRET_NAMES,
    shared: await exportOwnSecretsLive(SHARED_SECRETS_ENV),
    envs,
  });
  for (const { name, value } of phase === 'promote' ? plan.promote : []) {
    await setSecretIn(SHARED_SECRETS_ENV, name, value);
    ok(name, `promoted to ${SHARED_SECRETS_ENV}`);
  }
  // Pruning waits for `promote`: a copy is only deleted once shared has it.
  const prunable = plan.promote.length === 0 ? plan.remove : [];
  for (const { env, name } of phase === 'prune' ? prunable : []) {
    await deleteSecretIn(env, name);
    ok(
      name,
      `removed from ${env} (read through the ${SHARED_SECRETS_ENV} import)`
    );
  }
  for (const conflict of plan.conflicts) warn('conflict', conflict);
  if (plan.conflicts.length > 0) {
    console.error(
      `secrets-reconcile-shared: ${String(plan.conflicts.length)} secret(s) differ between environments — set the right value with \`bun run secrets:seed -- --force <NAME>\` (writes ${SHARED_SECRETS_ENV}), then delete the stale copies.`
    );
    return 1;
  }
  ok(
    'secrets-reconcile-shared',
    phase === 'promote'
      ? `the ${SHARED_SECRETS_ENV} environment holds every shared secret`
      : 'every environment reads shared secrets through its import'
  );
  return 0;
}

process.exit(await main());

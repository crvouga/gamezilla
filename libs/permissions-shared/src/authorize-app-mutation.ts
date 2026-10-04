import type { MutationAuthorize } from '@pkgs/sync-engine-shared/mutations-types';
import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';
import {
  applyConsume,
  consumeQuotaArgs,
  consumeQuotaMutation,
} from './consume-quota-mutation';
import { decideForActor } from './decide-for-actor';
import { MUTATION_ACTIONS } from './mutation-actions';
import { PERMISSION } from './permission-catalog';
import { decidePrivacyAccess } from './privacy-permission';

/**
 * Server-authoritative consume: the window uses the host clock, so a device
 * clock set forward or backward cannot mint quota; the body that follows
 * finds the key consumed and is a no-op.
 */
async function consumeWithServerClock(ctx: {
  readonly name: string;
  readonly args: unknown;
  readonly tx: Parameters<MutationAuthorize>[0]['tx'];
  readonly env: Parameters<MutationAuthorize>[0]['env'];
  readonly nowMs: number;
  readonly clientAtMs: number;
}): Promise<void> {
  if (ctx.name !== consumeQuotaMutation.name) {
    throw new MutationError(
      'undeclared_action',
      `Mutation ${ctx.name} is not a known quota consumer.`
    );
  }
  const parsed = consumeQuotaArgs.safeParse(ctx.args);
  if (!parsed.success) {
    throw new MutationError('INVALID_ARGS', 'Malformed consume args.');
  }
  await applyConsume(ctx.tx, ctx.env, parsed.data, {
    nowMs: ctx.nowMs,
    clientAtMs: ctx.clientAtMs,
  });
}

/**
 * Server replay guard (§22.6): every mutation must be declared in
 * `MUTATION_ACTIONS`; a declared action is decided under the policy version
 * active at the client timestamp with facts read in the replay transaction.
 * Denials are permanent rejections carrying the decision.
 */
export const authorizeAppMutation: MutationAuthorize = async ({
  name,
  args,
  tx,
  env,
  serverNow,
}) => {
  const declared = MUTATION_ACTIONS[name];
  if (declared === undefined) {
    throw new MutationError(
      'undeclared_action',
      `Mutation ${name} declares no permission.`
    );
  }
  if (declared === 'public') return;
  const nowMs = serverNow().getTime();
  const clientAtMs = Math.min(env.now().getTime(), nowMs);
  if (declared === 'quota') {
    await consumeWithServerClock({ name, args, tx, env, nowMs, clientAtMs });
    return;
  }
  const accountDecision = await decideForActor(tx, {
    identity: env,
    key: declared,
    nowMs,
    clientAtMs,
  });
  const decision =
    declared === PERMISSION.profileDeleteAccount ||
    declared === PERMISSION.profileExportData
      ? decidePrivacyAccess(accountDecision, {
          connected: true,
          authenticatedAtMs: env.authenticatedAtMs ?? null,
          nowMs,
        })
      : accountDecision;
  if (!decision.allowed) {
    throw new MutationError(
      decision.reason ?? 'not_granted',
      `Permission denied: ${declared}`,
      { decision }
    );
  }
};

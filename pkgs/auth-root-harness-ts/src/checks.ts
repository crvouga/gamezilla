/** Comparing what happened to what the model predicted, and recording drift. */

import { hashAuthSecret } from '@pkgs/auth-inhouse-shared-ts/token-hash';
import sql from '@pkgs/sql-root-shared-ts/sql';

import { AUTH_SYSTEM_SECRET } from './relying-party';
import type { ActorOutcome, ActorState, AuthSurface } from './types';

export function violate(s: AuthSurface, message: string): void {
  s.violations.push(message);
}

/** Count one observed outcome (e.g. `signIn:linked`, `unlink:error:last_identity`). */
export function tally(s: AuthSurface, key: string): void {
  s.outcomes[key] = (s.outcomes[key] ?? 0) + 1;
}

function show(outcome: ActorOutcome): string {
  if (outcome.kind === 'error') return `error:${outcome.code}`;
  if (outcome.kind === 'failed') return `failed:${outcome.message}`;
  return outcome.kind;
}

/** `true` when the outcome has the expected kind (and code, for errors). */
export function expectOutcome(
  s: AuthSurface,
  context: string,
  outcome: ActorOutcome,
  expected: 'ok' | 'failed' | 'link_required' | { readonly error: string }
): boolean {
  const matches =
    typeof expected === 'string'
      ? outcome.kind === expected
      : outcome.kind === 'error' && outcome.code === expected.error;
  const flow = context.split(' ').slice(1, 2).join('');
  tally(
    s,
    `${flow}:${typeof expected === 'string' ? expected : `error:${expected.error}`}`
  );
  if (!matches) {
    const want =
      typeof expected === 'string' ? expected : `error:${expected.error}`;
    violate(s, `${context}: expected ${want}, got ${show(outcome)}`);
  }
  return matches;
}

/** The user the actor's bearer verifies as right now, or `null`. */
export async function sessionUserOf(
  s: AuthSurface,
  actor: ActorState
): Promise<string | null> {
  const bearer = await actor.bearerStore.read();
  if (bearer === null) return null;
  const verified = await s.store.server.verifySessionToken(bearer);
  return verified?.externalUserId ?? null;
}

/** Which user a pending-link token is parked against (read from the store). */
export async function pendingTargetOf(
  s: AuthSurface,
  token: string
): Promise<string | null> {
  const rows = await s.store.sql.query(sql<{ target_user_id: string }>`
    SELECT target_user_id FROM idp_pending_links
    WHERE token_hash = ${hashAuthSecret(AUTH_SYSTEM_SECRET, token)}
    LIMIT 1
  `);
  return rows[0]?.target_user_id ?? null;
}

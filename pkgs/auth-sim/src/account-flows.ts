/**
 * What a signed-in device does to its own account: link or unlink a sign-in
 * method, sign out here, sign out everywhere — predicted, then checked.
 */

import { AUTH_ERROR, type OauthProviderId } from '@pkgs/auth/shared';
import { AUTH_LINK_TICKET_TTL_MS } from '@pkgs/auth-inhouse/shared';

import { runClient } from './actor';
import { expectOutcome, sessionUserOf, violate } from './checks';
import { expectedUserOf } from './client-flows';
import {
  attachIdentity,
  endToken,
  endUserSessions,
  identitiesOf,
  identityKey,
  predictLink,
  refreshIdentity,
  startSession,
} from './model';
import type { ActorState, AuthSurface, ProviderAnswers } from './types';
import { providerVerdict, seenIdentity } from './world';

/** The port refreshes a cached ticket this long before it would expire. */
const TICKET_MARGIN_MS = 60_000;

function cachedTicket(
  s: AuthSurface,
  actor: ActorState,
  bearer: string | null
): boolean {
  const ticket = actor.ticket;
  return (
    ticket !== null &&
    bearer !== null &&
    ticket.bearer === bearer &&
    ticket.expiresAtMs - TICKET_MARGIN_MS > s.session.ports.clock.now()
  );
}

/**
 * The account screen mints a ticket ahead of the tap. It sticks only when
 * the mint reached a live session; a cached one for this bearer is reused.
 */
export async function prepareLinkFlow(
  s: AuthSurface,
  actor: ActorState
): Promise<void> {
  const bearer = await actor.bearerStore.read();
  const reused = cachedTicket(s, actor, bearer);
  await actor.port.prepareLink().catch(() => undefined);
  if (reused || bearer === null || !actor.online) return;
  if (expectedUserOf(s, actor) === null) return;
  actor.ticket = {
    bearer,
    expiresAtMs: s.session.ports.clock.now() + AUTH_LINK_TICKET_TTL_MS,
  };
}

/**
 * Whether a link launch gets past its ticket. A cached ticket is spent
 * without asking the server first, so a dead session surfaces as an
 * `expired` launch; without one, the mint itself is refused (`failed`).
 */
function ticketVerdict(
  actor: ActorState,
  args: { readonly cached: boolean; readonly live: boolean }
): 'failed' | 'expired' | null {
  if (!actor.online) return 'failed';
  if (args.live) return null;
  return args.cached ? 'expired' : 'failed';
}

/** Linking swaps the device onto a fresh session and retires the old one. */
async function expectSwappedSession(
  s: AuthSurface,
  actor: ActorState,
  args: {
    readonly context: string;
    readonly userId: string;
    readonly previous: string | null;
  }
): Promise<void> {
  const { context, userId, previous } = args;
  if (previous !== null) endToken(s.model, previous);
  const user = await sessionUserOf(s, actor);
  const token = await actor.bearerStore.read();
  if (user !== userId || token === null) {
    violate(s, `${context}: now signed in as ${String(user)}`);
    return;
  }
  startSession(s.model, actor.id, {
    userId,
    token,
    nowMs: s.session.ports.clock.now(),
  });
}

export async function linkFlow(
  s: AuthSurface,
  actor: ActorState,
  provider: OauthProviderId,
  answers: ProviderAnswers
): Promise<void> {
  const context = `${actor.id} link ${provider} as ${answers.email}`;
  actor.answers = answers;
  const userId = expectedUserOf(s, actor);
  const previous = s.model.sessions.get(actor.id)?.token ?? null;
  const bearer = await actor.bearerStore.read();
  const cached = cachedTicket(s, actor, bearer);
  const seen = actor.online
    ? await seenIdentity(s.store, provider, answers)
    : null;
  const verdict = actor.online
    ? await providerVerdict(s.store, provider, answers, seen)
    : null;
  const outcome = await runClient(actor, () =>
    actor.port.linkProvider(provider)
  );
  const gate =
    bearer === null
      ? 'failed'
      : ticketVerdict(actor, { cached, live: userId !== null });
  // A launch spends the ticket (cached or freshly minted) whatever follows.
  if (bearer !== null && (cached || gate === null)) actor.ticket = null;
  if (gate !== null || userId === null) {
    expectOutcome(
      s,
      context,
      outcome,
      gate === 'expired' ? { error: AUTH_ERROR.expired } : 'failed'
    );
    return;
  }
  if (verdict !== null || seen === null) {
    expectOutcome(s, context, outcome, {
      error: verdict ?? AUTH_ERROR.cancelled,
    });
    return;
  }
  const prediction = predictLink(s.model, userId, seen);
  if (prediction.kind === 'error') {
    expectOutcome(s, context, outcome, { error: prediction.code });
    return;
  }
  if (!expectOutcome(s, context, outcome, 'ok')) return;
  if (prediction.kind === 'existing') refreshIdentity(s.model, seen);
  else attachIdentity(s.model, userId, seen);
  await expectSwappedSession(s, actor, { context, userId, previous });
}

export async function unlinkFlow(
  s: AuthSurface,
  actor: ActorState,
  provider: OauthProviderId
): Promise<void> {
  const context = `${actor.id} unlink ${provider}`;
  const userId = expectedUserOf(s, actor);
  const outcome = await runClient(actor, () =>
    actor.port.unlinkProvider(provider)
  );
  if (!actor.online || userId === null) {
    expectOutcome(s, context, outcome, 'failed');
    return;
  }
  const mine = identitiesOf(s.model, userId);
  const target = mine.find((row) => row.provider === provider);
  if (target !== undefined && mine.length <= 1) {
    expectOutcome(s, context, outcome, { error: AUTH_ERROR.lastIdentity });
    return;
  }
  if (!expectOutcome(s, context, outcome, 'ok') || target === undefined) return;
  s.model.identities.delete(identityKey(target.provider, target.sub));
}

/**
 * Signing out always forgets the bearer locally; the server only revokes
 * the session when the request gets through — offline, copies stay valid.
 */
export async function signOutFlow(
  s: AuthSurface,
  actor: ActorState
): Promise<void> {
  const token = s.model.sessions.get(actor.id)?.token ?? null;
  const held = (await actor.bearerStore.read()) !== null;
  const outcome = await runClient(actor, () => actor.port.signOut());
  const reaches = actor.online || !held;
  expectOutcome(s, `${actor.id} sign out`, outcome, reaches ? 'ok' : 'failed');
  s.model.sessions.delete(actor.id);
  if (actor.online && token !== null) endToken(s.model, token);
}

export async function signOutEverywhereFlow(
  s: AuthSurface,
  actor: ActorState
): Promise<void> {
  const context = `${actor.id} sign out everywhere`;
  const userId = expectedUserOf(s, actor);
  const outcome = await runClient(actor, () => actor.port.signOutEverywhere());
  if (!actor.online || userId === null) {
    expectOutcome(s, context, outcome, 'failed');
    return;
  }
  if (expectOutcome(s, context, outcome, 'ok'))
    endUserSessions(s.model, userId);
}

/** Copy one device's bearer onto another, as a stolen token would be. */
export async function stealBearerFlow(
  s: AuthSurface,
  from: ActorState,
  to: ActorState
): Promise<void> {
  const bearer = await from.bearerStore.read();
  if (bearer === null) await to.bearerStore.clear();
  else await to.bearerStore.write(bearer);
  to.bearer = bearer;
  const session = s.model.sessions.get(from.id);
  if (session === undefined) s.model.sessions.delete(to.id);
  else s.model.sessions.set(to.id, { ...session });
}

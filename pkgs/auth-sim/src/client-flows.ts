/**
 * What one device does, each step predicted by the model first and checked
 * after. Every flow goes through the production client port, so the check is
 * end to end: client adapter → auth app → provider → callback → exchange.
 */

import {
  AUTH_ERROR,
  AUTH_PENDING_LINK_TTL_MS,
  type OauthProviderId,
  strategyForProvider,
} from '@pkgs/auth/shared';

import { runClient } from './actor';
import {
  expectOutcome,
  pendingTargetOf,
  sessionUserOf,
  tally,
  violate,
} from './checks';
import {
  attachIdentity,
  expectedUser,
  identitiesOf,
  identityKey,
  type Prediction,
  predictConfirm,
  predictSignIn,
  refreshIdentity,
  type SeenIdentity,
  startSession,
} from './model';
import type {
  ActorOutcome,
  ActorState,
  AuthSurface,
  ProviderAnswers,
} from './types';
import { providerVerdict, seenIdentity } from './world';

function now(s: AuthSurface): number {
  return s.session.ports.clock.now();
}

/** A successful outcome: the actor must now be signed in as `allowed`. */
async function settleSignedIn(
  s: AuthSurface,
  actor: ActorState,
  context: string,
  allowed: readonly string[] | 'new'
): Promise<string | null> {
  const user = await sessionUserOf(s, actor);
  const token = await actor.bearerStore.read();
  if (user === null || token === null) {
    violate(s, `${context}: reported success but holds no valid session`);
    return null;
  }
  const ok =
    allowed === 'new' ? !s.model.users.has(user) : allowed.includes(user);
  if (!ok) {
    violate(s, `${context}: signed in as ${user}, expected ${String(allowed)}`);
  }
  startSession(s.model, actor.id, { userId: user, token, nowMs: now(s) });
  return user;
}

async function settleLinkRequired(
  s: AuthSurface,
  actor: ActorState,
  args: { context: string; seen: SeenIdentity; targets: readonly string[] },
  outcome: ActorOutcome
): Promise<void> {
  if (outcome.kind !== 'link_required') return;
  const target = await pendingTargetOf(s, outcome.token);
  if (target === null || !args.targets.includes(target)) {
    violate(s, `${args.context}: parked against ${String(target)}`);
    return;
  }
  s.model.pendings.set(outcome.token, {
    targetUserId: target,
    identity: args.seen,
    expiresAtMs: now(s) + AUTH_PENDING_LINK_TTL_MS,
  });
  // What the app tells the person: the account can be proven with these.
  const proofs = identitiesOf(s.model, target);
  actor.pendingLink = {
    token: outcome.token,
    providers: proofs.map((row) => row.provider),
    emails: proofs.flatMap((row) => (row.email === null ? [] : [row.email])),
  };
}

async function settlePrediction(args: {
  readonly s: AuthSurface;
  readonly actor: ActorState;
  readonly context: string;
  readonly seen: SeenIdentity;
  /** The identity that joins on `linked` (the parked one, when confirming). */
  readonly joining: SeenIdentity;
  readonly prediction: Prediction;
  readonly outcome: ActorOutcome;
}): Promise<void> {
  const { s, actor, context, seen, prediction, outcome } = args;
  tally(s, `${context.split(' ')[1] ?? ''}:${prediction.kind}`);
  if (prediction.kind === 'error') {
    expectOutcome(s, context, outcome, { error: prediction.code });
    return;
  }
  if (prediction.kind === 'link_required') {
    if (expectOutcome(s, context, outcome, 'link_required')) {
      const targets = prediction.targetUserIds;
      await settleLinkRequired(s, actor, { context, seen, targets }, outcome);
    }
    return;
  }
  if (!expectOutcome(s, context, outcome, 'ok')) return;
  if (prediction.kind === 'existing') {
    refreshIdentity(s.model, seen);
    await settleSignedIn(s, actor, context, [prediction.userId]);
    return;
  }
  const allowed = prediction.kind === 'new' ? 'new' : prediction.userIds;
  const user = await settleSignedIn(s, actor, context, allowed);
  if (user === null) return;
  refreshIdentity(s.model, seen);
  attachIdentity(s.model, user, args.joining);
}

/** Sign in, or — with `pendingToken` — prove the account a link waits on. */
export async function signInFlow(
  s: AuthSurface,
  actor: ActorState,
  provider: OauthProviderId,
  answers: ProviderAnswers
): Promise<void> {
  const context = `${actor.id} sign in with ${provider} as ${answers.email}`;
  actor.answers = answers;
  const seen = actor.online
    ? await seenIdentity(s.store, provider, answers)
    : null;
  const verdict = actor.online
    ? await providerVerdict(s.store, provider, answers, seen)
    : null;
  const outcome = await runClient(actor, () =>
    actor.port.signIn(strategyForProvider(provider))
  );
  // Starting a sign-in drops the device's current session first.
  s.model.sessions.delete(actor.id);
  if (!actor.online) {
    expectOutcome(s, context, outcome, 'failed');
    return;
  }
  if (verdict !== null || seen === null) {
    expectOutcome(s, context, outcome, {
      error: verdict ?? AUTH_ERROR.cancelled,
    });
    return;
  }
  const prediction = predictSignIn(s.model, seen);
  await settlePrediction({
    s,
    actor,
    context,
    seen,
    joining: seen,
    prediction,
    outcome,
  });
}

export async function confirmPendingFlow(
  s: AuthSurface,
  actor: ActorState,
  provider: OauthProviderId,
  answers: ProviderAnswers
): Promise<void> {
  const token = actor.pendingLink?.token;
  if (token === undefined) return;
  const context = `${actor.id} confirm link via ${provider} as ${answers.email}`;
  actor.answers = answers;
  const parked = s.model.pendings.get(token);
  const live = parked !== undefined && parked.expiresAtMs > now(s);
  const seen = actor.online
    ? await seenIdentity(s.store, provider, answers)
    : null;
  const verdict = actor.online
    ? await providerVerdict(s.store, provider, answers, seen)
    : null;
  const outcome = await runClient(actor, () =>
    actor.port.signIn(strategyForProvider(provider), { pendingLink: token })
  );
  s.model.sessions.delete(actor.id);
  if (!actor.online) {
    expectOutcome(s, context, outcome, 'failed');
    return;
  }
  if (!live) {
    expectOutcome(s, context, outcome, { error: AUTH_ERROR.expired });
    actor.pendingLink = null;
    return;
  }
  if (verdict !== null || seen === null) {
    expectOutcome(s, context, outcome, {
      error: verdict ?? AUTH_ERROR.cancelled,
    });
    return;
  }
  const prediction = predictConfirm(s.model, token, seen, now(s));
  s.model.pendings.delete(token);
  actor.pendingLink = null;
  await settlePrediction({
    s,
    actor,
    context,
    seen,
    joining: parked.identity,
    prediction,
    outcome,
  });
}

/** "Keep them separate": the parked identity becomes its own account. */
export async function declinePendingFlow(
  s: AuthSurface,
  actor: ActorState
): Promise<void> {
  const token = actor.pendingLink?.token;
  if (token === undefined) return;
  const context = `${actor.id} decline link`;
  const outcome = await runClient(actor, () =>
    actor.port.createSeparateAccount(token)
  );
  if (!actor.online) {
    expectOutcome(s, context, outcome, 'failed');
    return;
  }
  actor.pendingLink = null;
  const parked = s.model.pendings.get(token);
  s.model.pendings.delete(token);
  if (parked === undefined || parked.expiresAtMs <= now(s)) {
    expectOutcome(s, context, outcome, { error: AUTH_ERROR.expired });
    return;
  }
  if (!expectOutcome(s, context, outcome, 'ok')) return;
  const { provider, sub } = parked.identity;
  const owner = s.model.identities.get(identityKey(provider, sub));
  const user = await settleSignedIn(
    s,
    actor,
    context,
    owner === undefined ? 'new' : [owner.userId]
  );
  if (user !== null && owner === undefined) {
    attachIdentity(s.model, user, parked.identity);
  }
}

export function expectedUserOf(
  s: AuthSurface,
  actor: ActorState
): string | null {
  return expectedUser(s.model, actor.id, now(s));
}

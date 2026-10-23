/**
 * Signing in with a link sent by email, each step predicted by the model
 * first and checked after: asking for the link (what the device is told,
 * and what lands in which mailbox), then opening it on a device.
 */

import type { EmailLinkMail } from '@pkgs/auth-inhouse-server-ts/email-link-delivery';
import { AUTH_ERROR } from '@pkgs/auth-root-shared-ts/auth-error-code';

import { runClient } from './actor';
import { expectOutcome, violate } from './checks';
import { settlePrediction } from './client-flows';
import type { SeenIdentity } from './model';
import {
  admitEmailLinkRequest,
  endToken,
  issueEmailLink,
  mailboxAddress,
  mailboxIdentity,
  predictConfirm,
  predictSignIn,
  spendEmailLink,
} from './model';
import { exampleAppServes } from './relying-party';
import type { ActorOutcome, ActorState, AuthSurface } from './types';

type Expected = 'ok' | 'failed' | { readonly error: string };

function now(s: AuthSurface): number {
  return s.session.ports.clock.now();
}

/**
 * What asking should come to. Being told "ok" says nothing about the
 * address: an account or none, served or not, the answer is the same.
 */
function expectedAnswer(
  s: AuthSurface,
  actor: ActorState,
  ask: { readonly address: string | null; readonly pendingToken: string | null }
): Expected {
  if (!actor.online || !s.store.mail.available || ask.address === null) {
    return 'failed';
  }
  if (!admitEmailLinkRequest(s.model, ask.address, now(s))) return 'failed';
  if (ask.pendingToken === null) return 'ok';
  const pending = s.model.pendings.get(ask.pendingToken);
  return pending !== undefined && pending.expiresAtMs > now(s)
    ? 'ok'
    : { error: AUTH_ERROR.expired };
}

/** Exactly the mail the ask should have produced, or `null` (with a violation). */
function mailFor(
  s: AuthSurface,
  context: string,
  args: {
    readonly mailed: readonly EmailLinkMail[];
    readonly address: string | null;
  }
): EmailLinkMail | null {
  const { mailed, address } = args;
  const due = address !== null && exampleAppServes(address);
  if (!due) {
    if (mailed.length > 0) violate(s, `${context}: mail left anyway`);
    return null;
  }
  const mail = mailed[0];
  if (mailed.length !== 1 || mail === undefined || mail.email !== address) {
    violate(s, `${context}: expected one link in that mailbox`);
    return null;
  }
  if (!mail.link.includes(mail.token)) {
    violate(s, `${context}: the link does not carry its token`);
  }
  return mail;
}

/**
 * Ask for a sign-in link at `email`; with `prove`, to prove the account the
 * device's pending link waits on.
 */
export async function requestEmailLinkFlow(
  s: AuthSurface,
  actor: ActorState,
  args: { readonly email: string; readonly prove: boolean }
): Promise<void> {
  const context = `${actor.id} ask for an email link at ${args.email}`;
  const pendingToken = args.prove ? (actor.pendingLink?.token ?? null) : null;
  if (args.prove && pendingToken === null) {
    throw new Error(`${actor.id} is not being asked to prove an account`);
  }
  const address = mailboxAddress(args.email);
  const before = s.store.inbox.all().length;
  const outcome = await runClient(actor, () =>
    actor.port.requestEmailLink(
      args.email,
      pendingToken === null ? {} : { pendingLink: pendingToken }
    )
  );
  const expected = expectedAnswer(s, actor, { address, pendingToken });
  if (typeof expected === 'object') actor.pendingLink = null;
  const answered = expectOutcome(s, context, outcome, expected);
  const mail = mailFor(s, context, {
    mailed: s.store.inbox.all().slice(before),
    address: answered && expected === 'ok' ? address : null,
  });
  if (mail === null) return;
  issueEmailLink(s.model, mail.token, {
    email: mail.email,
    pendingToken,
    nowMs: now(s),
  });
  if (mail.expiresAt !== s.model.emailLinks.get(mail.token)?.expiresAtMs) {
    violate(s, `${context}: the link lapses at ${String(mail.expiresAt)}`);
  }
}

/** The link was asked for as proof: opening it settles the pending link. */
async function settleProof(args: {
  readonly s: AuthSurface;
  readonly actor: ActorState;
  readonly context: string;
  readonly seen: SeenIdentity;
  readonly pendingToken: string;
  readonly outcome: ActorOutcome;
}): Promise<void> {
  const { s, pendingToken, seen } = args;
  const parked = s.model.pendings.get(pendingToken);
  const prediction = predictConfirm(s.model, pendingToken, seen, now(s));
  s.model.pendings.delete(pendingToken);
  // Whichever device was asked for the proof is asked no longer.
  for (const device of s.clients.values()) {
    if (device.pendingLink?.token === pendingToken) device.pendingLink = null;
  }
  await settlePrediction({
    s,
    actor: args.actor,
    context: args.context,
    seen,
    joining: parked?.identity ?? seen,
    prediction,
    outcome: args.outcome,
  });
}

/**
 * Open a mailed link on a device. A link that works signs the device in as
 * whoever its mailbox identity is, by the same policy as any sign-in; one
 * that was opened before or has lapsed changes nothing.
 */
export async function openEmailLinkFlow(
  s: AuthSurface,
  actor: ActorState,
  mail: EmailLinkMail
): Promise<void> {
  const context = `${actor.id} open the email link mailed to ${mail.email}`;
  const previous = s.model.sessions.get(actor.id)?.token ?? null;
  const outcome = await runClient(actor, () =>
    actor.port.signInWithEmailLink(mail.link)
  );
  if (!actor.online || !s.store.mail.available) {
    expectOutcome(s, context, outcome, 'failed');
    return;
  }
  const link = spendEmailLink(s.model, mail.token, now(s));
  if (link === null) {
    expectOutcome(s, context, outcome, { error: AUTH_ERROR.expired });
    return;
  }
  // Signing in anew retires the session the device held, wherever it is held.
  if (outcome.kind === 'ok' && previous !== null) endToken(s.model, previous);
  const seen = mailboxIdentity(link.email);
  if (link.pendingToken !== null) {
    const pendingToken = link.pendingToken;
    await settleProof({ s, actor, context, seen, pendingToken, outcome });
    return;
  }
  await settlePrediction({
    s,
    actor,
    context,
    seen,
    joining: seen,
    prediction: predictSignIn(s.model, seen),
    outcome,
  });
}

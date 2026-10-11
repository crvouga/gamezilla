/**
 * Signing in with a link sent by email, as stimuli and reads: ask for a
 * link, open one from a mailbox, switch the example app's way to send mail
 * off and on, and read what was mailed and which account an address gets
 * into. Scenario steps and model traces drive these; the random walk does
 * not sample them.
 */

import type { EmailLinkMail } from '@pkgs/auth-inhouse-server/email-link-delivery';
import type { SignInMethodId } from '@pkgs/auth-root-shared/sign-in-method';
import { isOauthProviderId } from '@pkgs/auth-root-shared/sign-in-method';
import { defineAction } from '@pkgs/harness-root-shared/define-action';
import sql from '@pkgs/sql-root-shared/sql';

import { signOutFlow } from './account-flows';
import { openEmailLinkFlow, requestEmailLinkFlow } from './email-link-flows';
import { mailboxAddress } from './model';
import type { AuthSurface } from './types';
import { requireActor } from './types';

export type EmailLinkArgs = {
  readonly clientId: string;
  /** The address the link is asked for at, or whose mailbox it is read from. */
  readonly email: string;
};

function mailedTo(s: AuthSurface, email: string): EmailLinkMail {
  const mail = s.store.inbox.latest(email);
  if (mail === null) throw new Error(`no sign-in link was mailed to ${email}`);
  return mail;
}

/** The device asks for a sign-in link at an address. */
export const requestEmailLink = defineAction({
  name: 'requestEmailLink',
  pool: false,
  act: async (s: AuthSurface, args: EmailLinkArgs) => {
    const actor = requireActor(s.clients, args.clientId);
    await requestEmailLinkFlow(s, actor, { email: args.email, prove: false });
  },
});

/**
 * The device, asked to connect its accounts, asks for a sign-in link at the
 * matched account's address to prove that account.
 */
export const requestEmailLinkAsProof = defineAction({
  name: 'requestEmailLinkAsProof',
  pool: false,
  act: async (s: AuthSurface, args: EmailLinkArgs) => {
    const actor = requireActor(s.clients, args.clientId);
    await requestEmailLinkFlow(s, actor, { email: args.email, prove: true });
  },
});

/** The device opens the newest sign-in link in an address's mailbox. */
export const openEmailLink = defineAction({
  name: 'openEmailLink',
  pool: false,
  act: async (s: AuthSurface, args: EmailLinkArgs) => {
    const actor = requireActor(s.clients, args.clientId);
    await openEmailLinkFlow(s, actor, mailedTo(s, args.email));
  },
});

/**
 * The device opens one particular sign-in link: the `number`-th the example
 * app mailed, counting from 1 across every mailbox ({@link emailLinksMailed}).
 */
export const openEmailLinkNumber = defineAction({
  name: 'openEmailLinkNumber',
  pool: false,
  act: async (
    s: AuthSurface,
    args: { readonly clientId: string; readonly number: number }
  ) => {
    const mail = s.store.inbox.all()[args.number - 1];
    if (mail === undefined) {
      throw new Error(`no sign-in link number ${String(args.number)}`);
    }
    await openEmailLinkFlow(s, requireActor(s.clients, args.clientId), mail);
  },
});

/**
 * An account that already belongs to an address: the device asks for a
 * sign-in link there, opens it, and signs out again.
 */
export const setupEmailAccount = defineAction({
  name: 'setupEmailAccount',
  pool: false,
  act: async (s: AuthSurface, args: EmailLinkArgs) => {
    const actor = requireActor(s.clients, args.clientId);
    await requestEmailLinkFlow(s, actor, { email: args.email, prove: false });
    await openEmailLinkFlow(s, actor, mailedTo(s, args.email));
    await signOutFlow(s, actor);
  },
});

/** Give the example app's environment a way to send mail, or take it away. */
export const setMailAvailable = defineAction({
  name: 'setMailAvailable',
  pool: false,
  act: (s: AuthSurface, available: boolean) => {
    s.store.mail.available = available;
  },
});

/**
 * The person at the device starts signing in: the device is shown the ways
 * to sign in the example app offers ({@link signInMethodsOfferedTo}).
 */
export const startSigningIn = defineAction({
  name: 'startSigningIn',
  pool: false,
  act: async (s: AuthSurface, clientId: string) => {
    const actor = requireActor(s.clients, clientId);
    actor.offered = await signInMethodsOffered(s);
  },
});

/** Every sign-in link the example app mailed, in the order they were asked for. */
export function emailLinksMailed(s: AuthSurface): readonly EmailLinkMail[] {
  return s.store.inbox.all();
}

/** The newest sign-in link in an address's mailbox, or `null` when it holds none. */
export function latestEmailLink(
  s: AuthSurface,
  email: string
): EmailLinkMail | null {
  return s.store.inbox.latest(email);
}

/** The account an email address gets into, or `null` when none belongs to it. */
export async function emailAccount(
  s: AuthSurface,
  email: string
): Promise<string | null> {
  const address = mailboxAddress(email);
  if (address === null) return null;
  const rows = await s.store.sql.query(sql<{ user_id: string }>`
    SELECT user_id FROM idp_accounts
    WHERE provider = ${'email'} AND provider_user_id = ${address}
    LIMIT 1
  `);
  return rows[0]?.user_id ?? null;
}

/** The ways to sign in the example app offers someone who starts signing in. */
export async function signInMethodsOffered(
  s: AuthSurface
): Promise<SignInMethodId[]> {
  const res = await s.store.fetch('/auth/providers');
  const body = (await res.json()) as {
    readonly providers?: readonly string[];
    readonly emailLinks?: boolean;
  };
  return [
    ...(body.providers ?? []).filter(isOauthProviderId),
    ...(body.emailLinks === true ? (['email'] as const) : []),
  ];
}

/**
 * The ways to sign in the device was shown when its person last started
 * signing in ({@link startSigningIn}), or `null` when they have not started.
 */
export function signInMethodsOfferedTo(
  s: AuthSurface,
  clientId: string
): readonly SignInMethodId[] | null {
  return requireActor(s.clients, clientId).offered;
}

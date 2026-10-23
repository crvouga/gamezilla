/**
 * `specs/auth/sign-in-links.qnt` against the example app: two devices (the
 * phone is Chris's, the laptop Uma's) and two email addresses, each model
 * action through the harness's actions, and the model's state read back from
 * the devices, the accounts on record and the mailboxes. The model's number
 * for a sign-in link is its place among every link the example app mailed,
 * and its number for an account is the order the accounts started in.
 */

import {
  advanceClock,
  setOnline,
  signOut,
} from '@pkgs/auth-root-harness-ts/actions';
import {
  emailAccount,
  emailLinksMailed,
  openEmailLinkNumber,
  requestEmailLink,
} from '@pkgs/auth-root-harness-ts/email-link-actions';
import {
  accountsOnRecord,
  auth,
  signedInUser,
} from '@pkgs/auth-root-harness-ts/system';
import type { QuintValue } from '@pkgs/quint-shared-ts/itf';
import type { Picks } from '@pkgs/quint-shared-ts/registry';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';
import type { SignInTraceWorld } from './world';
import { accountNumber, traceAuth } from './world';

const DEVICES: Readonly<Record<string, string>> = {
  phone: 'c0',
  laptop: 'c1',
};

const EMAIL_ADDRESSES: Readonly<Record<string, string>> = {
  chris: 'chris@example.com',
  uma: 'uma@example.com',
};

/** The model's "11 minutes pass": past the 10 minutes a sign-in link works for. */
const SIGN_IN_LINKS_LAPSE_MS = 11 * 60 * 1000;

function deviceOf(picks: Picks): string {
  const id = DEVICES[String(picks['device'])];
  if (id === undefined) throw new Error(`no device ${String(picks['device'])}`);
  return id;
}

function emailAddressOf(picks: Picks): string {
  const email = EMAIL_ADDRESSES[String(picks['emailAddress'])];
  if (email === undefined) {
    throw new Error(`no email address ${String(picks['emailAddress'])}`);
  }
  return email;
}

async function connection(
  w: SignInTraceWorld,
  picks: Picks,
  online: boolean
): Promise<void> {
  await traceAuth(w).apply(setOnline, { clientId: deviceOf(picks), online });
}

bindQuintModel<SignInTraceWorld>({
  model: 'sign-in-links',
  traces: 24,
  maxSteps: 20,
  actions: {
    init: async (w) => {
      w.harness = await auth.run({
        seed: w.ctx.testId,
        args: {
          fabric:
            w.ctx.trace % 2 === 0
              ? 'mockingbird-postgres'
              : 'mockingbird-sqlite',
          clientCount: Object.keys(DEVICES).length,
        },
      });
    },
    askForSignInLink: async (w, picks) => {
      await traceAuth(w).apply(requestEmailLink, {
        clientId: deviceOf(picks),
        email: emailAddressOf(picks),
      });
    },
    openSignInLink: async (w, picks) => {
      await traceAuth(w).apply(openEmailLinkNumber, {
        clientId: deviceOf(picks),
        number: Number(picks['signInLink']),
      });
    },
    signOut: async (w, picks) => {
      await traceAuth(w).apply(signOut, deviceOf(picks));
    },
    signInLinksLapse: async (w) => {
      await traceAuth(w).apply(advanceClock, SIGN_IN_LINKS_LAPSE_MS);
    },
    loseConnection: async (w, picks) => {
      await connection(w, picks, false);
    },
    connectionReturns: async (w, picks) => {
      await connection(w, picks, true);
    },
  },
  observe: async (w) => {
    const s = traceAuth(w);
    const accounts = await s.read(accountsOnRecord);
    for (const account of accounts) accountNumber(w, account.id);
    const mailed = await s.read(emailLinksMailed);
    const accountAt = new Map<QuintValue, QuintValue>();
    const mailbox = new Map<QuintValue, QuintValue>();
    for (const [name, email] of Object.entries(EMAIL_ADDRESSES)) {
      const account = await s.read(emailAccount, email);
      accountAt.set(name, account === null ? 0 : accountNumber(w, account));
      mailbox.set(
        name,
        new Set<QuintValue>(
          mailed.flatMap((mail, index) =>
            mail.email === email ? [index + 1] : []
          )
        )
      );
    }
    const signedInto = new Map<QuintValue, QuintValue>();
    const offline = new Set<QuintValue>();
    for (const [name, id] of Object.entries(DEVICES)) {
      const user = await s.read(signedInUser, id);
      if (user !== null) signedInto.set(name, accountNumber(w, user));
      if (!(await s.read((surface) => surface.clients.get(id)?.online))) {
        offline.add(name);
      }
    }
    return {
      signedInto,
      accountAt,
      accountCount: accounts.length,
      mailbox,
      offline,
    };
  },
});

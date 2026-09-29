/**
 * `specs/auth/outside-accounts.qnt` against the example app: three devices
 * (phone, laptop, tablet) and five directory entries (Chris's Google and
 * Apple accounts at one verified address, Uma's at one unverified address,
 * Dan's Apple account), each model action through the harness's actions, and
 * the model's state read back from the store and the devices. Odd traces
 * run on SQLite, even ones on Postgres.
 */

import type { OauthProviderId } from '@pkgs/auth/shared';
import {
  accountsOnRecord,
  advanceClock,
  appleAccountDeleted,
  appleConsentRevoked,
  auth,
  awaitingProof,
  clearProviderFaults,
  confirmPendingLink,
  declinePendingLink,
  linkProvider,
  type ProviderStepArgs,
  setOnline,
  setProviderFault,
  signedInUser,
  signIn,
  signOut,
  signOutEverywhere,
  stealBearer,
  unlinkProvider,
} from '@pkgs/auth-harness';
import { AUTH_SESSION_TTL_MS } from '@pkgs/auth-inhouse/shared';
import type { QuintValue } from '@pkgs/quint/itf';
import { bindQuintModel, type Picks } from '@pkgs/quint/registry';

import { accountNumber, type SignInTraceWorld, traceAuth } from './world';

const DEVICES: Readonly<Record<string, string>> = {
  phone: 'c0',
  laptop: 'c1',
  tablet: 'c2',
};

const OUTSIDE_ACCOUNTS: Readonly<
  Record<string, { readonly provider: OauthProviderId; readonly email: string }>
> = {
  googleChris: { provider: 'google', email: 'chris@gmail.com' },
  appleChris: { provider: 'apple', email: 'chris@gmail.com' },
  googleUma: { provider: 'google', email: 'uma@unverified.test' },
  appleUma: { provider: 'apple', email: 'uma@unverified.test' },
  appleDan: { provider: 'apple', email: 'dan@icloud.com' },
};

/** A fault that stops each provider telling the app who signs in. */
const TROUBLE: Readonly<Record<OauthProviderId, string>> = {
  google: 'google.token-500',
  apple: 'apple.token-500',
};

const CHANCE_TO_CONFIRM_LAPSE_MS = 11 * 60 * 1000;

function deviceOf(picks: Picks, name = 'device'): string {
  const id = DEVICES[String(picks[name])];
  if (id === undefined) throw new Error(`no device ${String(picks[name])}`);
  return id;
}

function outsideAccountOf(picks: Picks) {
  const account = OUTSIDE_ACCOUNTS[String(picks['outsideAccount'])];
  if (account === undefined) {
    throw new Error(`no outside account ${String(picks['outsideAccount'])}`);
  }
  return account;
}

function providerOf(picks: Picks): OauthProviderId {
  return picks['provider'] === 'apple' ? 'apple' : 'google';
}

function withOutsideAccount(picks: Picks): ProviderStepArgs {
  const { provider, email } = outsideAccountOf(picks);
  return {
    clientId: deviceOf(picks),
    provider,
    answers: { email, consent: 'allow', emailChoice: 'share' },
  };
}

function outsideAccountName(provider: string, email: string | null): string {
  const found = Object.entries(OUTSIDE_ACCOUNTS).find(
    ([, row]) => row.provider === provider && row.email === email
  );
  return found?.[0] ?? `${provider}:${String(email)}`;
}

bindQuintModel<SignInTraceWorld>({
  model: 'outside-accounts',
  // Apalache: 3 steps in about 20 s; 4 take about 6 minutes.
  verifySteps: 3,
  traces: 40,
  maxSteps: 30,
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
    signIn: async (w, picks) => {
      await traceAuth(w).apply(signIn, withOutsideAccount(picks));
    },
    confirmMatchingAccount: async (w, picks) => {
      await traceAuth(w).apply(confirmPendingLink, withOutsideAccount(picks));
    },
    keepSeparate: async (w, picks) => {
      await traceAuth(w).apply(declinePendingLink, deviceOf(picks));
    },
    connectSignInMethod: async (w, picks) => {
      await traceAuth(w).apply(linkProvider, withOutsideAccount(picks));
    },
    removeSignInMethod: async (w, picks) => {
      await traceAuth(w).apply(unlinkProvider, {
        clientId: deviceOf(picks),
        provider: providerOf(picks),
      });
    },
    signOut: async (w, picks) => {
      await traceAuth(w).apply(signOut, deviceOf(picks));
    },
    signOutEverywhere: async (w, picks) => {
      await traceAuth(w).apply(signOutEverywhere, deviceOf(picks));
    },
    stealSignIn: async (w, picks) => {
      await traceAuth(w).apply(stealBearer, {
        from: deviceOf(picks),
        to: deviceOf(picks, 'other'),
      });
    },
    loseConnection: async (w, picks) => {
      await traceAuth(w).apply(setOnline, {
        clientId: deviceOf(picks),
        online: false,
      });
    },
    connectionReturns: async (w, picks) => {
      await traceAuth(w).apply(setOnline, {
        clientId: deviceOf(picks),
        online: true,
      });
    },
    troubleStarts: async (w, picks) => {
      await traceAuth(w).apply(setProviderFault, TROUBLE[providerOf(picks)]);
    },
    troubleEnds: async (w, picks) => {
      await traceAuth(w).apply(clearProviderFaults, providerOf(picks));
    },
    stopUsingSignInWithApple: async (w, picks) => {
      await traceAuth(w).apply(
        appleConsentRevoked,
        outsideAccountOf(picks).email
      );
    },
    deleteAppleAccount: async (w, picks) => {
      await traceAuth(w).apply(
        appleAccountDeleted,
        outsideAccountOf(picks).email
      );
    },
    chanceToConfirmLapses: async (w) => {
      await traceAuth(w).apply(advanceClock, CHANCE_TO_CONFIRM_LAPSE_MS);
    },
    signInsLapse: async (w) => {
      await traceAuth(w).apply(advanceClock, AUTH_SESSION_TTL_MS + 1);
    },
  },
  observe: async (w) => {
    const s = traceAuth(w);
    const accounts = await s.read(accountsOnRecord);
    const signInMethods = new Map<QuintValue, QuintValue>();
    for (const account of accounts) {
      signInMethods.set(
        accountNumber(w, account.id),
        new Set<QuintValue>(
          account.methods.map((row) =>
            outsideAccountName(row.provider, row.email)
          )
        )
      );
    }
    const signedInto = new Map<QuintValue, QuintValue>();
    const askedToConfirm = new Set<QuintValue>();
    for (const [name, id] of Object.entries(DEVICES)) {
      const user = await s.read(signedInUser, id);
      if (user !== null) signedInto.set(name, accountNumber(w, user));
      if (await s.read(awaitingProof, id)) askedToConfirm.add(name);
    }
    return {
      signedInto,
      signInMethods,
      accountCount: accounts.length,
      askedToConfirm,
    };
  },
});

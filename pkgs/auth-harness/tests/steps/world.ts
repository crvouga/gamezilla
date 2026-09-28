/**
 * The world a `specs/auth/` scenario runs in: one auth harness with four
 * devices, handed out to people the first time a step names them, plus the
 * account each person was last seen signed into.
 *
 * Each person's outside accounts are fixed entries of the providers'
 * directories: Alice has a Google and an Apple account at different
 * addresses, Bob a Google account, Carol a Google account and an Apple
 * account at one unverified address, Dave an Apple account.
 */

import type { OauthProviderId } from '@pkgs/auth/shared';
import {
  type AuthSurface,
  auth,
  type ProviderAnswers,
  type ProviderStepArgs,
} from '@pkgs/auth-harness';
import {
  type ScenarioContext,
  setWorld,
  stepsFor,
} from '@pkgs/gherkin/registry';
import type { Run } from '@pkgs/harness';

const DEVICE_COUNT = 4;

const OUTSIDE_ACCOUNTS: Readonly<
  Record<OauthProviderId, Readonly<Record<string, string>>>
> = {
  google: {
    alice: 'alice@gmail.com',
    bob: 'bob@gmail.com',
    carol: 'uma@unverified.test',
  },
  apple: {
    alice: 'alice@icloud.com',
    carol: 'uma@unverified.test',
    dave: 'dan@icloud.com',
  },
};

/** A Google account nobody in the scenarios holds. */
export const SECOND_GOOGLE_ACCOUNT = 'chris@gmail.com';

export type SignInWorld = {
  readonly ctx: ScenarioContext;
  readonly s: Run<AuthSurface>;
  /** Device key (`alice`, `alice#2`) → harness client id. */
  readonly devices: Map<string, string>;
  /** The account each person was last seen signed into. */
  readonly accounts: Map<string, string>;
  /** Outside accounts whose address changed (`bob:google` → address). */
  readonly moved: Map<string, string>;
};

export const { Given, When, Then } = stepsFor<SignInWorld>();

/** The address a person's outside account with a provider started with. */
export function emailOf(actor: string, provider: OauthProviderId): string {
  const email = OUTSIDE_ACCOUNTS[provider][actor];
  if (email === undefined) {
    throw new Error(`${actor} has no ${provider} account in these scenarios`);
  }
  return email;
}

/** A person's device (`nth` 2 for their second one), handed out on first use. */
export function device(w: SignInWorld, actor: string, nth = 1): string {
  const key = nth === 1 ? actor : `${actor}#${String(nth)}`;
  const known = w.devices.get(key);
  if (known !== undefined) return known;
  if (w.devices.size >= DEVICE_COUNT) {
    throw new Error(`no device left for ${key}`);
  }
  const id = `c${String(new Set(w.devices.values()).size)}`;
  w.devices.set(key, id);
  return id;
}

/** From now on, the person uses the device another person used. */
export function handOver(w: SignInWorld, from: string, to: string): string {
  const id = device(w, from);
  w.devices.set(to, id);
  return id;
}

/** The address a person's outside account with a provider has now. */
export function currentEmailOf(
  w: SignInWorld,
  actor: string,
  provider: OauthProviderId
): string {
  return w.moved.get(`${actor}:${provider}`) ?? emailOf(actor, provider);
}

export function answers(
  w: SignInWorld,
  actor: string,
  provider: OauthProviderId,
  extra: Partial<ProviderAnswers> = {}
): ProviderAnswers {
  return {
    email: currentEmailOf(w, actor, provider),
    consent: 'allow',
    emailChoice: 'share',
    ...extra,
  };
}

/** The person signs in on their device with their own outside account. */
export function onDevice(
  w: SignInWorld,
  actor: string,
  provider: OauthProviderId,
  options: {
    readonly extra?: Partial<ProviderAnswers>;
    /** 2 for the person's second device. */
    readonly nth?: number;
  } = {}
): ProviderStepArgs {
  const { extra = {}, nth = 1 } = options;
  return {
    clientId: device(w, actor, nth),
    provider,
    answers: answers(w, actor, provider, extra),
  };
}

export function accountOf(w: SignInWorld, actor: string): string {
  const account = w.accounts.get(actor);
  if (account === undefined) {
    throw new Error(`no earlier step signed ${actor} into an account`);
  }
  return account;
}

export function useSignInWorld(): void {
  setWorld<SignInWorld>({
    create: async (ctx) => ({
      ctx,
      s: await auth.run({
        seed: ctx.testId,
        args: { fabric: 'mockingbird-sqlite', clientCount: DEVICE_COUNT },
      }),
      devices: new Map(),
      accounts: new Map(),
      moved: new Map(),
    }),
    dispose: async (w) => {
      await w.s[Symbol.asyncDispose]();
    },
  });
}

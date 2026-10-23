/**
 * The harness's email-link actions against its own reference model, on the
 * paths around the ones `specs/auth/sign-in-link.feature` and
 * `specs/auth/sign-in-links.qnt` bind (asking, opening, opening twice,
 * lapsing, whether a sign-in link is offered): every step below is predicted
 * by the model and checked against the example app (`invariantViolations`
 * lists any disagreement) for an address the app does not serve, asking too
 * often, asking and opening while the environment has no way to send mail,
 * and a link meeting the account-matching policy.
 */

import { describe, expect, test } from 'bun:test';
import { AUTH_EMAIL_LINK_THROTTLED_ERROR } from '@pkgs/auth-inhouse-client-ts/email-link-auth-client';
import type { ProviderStepArgs } from '@pkgs/auth-root-harness-ts/actions';
import {
  advanceClock,
  confirmPendingLink,
  declinePendingLink,
  setOnline,
  signIn,
  signOut,
  stealBearer,
  unlinkProvider,
} from '@pkgs/auth-root-harness-ts/actions';
import {
  emailAccount,
  emailLinksMailed,
  latestEmailLink,
  openEmailLink,
  requestEmailLink,
  requestEmailLinkAsProof,
  setMailAvailable,
  setupEmailAccount,
} from '@pkgs/auth-root-harness-ts/email-link-actions';
import { UNSERVED_EMAIL_DOMAIN } from '@pkgs/auth-root-harness-ts/relying-party';
import {
  accountsOnRecord,
  auth,
  awaitingProof,
  invariantViolations,
  lastOutcome,
  signedInUser,
} from '@pkgs/auth-root-harness-ts/system';
import type { AuthSurface } from '@pkgs/auth-root-harness-ts/types';
import { AUTH_ERROR } from '@pkgs/auth-root-shared-ts/auth-error-code';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';

const BOOT_TIMEOUT_MS = 30_000;
const PHONE = 'c0';
const LAPTOP = 'c1';
const ALICE = 'alice@example.com';
/** Held at Google with a verified address, and at Apple. */
const VERIFIED_AT_GOOGLE = 'chris@gmail.com';
/** Held at Google, which does not vouch for the address. */
const UNVERIFIED_AT_GOOGLE = 'uma@unverified.test';
const MINUTE_MS = 60_000;

async function open(seed: string): Promise<Run<AuthSurface>> {
  return await auth.run({
    seed: `email-link:${seed}`,
    args: { fabric: 'mockingbird-sqlite', clientCount: 2 },
  });
}

function google(clientId: string, email: string): ProviderStepArgs {
  return {
    clientId,
    provider: 'google',
    answers: { email, consent: 'allow', emailChoice: 'share' },
  };
}

async function expectAgreement(s: Run<AuthSurface>): Promise<void> {
  expect(await s.read(invariantViolations)).toEqual([]);
}

describe('the email-link actions agree with the reference model', () => {
  test(
    'asking says the same whether or not anything is mailed, until it is asked too often',
    async () => {
      await using s = await open('asking');
      const unserved = `dana@${UNSERVED_EMAIL_DOMAIN}`;
      await s.apply(requestEmailLink, { clientId: PHONE, email: unserved });
      expect(await s.read(lastOutcome, PHONE)).toEqual({ kind: 'ok' });
      expect(await s.read(latestEmailLink, unserved)).toBeNull();
      await s.apply(requestEmailLink, {
        clientId: PHONE,
        email: 'not-an-address',
      });
      expect(await s.read(lastOutcome, PHONE)).toMatchObject({
        kind: 'failed',
      });
      await s.apply(setOnline, { clientId: PHONE, online: false });
      await s.apply(requestEmailLink, { clientId: PHONE, email: ALICE });
      expect(await s.read(lastOutcome, PHONE)).toMatchObject({
        kind: 'failed',
      });
      await s.apply(setOnline, { clientId: PHONE, online: true });
      expect(await s.read(emailLinksMailed)).toEqual([]);

      for (let asked = 0; asked < 10; asked += 1) {
        await s.apply(requestEmailLink, { clientId: PHONE, email: ALICE });
        expect(await s.read(lastOutcome, PHONE)).toEqual({ kind: 'ok' });
      }
      await s.apply(requestEmailLink, { clientId: PHONE, email: ALICE });
      expect(await s.read(lastOutcome, PHONE)).toEqual({
        kind: 'failed',
        message: AUTH_EMAIL_LINK_THROTTLED_ERROR,
      });
      expect(await s.read(emailLinksMailed)).toHaveLength(10);
      await s.apply(advanceClock, 11 * MINUTE_MS);
      await s.apply(requestEmailLink, { clientId: PHONE, email: ALICE });
      expect(await s.read(lastOutcome, PHONE)).toEqual({ kind: 'ok' });
      await expectAgreement(s);
    },
    BOOT_TIMEOUT_MS
  );

  test(
    'an environment with no way to send mail mails nothing and opens no link until mail is back',
    async () => {
      await using s = await open('no-mail');
      await s.apply(requestEmailLink, { clientId: PHONE, email: ALICE });
      await s.apply(setMailAvailable, false);
      await s.apply(requestEmailLink, { clientId: PHONE, email: ALICE });
      expect(await s.read(lastOutcome, PHONE)).toMatchObject({
        kind: 'failed',
      });
      await s.apply(openEmailLink, { clientId: PHONE, email: ALICE });
      expect(await s.read(signedInUser, PHONE)).toBeNull();
      expect(await s.read(emailLinksMailed)).toHaveLength(1);
      // Social sign-in is untouched, and the link works once mail is back.
      await s.apply(signIn, google(LAPTOP, VERIFIED_AT_GOOGLE));
      expect(await s.read(signedInUser, LAPTOP)).not.toBeNull();
      await s.apply(setMailAvailable, true);
      await s.apply(openEmailLink, { clientId: PHONE, email: ALICE });
      expect(await s.read(signedInUser, PHONE)).not.toBeNull();
      await expectAgreement(s);
    },
    BOOT_TIMEOUT_MS
  );

  test(
    'a link joins the account whose address a provider verified',
    async () => {
      await using s = await open('joins');
      await s.apply(signIn, google(PHONE, VERIFIED_AT_GOOGLE));
      const account = await s.read(signedInUser, PHONE);
      await s.apply(requestEmailLink, {
        clientId: LAPTOP,
        email: VERIFIED_AT_GOOGLE,
      });
      await s.apply(openEmailLink, {
        clientId: LAPTOP,
        email: VERIFIED_AT_GOOGLE,
      });
      expect(await s.read(signedInUser, LAPTOP)).toBe(account);
      expect(await s.read(emailAccount, VERIFIED_AT_GOOGLE)).toBe(account);
      // With two ways in, the mailbox can be removed; the last one cannot.
      await s.apply(unlinkProvider, { clientId: LAPTOP, provider: 'email' });
      expect(await s.read(lastOutcome, LAPTOP)).toEqual({ kind: 'ok' });
      await s.apply(unlinkProvider, { clientId: LAPTOP, provider: 'google' });
      expect(await s.read(lastOutcome, LAPTOP)).toEqual({
        kind: 'error',
        code: AUTH_ERROR.lastIdentity,
      });
      await expectAgreement(s);
    },
    BOOT_TIMEOUT_MS
  );

  test(
    'a link at an address no provider verified waits to be proven or kept apart',
    async () => {
      await using s = await open('waits');
      await s.apply(signIn, google(PHONE, UNVERIFIED_AT_GOOGLE));
      const account = await s.read(signedInUser, PHONE);
      await s.apply(signOut, PHONE);
      for (const device of [PHONE, LAPTOP]) {
        await s.apply(requestEmailLink, {
          clientId: device,
          email: UNVERIFIED_AT_GOOGLE,
        });
        await s.apply(openEmailLink, {
          clientId: device,
          email: UNVERIFIED_AT_GOOGLE,
        });
        expect(await s.read(lastOutcome, device)).toMatchObject({
          kind: 'link_required',
        });
        expect(await s.read(awaitingProof, device)).toBe(true);
        expect(await s.read(signedInUser, device)).toBeNull();
      }
      // The phone proves the Google account, so the mailbox joins it — and
      // the laptop, declining afterwards, lands in the account it joined.
      await s.apply(confirmPendingLink, google(PHONE, UNVERIFIED_AT_GOOGLE));
      expect(await s.read(signedInUser, PHONE)).toBe(account);
      expect(await s.read(emailAccount, UNVERIFIED_AT_GOOGLE)).toBe(account);
      await s.apply(declinePendingLink, LAPTOP);
      expect(await s.read(signedInUser, LAPTOP)).toBe(account);
      await expectAgreement(s);
    },
    BOOT_TIMEOUT_MS
  );

  test(
    'declining to connect keeps the mailbox as an account of its own',
    async () => {
      await using s = await open('apart');
      await s.apply(signIn, google(PHONE, UNVERIFIED_AT_GOOGLE));
      const account = await s.read(signedInUser, PHONE);
      await s.apply(requestEmailLink, {
        clientId: LAPTOP,
        email: UNVERIFIED_AT_GOOGLE,
      });
      await s.apply(openEmailLink, {
        clientId: LAPTOP,
        email: UNVERIFIED_AT_GOOGLE,
      });
      await s.apply(declinePendingLink, LAPTOP);
      const own = await s.read(signedInUser, LAPTOP);
      expect(own).not.toBeNull();
      expect(own).not.toBe(account);
      expect(await s.read(emailAccount, UNVERIFIED_AT_GOOGLE)).toBe(own);
      await expectAgreement(s);
    },
    BOOT_TIMEOUT_MS
  );

  test(
    'an emailed link proves the account a provider sign-in matched',
    async () => {
      await using s = await open('proves');
      await s.apply(setupEmailAccount, {
        clientId: PHONE,
        email: UNVERIFIED_AT_GOOGLE,
      });
      const account = await s.read(emailAccount, UNVERIFIED_AT_GOOGLE);
      await s.apply(signIn, google(PHONE, UNVERIFIED_AT_GOOGLE));
      expect(await s.read(awaitingProof, PHONE)).toBe(true);
      await s.apply(requestEmailLinkAsProof, {
        clientId: PHONE,
        email: UNVERIFIED_AT_GOOGLE,
      });
      await s.apply(openEmailLink, {
        clientId: PHONE,
        email: UNVERIFIED_AT_GOOGLE,
      });
      expect(await s.read(lastOutcome, PHONE)).toEqual({ kind: 'ok' });
      expect(await s.read(signedInUser, PHONE)).toBe(account);
      expect(await s.read(awaitingProof, PHONE)).toBe(false);
      expect(await s.read(accountsOnRecord)).toEqual([
        {
          id: account ?? '',
          methods: [
            { provider: 'email', email: UNVERIFIED_AT_GOOGLE },
            { provider: 'google', email: UNVERIFIED_AT_GOOGLE },
          ],
        },
      ]);
      await expectAgreement(s);
    },
    BOOT_TIMEOUT_MS
  );

  test(
    'opening a link on a signed-in device retires the sign-in it replaces',
    async () => {
      await using s = await open('replaces');
      await s.apply(signIn, google(PHONE, VERIFIED_AT_GOOGLE));
      await s.apply(stealBearer, { from: PHONE, to: LAPTOP });
      expect(await s.read(signedInUser, LAPTOP)).not.toBeNull();
      await s.apply(requestEmailLink, { clientId: PHONE, email: ALICE });
      await s.apply(openEmailLink, { clientId: PHONE, email: ALICE });
      expect(await s.read(signedInUser, PHONE)).toBe(
        await s.read(emailAccount, ALICE)
      );
      expect(await s.read(signedInUser, LAPTOP)).toBeNull();
      await expectAgreement(s);
    },
    BOOT_TIMEOUT_MS
  );
});

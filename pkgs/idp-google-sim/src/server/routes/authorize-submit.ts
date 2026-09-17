/** Reading and authenticating a post back from one of the IdP's screens. */

import type { Context } from 'hono';

import type { IdpAccount } from '../../shared/types';
import { findAccountByEmail, type IdpState } from '../idp-state';

export type Submission = {
  readonly requestId: string;
  readonly step: 'choose' | 'password' | 'consent';
  readonly sub: string | null;
  readonly email: string;
  readonly password: string;
  readonly decision: 'allow' | 'deny';
};

export type Authenticated =
  | { readonly kind: 'account'; readonly account: IdpAccount }
  | {
      readonly kind: 'signin';
      readonly email: string;
      readonly error: string | null;
    };

function field(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === 'string' ? value.trim() : '';
}

export async function readSubmission(c: Context): Promise<Submission> {
  const body = (await c.req.parseBody()) as Record<string, unknown>;
  const step = field(body, 'step');
  const sub = field(body, 'sub');
  return {
    requestId: field(body, 'request_id'),
    step: step === 'consent' || step === 'password' ? step : 'choose',
    sub: sub.length > 0 ? sub : null,
    email: field(body, 'email'),
    password: field(body, 'password'),
    decision: field(body, 'decision') === 'deny' ? 'deny' : 'allow',
  };
}

/** Google's own copy, because relying parties screenshot these strings. */
const NO_ACCOUNT_ERROR = "Couldn't find your Google Account";
const WRONG_PASSWORD_ERROR =
  'Wrong password. Try again or click Forgot password to reset it.';

export function authenticateSubmission(
  state: IdpState,
  submission: Submission
): Authenticated {
  if (submission.step === 'choose') {
    if (submission.sub === null) {
      return { kind: 'signin', email: '', error: null };
    }
    const account = state.accounts.get(submission.sub);
    if (account === undefined) {
      return { kind: 'signin', email: '', error: NO_ACCOUNT_ERROR };
    }
    return { kind: 'account', account };
  }
  const account = findAccountByEmail(state, submission.email);
  if (account === null) {
    return { kind: 'signin', email: submission.email, error: NO_ACCOUNT_ERROR };
  }
  if (account.password !== submission.password) {
    return {
      kind: 'signin',
      email: submission.email,
      error: WRONG_PASSWORD_ERROR,
    };
  }
  return { kind: 'account', account };
}

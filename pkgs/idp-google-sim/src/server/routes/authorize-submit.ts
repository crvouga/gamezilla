/** Reading and authenticating a post back from one of the IdP's screens. */

import type { Context } from 'hono';
import { IDP_BRAND } from '../../shared/brand';

/**
 * The steps the screens submit. Google splits sign-in into `identifier` and
 * `password`; the chooser, the consent card and the create-account card keep
 * their own step values.
 */
export type SubmissionStep =
  | 'choose'
  | 'consent'
  | 'create'
  | 'identifier'
  | 'password';

export type Submission = {
  readonly requestId: string;
  readonly step: SubmissionStep;
  readonly sub: string | null;
  readonly email: string;
  readonly name: string;
  readonly password: string;
  readonly decision: 'allow' | 'deny';
};

function field(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === 'string' ? value.trim() : '';
}

function parseStep(raw: string): SubmissionStep {
  if (raw === 'consent' || raw === 'create' || raw === 'password') return raw;
  if (raw === 'choose') return 'choose';
  return 'identifier';
}

export async function readSubmission(c: Context): Promise<Submission> {
  const body = (await c.req.parseBody()) as Record<string, unknown>;
  const sub = field(body, 'sub');
  return {
    requestId: field(body, 'request_id'),
    step: parseStep(field(body, 'step')),
    sub: sub.length > 0 ? sub : null,
    email: field(body, 'email'),
    name: field(body, 'name'),
    password: field(body, 'password'),
    decision: field(body, 'decision') === 'deny' ? 'deny' : 'allow',
  };
}

/** Google's own copy, because relying parties screenshot these strings. */
export const NO_ACCOUNT_ERROR = `Couldn't find your ${IDP_BRAND.name} account`;
export const WRONG_PASSWORD_ERROR =
  'Wrong password. Try again or click Forgot password to reset it.';

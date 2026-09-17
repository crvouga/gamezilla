/**
 * Which screen the human sees next. Google's decision table, reproduced:
 * who is already signed in to the browser, which `prompt` values the app
 * asked for, and whether this account has approved these scopes before.
 */

import type {
  IdpAccount,
  IdpAuthRequest,
  IdpBrowserSession,
} from '../../shared/types';
import { hasGrant, type IdpState, sessionAccounts } from '../idp-state';

export type AuthorizeStep =
  | { readonly kind: 'chooser'; readonly accounts: readonly IdpAccount[] }
  | {
      readonly kind: 'signin';
      readonly email: string;
      readonly error: string | null;
    }
  | { readonly kind: 'consent'; readonly account: IdpAccount }
  | { readonly kind: 'issue'; readonly account: IdpAccount }
  | { readonly kind: 'error'; readonly error: string; readonly detail: string };

function consentOrIssue(
  state: IdpState,
  request: IdpAuthRequest,
  account: IdpAccount
): AuthorizeStep {
  if (state.faults.denyConsent) {
    return {
      kind: 'error',
      error: 'access_denied',
      detail: 'The user denied the request.',
    };
  }
  const needsConsent =
    request.prompts.includes('consent') ||
    !hasGrant(state, account.sub, request.clientId, request.scopes);
  if (needsConsent) return { kind: 'consent', account };
  return { kind: 'issue', account };
}

/** `prompt=none` must never paint UI: it either completes or errors out. */
function silentStep(
  state: IdpState,
  request: IdpAuthRequest,
  accounts: readonly IdpAccount[]
): AuthorizeStep {
  const account = accounts[0];
  if (account === undefined) {
    return {
      kind: 'error',
      error: 'login_required',
      detail: 'The user is not signed in.',
    };
  }
  if (!hasGrant(state, account.sub, request.clientId, request.scopes)) {
    return {
      kind: 'error',
      error: 'consent_required',
      detail: 'The user has not approved these scopes.',
    };
  }
  return { kind: 'issue', account };
}

export function nextAuthorizeStep(args: {
  readonly state: IdpState;
  readonly request: IdpAuthRequest;
  readonly session: IdpBrowserSession;
  /** Set once the human has picked (or just authenticated) an account. */
  readonly chosen: IdpAccount | null;
}): AuthorizeStep {
  const { state, request, session, chosen } = args;
  if (chosen !== null) return consentOrIssue(state, request, chosen);

  const accounts = sessionAccounts(state, session);
  const hinted =
    request.loginHint === null
      ? undefined
      : accounts.find((account) => account.email === request.loginHint);
  if (request.prompts.includes('none')) {
    return silentStep(
      state,
      request,
      hinted === undefined ? accounts : [hinted]
    );
  }
  if (request.prompts.includes('login') || accounts.length === 0) {
    return { kind: 'signin', email: request.loginHint ?? '', error: null };
  }
  if (hinted !== undefined && !request.prompts.includes('select_account')) {
    return consentOrIssue(state, request, hinted);
  }
  if (request.prompts.includes('select_account') || accounts.length > 1) {
    return { kind: 'chooser', accounts };
  }
  const only = accounts[0];
  if (only === undefined) {
    return { kind: 'signin', email: '', error: null };
  }
  return consentOrIssue(state, request, only);
}

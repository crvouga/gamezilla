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
import type { IdpStore } from '../idp-state';

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

/** What a *chosen* account can lead to: never a chooser, never a sign-in. */
export type ChosenStep = Extract<
  AuthorizeStep,
  { kind: 'consent' | 'issue' | 'error' }
>;

async function consentOrIssue(
  store: IdpStore,
  request: IdpAuthRequest,
  account: IdpAccount
): Promise<ChosenStep> {
  const faults = await store.faults();
  if (faults.denyConsent) {
    return {
      kind: 'error',
      error: 'access_denied',
      detail: 'The user denied the request.',
    };
  }
  const needsConsent =
    request.prompts.includes('consent') ||
    !(await store.hasGrant(account.sub, request.clientId, request.scopes));
  if (needsConsent) return { kind: 'consent', account };
  return { kind: 'issue', account };
}

/** `prompt=none` must never paint UI: it either completes or errors out. */
async function silentStep(
  store: IdpStore,
  request: IdpAuthRequest,
  accounts: readonly IdpAccount[]
): Promise<AuthorizeStep> {
  const account = accounts[0];
  if (account === undefined) {
    return {
      kind: 'error',
      error: 'login_required',
      detail: 'The user is not signed in.',
    };
  }
  if (!(await store.hasGrant(account.sub, request.clientId, request.scopes))) {
    return {
      kind: 'error',
      error: 'consent_required',
      detail: 'The user has not approved these scopes.',
    };
  }
  return { kind: 'issue', account };
}

export async function nextAuthorizeStep(args: {
  readonly store: IdpStore;
  readonly request: IdpAuthRequest;
  readonly session: IdpBrowserSession;
  /** Set once the human has picked (or just authenticated) an account. */
  readonly chosen: IdpAccount | null;
}): Promise<AuthorizeStep> {
  const { store, request, session, chosen } = args;
  if (chosen !== null) return await consentOrIssue(store, request, chosen);

  const accounts = await store.sessionAccounts(session);
  const hinted =
    request.loginHint === null
      ? undefined
      : accounts.find((account) => account.email === request.loginHint);
  if (request.prompts.includes('none')) {
    return await silentStep(
      store,
      request,
      hinted === undefined ? accounts : [hinted]
    );
  }
  if (request.prompts.includes('login') || accounts.length === 0) {
    return { kind: 'signin', email: request.loginHint ?? '', error: null };
  }
  if (hinted !== undefined && !request.prompts.includes('select_account')) {
    return await consentOrIssue(store, request, hinted);
  }
  if (request.prompts.includes('select_account') || accounts.length > 1) {
    return { kind: 'chooser', accounts };
  }
  const only = accounts[0];
  if (only === undefined) {
    return { kind: 'signin', email: '', error: null };
  }
  return await consentOrIssue(store, request, only);
}

/**
 * The step for an account the human already chose or authenticated: consent,
 * a code, or a fault. `prompt=none` and the account chooser cannot appear.
 */
export async function nextChosenStep(args: {
  readonly store: IdpStore;
  readonly request: IdpAuthRequest;
  readonly account: IdpAccount;
}): Promise<ChosenStep> {
  return await consentOrIssue(args.store, args.request, args.account);
}

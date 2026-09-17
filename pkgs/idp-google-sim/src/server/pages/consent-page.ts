/** Consent + the generic error card (Google's "Error 400: …" screen). */

import { IDP_TEST_IDS } from '../../shared/test-ids';
import type { IdpAccount } from '../../shared/types';
import { escapeHtml, idpPage } from './layout';

const SCOPE_LABEL: Record<string, string> = {
  openid: 'Associate you with your personal info on Google',
  email: 'See your primary Google Account email address',
  profile:
    'See your personal info, including any that you have made publicly available',
};

function scopeItem(scope: string): string {
  const label = SCOPE_LABEL[scope] ?? scope;
  return `<li>${escapeHtml(label)}</li>`;
}

export function renderConsentPage(args: {
  readonly submitPath: string;
  readonly requestId: string;
  readonly appName: string;
  readonly account: IdpAccount;
  readonly scopes: readonly string[];
}): string {
  const body = `
  <h1>${escapeHtml(args.appName)} wants access to your Google Account</h1>
  <p class="sub">${escapeHtml(args.account.email)}</p>
  <p class="sub">This will allow ${escapeHtml(args.appName)} to:</p>
  <ul class="scopes">${args.scopes.map(scopeItem).join('')}</ul>
  <form method="post" action="${escapeHtml(args.submitPath)}">
    <input type="hidden" name="request_id" value="${escapeHtml(args.requestId)}" />
    <input type="hidden" name="step" value="consent" />
    <div class="actions">
      <button class="text" type="submit" name="decision" value="deny"
        data-testid="${IDP_TEST_IDS.consentDeny}">Cancel</button>
      <button class="primary" type="submit" name="decision" value="allow"
        data-testid="${IDP_TEST_IDS.consentAllow}">Continue</button>
    </div>
  </form>`;
  return idpPage({
    title: 'Sign in - Google Accounts',
    testId: IDP_TEST_IDS.consentPage,
    body,
  });
}

/**
 * Google refuses to redirect when the request itself is untrustworthy
 * (unknown client, unregistered redirect URI) and shows this instead.
 */
export function renderErrorPage(args: {
  readonly status: number;
  readonly error: string;
  readonly detail: string;
}): string {
  const body = `
  <h1>Error ${String(args.status)}: ${escapeHtml(args.error)}</h1>
  <p class="sub">${escapeHtml(args.detail)}</p>
  <p class="footer">You can't sign in because this app sent an invalid request.
  You can try again later, or contact the developer about this issue.</p>`;
  return idpPage({
    title: 'Error - Google Accounts',
    testId: IDP_TEST_IDS.errorPage,
    body,
  });
}

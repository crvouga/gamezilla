/** "Sign in" — email + password, the screen behind "Use another account". */

import { IDP_TEST_IDS } from '../../shared/test-ids';
import { escapeHtml, idpPage } from './layout';

export function renderSignInPage(args: {
  readonly submitPath: string;
  readonly requestId: string;
  readonly appName: string;
  readonly email: string;
  readonly error: string | null;
}): string {
  const error =
    args.error === null
      ? ''
      : `<p class="error" data-testid="${IDP_TEST_IDS.signInError}">${escapeHtml(args.error)}</p>`;
  const body = `
  <h1>Sign in</h1>
  <p class="sub">to continue to ${escapeHtml(args.appName)}</p>
  <form method="post" action="${escapeHtml(args.submitPath)}">
    <input type="hidden" name="request_id" value="${escapeHtml(args.requestId)}" />
    <input type="hidden" name="step" value="password" />
    <label for="idp-email">Email</label>
    <input id="idp-email" name="email" type="email" autocomplete="username"
      value="${escapeHtml(args.email)}" data-testid="${IDP_TEST_IDS.signInEmail}" />
    <label for="idp-password">Password</label>
    <input id="idp-password" name="password" type="password"
      autocomplete="current-password" data-testid="${IDP_TEST_IDS.signInPassword}" />
    ${error}
    <div class="actions">
      <button class="primary" type="submit" data-testid="${IDP_TEST_IDS.signInNext}">Next</button>
    </div>
  </form>`;
  return idpPage({
    title: 'Sign in - Google Accounts',
    testId: IDP_TEST_IDS.signInPage,
    body,
  });
}

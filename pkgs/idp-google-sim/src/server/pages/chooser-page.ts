/** "Choose an account" — the screen `prompt=select_account` always shows. */

import { IDP_TEST_IDS } from '../../shared/test-ids';
import type { IdpAccount } from '../../shared/types';
import { escapeHtml, idpPage, initials } from './layout';

function accountButton(account: IdpAccount): string {
  const sub = escapeHtml(account.sub);
  return `<button class="account" type="submit" name="sub" value="${sub}"
    data-testid="${escapeHtml(IDP_TEST_IDS.chooserAccount(account.sub))}">
    <span class="avatar" aria-hidden="true">${escapeHtml(initials(account.name))}</span>
    <span>
      <span class="account-name">${escapeHtml(account.name)}</span><br />
      <span class="account-email">${escapeHtml(account.email)}</span>
    </span>
  </button>`;
}

export function renderChooserPage(args: {
  readonly submitPath: string;
  readonly requestId: string;
  readonly appName: string;
  readonly accounts: readonly IdpAccount[];
}): string {
  const accounts = args.accounts.map(accountButton).join('\n');
  const body = `
  <h1>Choose an account</h1>
  <p class="sub">to continue to ${escapeHtml(args.appName)}</p>
  <form method="post" action="${escapeHtml(args.submitPath)}">
    <input type="hidden" name="request_id" value="${escapeHtml(args.requestId)}" />
    <input type="hidden" name="step" value="choose" />
    ${accounts}
    <div class="divider"></div>
    <button class="account" type="submit" name="sub" value=""
      data-testid="${IDP_TEST_IDS.chooserUseAnother}">
      <span class="avatar" aria-hidden="true">+</span>
      <span><span class="account-name">Use another account</span></span>
    </button>
  </form>
  <p class="footer">To continue, Google will share your name, email address, and
  profile picture with ${escapeHtml(args.appName)}.</p>`;
  return idpPage({
    title: 'Choose an account',
    testId: IDP_TEST_IDS.chooserPage,
    body,
  });
}

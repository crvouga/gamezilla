/**
 * Stable hooks on the IdP's own pages. Relying-party test suites drive these
 * the way a person drives the real Google screens, so a flow change here shows
 * up as a failing scenario rather than a silently different code path.
 */
export const IDP_TEST_IDS = {
  /** Back arrow on every screen that is not the first step. */
  back: 'idp-back',
  chooserPage: 'idp-chooser-page',
  chooserAccount: (sub: string) => `idp-chooser-account-${sub}`,
  chooserUseAnother: 'idp-chooser-use-another',
  chooserCreateAccount: 'idp-chooser-create-account',
  /** Step 1 asks for the address; step 2 asks for the password. */
  identifierPage: 'idp-identifier-page',
  identifierEmail: 'idp-identifier-email',
  identifierNext: 'idp-identifier-next',
  identifierError: 'idp-identifier-error',
  identifierCreateAccount: 'idp-identifier-create-account',
  /** The local-credentials note under the identifier card. */
  identifierAccounts: 'idp-identifier-accounts',
  identifierAccountsDatalist: 'idp-identifier-accounts-datalist',
  passwordPage: 'idp-password-page',
  passwordInput: 'idp-password-input',
  passwordNext: 'idp-password-next',
  passwordError: 'idp-password-error',
  passwordShow: 'idp-password-show',
  createAccountPage: 'idp-create-account-page',
  createAccountName: 'idp-create-account-name',
  createAccountEmail: 'idp-create-account-email',
  createAccountSubmit: 'idp-create-account-submit',
  createAccountError: 'idp-create-account-error',
  createAccountPassword: 'idp-create-account-password',
  consentPage: 'idp-consent-page',
  consentAllow: 'idp-consent-allow',
  consentDeny: 'idp-consent-deny',
  errorPage: 'idp-error-page',
} as const;

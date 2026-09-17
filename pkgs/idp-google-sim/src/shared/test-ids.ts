/**
 * Stable hooks on the IdP's own pages. Relying-party test suites drive these
 * the way a person drives the real Google screens, so a flow change here shows
 * up as a failing scenario rather than a silently different code path.
 */
export const IDP_TEST_IDS = {
  chooserPage: 'idp-chooser-page',
  chooserAccount: (sub: string) => `idp-chooser-account-${sub}`,
  chooserUseAnother: 'idp-chooser-use-another',
  signInPage: 'idp-signin-page',
  signInEmail: 'idp-signin-email',
  signInPassword: 'idp-signin-password',
  signInNext: 'idp-signin-next',
  signInError: 'idp-signin-error',
  consentPage: 'idp-consent-page',
  consentAllow: 'idp-consent-allow',
  consentDeny: 'idp-consent-deny',
  errorPage: 'idp-error-page',
} as const;

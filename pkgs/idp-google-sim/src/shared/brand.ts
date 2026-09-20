/**
 * The simulator's own identity brand.
 *
 * The wire is Google's — discovery, PKCE, code exchange, JWKS and the token
 * shapes all have to be, because the relying party runs its production
 * `google-oauth` path against this server. The **screens** are deliberately
 * not: a pixel clone of Google's sign-in teaches the wrong thing to anyone who
 * opens the simulator, and impersonating a real provider's mark is not
 * something a local test fixture should do. So the flow keeps parity — address
 * step, chooser, password, consent, account creation, refusal — under a
 * neutral brand of its own.
 *
 * Everything user-visible reads its name from here.
 */
export const IDP_BRAND = {
  /** Wordmark and the name every screen says out loud. */
  name: 'Acme ID',
  /** Sits under the wordmark in the footer; says what this really is. */
  tagline: 'Simulated identity provider',
} as const;

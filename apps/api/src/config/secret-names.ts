/**
 * Doppler keys — same names in `dev` and `prd` configs.
 *
 * Stripe key names are duplicated here (rather than imported from
 * `@libs/stripe/doppler-keys`) to avoid a turbo build cycle: the stripe
 * feature package depends on auth, which must not depend on stripe for these
 * literals.
 *
 * Keep `stripeSecretKey` / `stripeWebhookSecret` literals here aligned with
 * `libs/stripe/src/secret-keys.ts` (covered by a smoke test in stripe).
 */
export const ApiSecretName = {
  googleWebClientId: 'WEB_CLIENT_GOOGLE_CLIENT_ID',
  googleWebClientSecret: 'WEB_CLIENT_GOOGLE_CLIENT_SECRET',
  /** Secret for Better Auth session signing (`bun` / openssl random hex). */
  betterAuthSecret: 'BETTER_AUTH_SECRET',
  /** Optional display name; defaults to `gamezilla` when unset or blank. */
  betterAuthAppName: 'BETTER_AUTH_APP_NAME',
  /**
   * Optional newline-separated extra `trustedOrigins` for Better Auth (e.g.
   * staging URLs). When set (any non-blank line), origins are exactly
   * `API_URL` origin plus these lines. When unset, defaults include mobile
   * deep links and local wrangler URLs when `API_URL` points at localhost.
   */
  betterAuthTrustedOrigins: 'BETTER_AUTH_TRUSTED_ORIGINS',
  dbUrl: 'DB_URL',
  apiUrl: 'API_URL',
  stripeSecretKey: 'STRIPE_SECRET_KEY',
  stripeWebhookSecret: 'STRIPE_WEBHOOK_SECRET',
  /**
   * ElevenLabs API key for TTS synthesis. Required when the TTS sub-app
   * is mounted; the secret store crashes if it's missing.
   */
  elevenLabsApiKey: 'ELEVEN_LABS_API_KEY',
  /** OpenAI API key for LLM routes. Required; secret store crashes if missing. */
  openAiApiKey: 'OPENAI_API_KEY',
  /** OpenAI API base URL, e.g. `https://api.openai.com`. Required. */
  openAiBaseUrl: 'OPENAI_BASE_URL',
} as const;

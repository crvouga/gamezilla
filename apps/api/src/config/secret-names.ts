/**
 * Secret names — same keys in `dev` and `prd` configs.
 *
 * Stripe key names are duplicated here (rather than imported from
 * `@libs/stripe/secret-keys`) to avoid a turbo build cycle: the stripe
 * feature package depends on auth, which must not depend on stripe for these
 * literals.
 *
 * Keep `stripeSecretKey` / `stripeWebhookSecret` literals here aligned with
 * `libs/stripe/src/secret-keys.ts` (covered by a smoke test in stripe).
 */
export const ApiSecretName = {
  authPublishableKey: 'AUTH_PUBLISHABLE_KEY',
  authSecretKey: 'AUTH_SECRET_KEY',
  dbUrl: 'DATABASE_URL',
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
  s3AccessKeyId: 'S3_ACCESS_KEY_ID',
  s3SecretAccessKey: 'S3_SECRET_ACCESS_KEY',
  s3Bucket: 'S3_BUCKET',
  s3Endpoint: 'S3_ENDPOINT',
  s3Region: 'S3_REGION',
  powersyncJwtPrivateKey: 'POWERSYNC_JWT_PRIVATE_KEY',
  powersyncUrl: 'POWERSYNC_URL',
} as const;

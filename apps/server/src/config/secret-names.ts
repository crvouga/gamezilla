/**
 * Secret names — same keys in `dev` and `prd` configs.
 *
 * Billing vendor secret names live in `@pkgs/billing-stripe` and are read
 * only via `createStripeBillingFromSecretStore` (not listed here).
 */
export const ApiSecretName = {
  authSecret: 'AUTH_SECRET',
  webClientGoogleClientId: 'WEB_CLIENT_GOOGLE_CLIENT_ID',
  webClientGoogleClientSecret: 'WEB_CLIENT_GOOGLE_CLIENT_SECRET',
  dbUrl: 'DATABASE_URL',
  apiUrl: 'API_URL',
  /**
   * ElevenLabs API key for TTS synthesis. Required when the TTS sub-app
   * is mounted; the secret store crashes if it's missing.
   */
  elevenLabsApiKey: 'ELEVEN_LABS_API_KEY',
  /** OpenAI API key for LLM routes. Required; secret store crashes if missing. */
  openAiApiKey: 'OPENAI_API_KEY',
  /** OpenAI API base URL, e.g. `https://api.openai.com`. Required. */
  openAiBaseUrl: 'OPENAI_BASE_URL',
  s3AccessKeyId: 'B2_APP_KEY_ID',
  s3SecretAccessKey: 'B2_APP_KEY',
  s3Bucket: 'S3_BUCKET',
  s3Endpoint: 'S3_ENDPOINT',
  s3Region: 'S3_REGION',
  expoPublicObservabilityBackend: 'EXPO_PUBLIC_OBSERVABILITY_BACKEND',
} as const;

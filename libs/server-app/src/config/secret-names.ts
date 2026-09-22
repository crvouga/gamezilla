/**
 * Secret names — same keys in `dev` and `prd` configs.
 *
 * Billing provider and auth service secret names live in each provider's
 * package and are read only by that package's provider module (not listed
 * here).
 */
export const ApiSecretName = {
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
  s3AccessKeyId: 'S3_ACCESS_KEY_ID',
  s3SecretAccessKey: 'S3_SECRET_ACCESS_KEY',
  s3Bucket: 'S3_BUCKET',
  s3Endpoint: 'S3_ENDPOINT',
  s3Region: 'S3_REGION',
  viteObservabilityBackend: 'VITE_OBSERVABILITY_BACKEND',
} as const;

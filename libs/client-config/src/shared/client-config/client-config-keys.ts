/** Known `client_config.id` keys materialized from Worker secrets. */
export const ClientConfigKey = {
  googleEnabled: 'google_enabled',
  /** Sign in with Apple; only ever on in non-production (mock-backed). */
  appleEnabled: 'apple_enabled',
  googleWebClientId: 'google_web_client_id',
  billingEnabled: 'billing_enabled',
  ttsEnabled: 'tts_enabled',
  llmEnabled: 'llm_enabled',
  emqxWssUrl: 'emqx_wss_url',
  permissionPolicy: 'permission_policy',
  billingGracePeriodMs: 'billing_grace_period_ms',
} as const;

export type ClientConfigKeyId =
  (typeof ClientConfigKey)[keyof typeof ClientConfigKey];

export const CLIENT_CONFIG_KEYS: readonly ClientConfigKeyId[] = [
  ClientConfigKey.googleEnabled,
  ClientConfigKey.appleEnabled,
  ClientConfigKey.googleWebClientId,
  ClientConfigKey.billingEnabled,
  ClientConfigKey.ttsEnabled,
  ClientConfigKey.llmEnabled,
  ClientConfigKey.emqxWssUrl,
  ClientConfigKey.permissionPolicy,
  ClientConfigKey.billingGracePeriodMs,
];

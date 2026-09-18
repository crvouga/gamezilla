/** Known `client_config.id` keys materialized from Worker secrets. */
export const ClientConfigKey = {
  googleEnabled: 'google_enabled',
  googleWebClientId: 'google_web_client_id',
  billingEnabled: 'billing_enabled',
  ttsEnabled: 'tts_enabled',
  llmEnabled: 'llm_enabled',
  emqxWssUrl: 'emqx_wss_url',
  observabilityBackend: 'observability_backend',
} as const;

export type ClientConfigKeyId =
  (typeof ClientConfigKey)[keyof typeof ClientConfigKey];

export const CLIENT_CONFIG_KEYS: readonly ClientConfigKeyId[] = [
  ClientConfigKey.googleEnabled,
  ClientConfigKey.googleWebClientId,
  ClientConfigKey.billingEnabled,
  ClientConfigKey.ttsEnabled,
  ClientConfigKey.llmEnabled,
  ClientConfigKey.emqxWssUrl,
  ClientConfigKey.observabilityBackend,
];

export type ObservabilityBackendName = 'noop' | 'console';

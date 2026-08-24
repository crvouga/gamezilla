/** Infisical / Worker secret keys for the production EMQX pubsub broker. */
export const PubsubSecretName = {
  apiUrl: 'EMQX_API_URL',
  apiKey: 'EMQX_API_KEY',
  apiSecret: 'EMQX_API_SECRET',
  jwtSecret: 'EMQX_JWT_SECRET',
  /** Client MQTT WSS URL materialized into synced `client_config`. */
  wssUrl: 'EMQX_WSS_URL',
} as const;

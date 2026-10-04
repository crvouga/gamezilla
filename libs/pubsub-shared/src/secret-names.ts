/**
 * Invalidation credentials. `IOT_*` is the deployed AWS IoT publisher.
 * `EMQX_*` API names stay for the laptop broker, which has no IoT mode.
 * `jwtSecret` is the HMAC secret both the API and the IoT authorizer use.
 */
export const PubsubSecretName = {
  apiUrl: 'EMQX_API_URL',
  apiKey: 'EMQX_API_KEY',
  apiSecret: 'EMQX_API_SECRET',
  jwtSecret: 'EMQX_JWT_SECRET',
  /** Broker dashboard `admin` password (local sidecar only). */
  dashboardPassword: 'EMQX_DASHBOARD_PASSWORD',
  /** Client MQTT WebSocket URL materialized into synced `client_config`. */
  wssUrl: 'EMQX_WSS_URL',
  iotDataEndpoint: 'IOT_DATA_ENDPOINT',
  iotAccessKeyId: 'IOT_ACCESS_KEY_ID',
  iotSecretAccessKey: 'IOT_SECRET_ACCESS_KEY',
  iotRegion: 'IOT_REGION',
} as const;

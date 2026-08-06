/** Shared local EMQX listen ports. */
export const EMQX_MQTT_PORT = 1883;
export const EMQX_WS_PORT = 8083;
export const EMQX_DASHBOARD_PORT = 18083;

export const EMQX_LOCAL_PORTS = [
  EMQX_MQTT_PORT,
  EMQX_WS_PORT,
  EMQX_DASHBOARD_PORT,
] as const;

export const EMQX_MQTT_USER = 'pubsub';
export const EMQX_MQTT_PASS = 'pubsub';
export const EMQX_API_KEY = 'pubsub-test';
export const EMQX_API_SECRET = 'pubsub-test-secret';

/** Pinned open-source EMQX release for tarball fallback. */
export const EMQX_VERSION = '5.8.6';

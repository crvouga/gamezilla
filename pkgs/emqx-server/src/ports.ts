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
/** HMAC secret for local JWT authenticator — keep in sync with emqx.conf seed. */
export const EMQX_JWT_SECRET = 'local-emqx-jwt-secret-change-me';
/**
 * Local dashboard defaults. EMQX 5.8 requires password length 8–64, so the
 * historical stock `public` (6 chars) is rejected — use this instead.
 * `DEFAULT_PASSWORD` only seeds the admin user on first boot; after that,
 * reset with: `emqx ctl admins passwd admin <password>`.
 */
export const EMQX_DASHBOARD_USER = 'admin';
export const EMQX_DASHBOARD_PASS = 'public12';

/** Pinned open-source EMQX release for tarball fallback. */
export const EMQX_VERSION = '5.8.6';

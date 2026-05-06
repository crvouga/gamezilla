/** PatchDB entity type for public client runtime configuration (singleton). */
export const CLIENT_CONFIG_ENTITY_TYPE = 'clientConfig';

/** Stable singleton entity ID for client config — shared by server and all clients. */
export const CLIENT_CONFIG_ENTITY_ID = 'clientConfig__singleton';

export const ClientConfigAttr = {
  googleWebClientId: 'clientConfig/googleWebClientId',
  /** Clerk publishable key (`pk_…`) — synced from Doppler for Expo/web. */
  clerkPublishableKey: 'clientConfig/clerkPublishableKey',
} as const;

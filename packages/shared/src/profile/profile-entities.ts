/** PatchDB entity type for device-local user profile (presentation only). */
export const PROFILE_ENTITY_TYPE = 'profile';

/**
 * Profile row uses the same id as the device principal (`entityId === principalId`).
 */
export const ProfileAttr = {
  displayName: 'profile/displayName',
  avatarSeed: 'profile/avatarSeed',
} as const;

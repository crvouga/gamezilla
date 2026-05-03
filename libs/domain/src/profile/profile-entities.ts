/** PatchDB entity type for user profile (presentation only). */
export const PROFILE_ENTITY_TYPE = 'profile';

/**
 * One profile per identity:
 * - Guest / device-local: `entityId === deviceId`
 * - Signed-in account: `entityId === userId`
 */
export const ProfileAttr = {
  id: 'profile/id',
  createdAt: 'profile/createdAt',
  displayName: 'profile/displayName',
  avatarConfig: 'profile/avatarConfig',
} as const;

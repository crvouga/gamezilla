/** PatchDB entity type for user profile (presentation only). */
export const PROFILE_ENTITY_TYPE = 'profile';

/**
 * One profile per identity:
 * - Guest / device-local: `entityId === principalId`
 * - Signed-in account: `entityId === accountId`
 */
export const ProfileAttr = {
  id: 'profile/id',
  createdAt: 'profile/createdAt',
  displayName: 'profile/displayName',
  avatarConfig: 'profile/avatarConfig',
} as const;

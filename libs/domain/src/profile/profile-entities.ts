/** PatchDB entity type for user profile (presentation only). */
export const PROFILE_ENTITY_TYPE = 'profile';

/**
 * Profile rows use stable UUID `entityId`s. Legacy rows used `entityId === principalId`
 * and are migrated on first bootstrap.
 */
export const ProfileAttr = {
  id: 'profile/id',
  createdAt: 'profile/createdAt',
  displayName: 'profile/displayName',
  avatarConfig: 'profile/avatarConfig',
  /** Soft-delete marker — when true, profile is hidden from lists and selection. */
  deleted: 'profile/deleted',
  /** Principal id of the device/install that first wrote this profile row (PatchDB `patch/createdBy` semantics). */
  createdByPrincipalId: 'profile/createdByPrincipalId',
} as const;

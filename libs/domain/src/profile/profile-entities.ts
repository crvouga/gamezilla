import { createAttrNamespace } from '@gamezilla/lib/attribute';

import { parseAvatarConfig } from './avatar-config';

/** PatchDB entity type for user profile (presentation only). */
export const PROFILE_ENTITY_TYPE = 'profile';

function readString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function readDisplayName(v: unknown): string {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : '';
}

const profileNs = createAttrNamespace('profile');

/**
 * One profile per identity:
 * - Guest / device-local: `entityId === deviceId`
 * - Signed-in account: `entityId === userId`
 */
export const ProfileAttr = {
  id: profileNs('id', readString),
  createdAt: profileNs('createdAt', readString),
  displayName: profileNs('displayName', readDisplayName),
  avatarConfig: profileNs('avatarConfig', parseAvatarConfig),
} as const;

import { createAttrNamespace } from '@gamezilla/lib/attribute';

import { parseAvatarConfig } from './avatar-config';

function readString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function readDisplayName(v: unknown): string {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : '';
}

export const profileNs = createAttrNamespace('profile');

export const PROFILE_ENTITY_TYPE = profileNs.prefix;

/**
 * One profile per identity:
 * - Guest / device-local: `entityId === deviceId`
 * - Signed-in account: `entityId === userId`
 */
export const ProfileAttr = {
  id: profileNs('id', readString),
  createdAt: profileNs('created-at', readString),
  displayName: profileNs('display-name', readDisplayName),
  avatarConfig: profileNs('avatar-config', parseAvatarConfig),
} as const;

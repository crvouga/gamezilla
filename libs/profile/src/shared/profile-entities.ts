import { createAttrNamespace } from '@pkgs/attribute';

import { parseAvatarConfig, type AvatarConfig } from './avatar-config';

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
  id: profileNs.uuid('id', readString),
  createdAt: profileNs.timestamp('created-at', readString),
  displayName: profileNs.text('display-name', readDisplayName),
  username: profileNs.text('username', readString),
  usernameChangedAt: profileNs.timestamp('username-changed-at', readString),
  avatarConfig: profileNs.jsonOrNull<'avatar-config', AvatarConfig>(
    'avatar-config',
    parseAvatarConfig
  ),
} as const;

import { createAttrNamespace } from '@pkgs/attribute-shared/attribute';

import type { AvatarConfig } from './avatar-config';
import { parseAvatarConfig } from './avatar-config';

function readString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export const profileNs = createAttrNamespace('profile');

export const PROFILE_ENTITY_TYPE = profileNs.prefix;

/**
 * One profile per user (`users.id`).
 */
export const ProfileAttr = {
  id: profileNs.uuid('id', readString),
  createdAt: profileNs.timestamp('created-at', readString),
  username: profileNs.text('username', readString),
  usernameChangedAt: profileNs.timestamp('username-changed-at', readString),
  avatarConfig: profileNs.jsonOrNull<'avatar-config', AvatarConfig>(
    'avatar-config',
    parseAvatarConfig
  ),
} as const;

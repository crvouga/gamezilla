import {
  parseAvatarConfigAttr,
  type AvatarConfig,
} from '@gamezilla/domain/profile/avatar-config';
import { ProfileAttr } from '@gamezilla/domain/profile/profile-entities';

/**
 * Trimmed display name; empty string when missing or blank.
 *
 * Caller decides how to render an empty value (e.g. fallback to id, or
 * render an empty `<Text>` for layout consistency).
 */
export function parseDisplayName(raw: unknown): string {
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : '';
}

/**
 * Parses a `profile/avatarConfig` attribute value into an `AvatarConfig`,
 * delegating to the canonical parser. Returns `null` when the attribute is
 * missing or invalid (i.e. profile not synced yet).
 *
 * Inline parser for `useQueryAttribute`: receives just the raw value, wraps
 * it back into the shape `parseAvatarConfigAttr` expects.
 */
export function parseAvatarConfigAttrValue(raw: unknown): AvatarConfig | null {
  return parseAvatarConfigAttr(
    { [ProfileAttr.avatarConfig]: raw },
    ProfileAttr.avatarConfig
  );
}

import type { DisplayText } from '@pkgs/moderation-shared-ts/moderator';

import { moderationAlias } from './alias';
import type { AppModeration } from './policy';

/** A username as others may see it under `moderation`. */
export function displayUsername(
  moderation: AppModeration,
  username: string | null | undefined,
  profileId: string
): DisplayText {
  return moderation.display('username', username ?? '', { id: profileId });
}

/**
 * Label for a username: `@name` when shown as stored, the bare stand-in name
 * when it is no longer allowed (a stand-in is not a handle), `''` when there
 * is no name yet.
 */
export function usernameLabel(
  moderation: AppModeration,
  username: string | null | undefined,
  profileId: string,
  options: { readonly withAt?: boolean | undefined } = {}
): string {
  const shown = displayUsername(moderation, username, profileId);
  const text = shown.text ?? '';
  if (text.length === 0 || shown.masked) return text;
  return options.withAt === false ? text : `@${text}`;
}

/** Username text without `@` (a masked name becomes its stand-in name). */
export function usernameText(
  moderation: AppModeration,
  username: string | null | undefined,
  profileId: string
): string {
  return usernameLabel(moderation, username, profileId, { withAt: false });
}

/** The stand-in name shown for `profileId` while their username is masked. */
export function standInName(profileId: string): string {
  return moderationAlias(profileId);
}

/** A space's custom title as others may see it; `null` means use the default. */
export function spaceTitleText(
  moderation: AppModeration,
  title: string | null | undefined,
  spaceId: string
): string | null {
  if (title === null || title === undefined || title.length === 0) return null;
  return moderation.display('spaceTitle', title, { id: spaceId }).text;
}

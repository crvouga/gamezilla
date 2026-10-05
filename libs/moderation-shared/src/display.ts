import type { DisplayText } from '@pkgs/moderation-shared/moderator';

import { moderation } from './policy';

/** A username as others may see it. */
export function displayUsername(
  username: string | null | undefined,
  profileId: string
): DisplayText {
  return moderation.display('username', username ?? '', { id: profileId });
}

/**
 * Label for a username: `@name` when shown as stored, the bare alias when
 * masked (an alias is not a handle), `''` when there is no name yet.
 */
export function usernameLabel(
  username: string | null | undefined,
  profileId: string,
  options: { readonly withAt?: boolean | undefined } = {}
): string {
  const shown = displayUsername(username, profileId);
  const text = shown.text ?? '';
  if (text.length === 0 || shown.masked) return text;
  return options.withAt === false ? text : `@${text}`;
}

/** Username text without `@` (masked names become their alias). */
export function usernameText(
  username: string | null | undefined,
  profileId: string
): string {
  return usernameLabel(username, profileId, { withAt: false });
}

/** A space's custom title as others may see it; `null` means use the default. */
export function spaceTitleText(
  title: string | null | undefined,
  spaceId: string
): string | null {
  if (title === null || title === undefined || title.length === 0) return null;
  return moderation.display('spaceTitle', title, { id: spaceId }).text;
}

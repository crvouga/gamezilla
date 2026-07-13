export const SPACE_INVITE_KINDS = ['link', 'friend'] as const;

export type SpaceInviteKind = (typeof SPACE_INVITE_KINDS)[number];

export function isSpaceInviteKind(value: unknown): value is SpaceInviteKind {
  return (
    typeof value === 'string' &&
    (SPACE_INVITE_KINDS as readonly string[]).includes(value)
  );
}

/** Default TTL for link invites (7 days). */
export const SPACE_INVITE_DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

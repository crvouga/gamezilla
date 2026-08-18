import { createAttrNamespace } from '@pkgs/attribute';

function readNonEmptyStringOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function readTrimmedNullableString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

const spaceNs = createAttrNamespace('space');
/** Sync entity type for a user-hosted space (room). */
export const SPACE_ENTITY_TYPE = spaceNs.prefix;

function readVisibility(v: unknown): string {
  return typeof v === 'string' && v.length > 0 ? v : 'private';
}

export const SpaceAttr = {
  title: spaceNs.textOrNull('title', readNonEmptyStringOrNull),
  /**
   * Creating install device id (legacy / reconnect hint). Host *authority* is
   * {@link SpaceAttr.hostMemberId}.
   */
  hostId: spaceNs.textOrNull('host-id', readNonEmptyStringOrNull).indexed(),
  /** Indexed + sortable: the lobby lists live spaces newest-first. */
  createdAt: spaceNs
    .timestampOrNull('created-at', readTrimmedNullableString)
    .indexed({ sortable: true }),
  /** `null` when the space is still live; ISO timestamp string when ended. */
  endedAt: spaceNs
    .timestampOrNull('ended-at', readTrimmedNullableString)
    .indexed(),
  /** `public` | `private`. Indexed for lobby section filters. */
  visibility: spaceNs.text('visibility', readVisibility).indexed(),
  /** Host account id when signed in; null for anonymous hosts. */
  hostAccountId: spaceNs
    .textOrNull('host-account-id', readNonEmptyStringOrNull)
    .indexed(),
  /** Host member id (account id). Authoritative for host checks. */
  hostMemberId: spaceNs
    .textOrNull('host-member-id', readNonEmptyStringOrNull)
    .indexed(),
} as const;

/**
 * ACL collaborator: `${spaceId}:${userId}`.
 */
export const spaceUserNs = createAttrNamespace('space', 'user');

export const SPACE_USER_ENTITY_TYPE = spaceUserNs.prefix;

function readString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export const SpaceUserAttr = {
  spaceId: spaceUserNs.text('space-id', readString).indexed(),
  userId: spaceUserNs.text('user-id', readString).indexed(),
  createdAt: spaceUserNs
    .timestampOrNull('created-at', readTrimmedNullableString)
    .indexed({ sortable: true }),
  createdByAccountId: spaceUserNs.text('created-by-account-id', readString),
} as const;

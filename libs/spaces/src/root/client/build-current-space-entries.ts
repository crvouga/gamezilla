import { isViewerSpaceHost } from '../../shared/space/resolve-space-presence';

export type CurrentSpaceEntry = {
  spaceId: string;
  role: 'host' | 'guest';
};

export type CurrentSpaceRow = {
  readonly id: string;
  readonly host_member_id: string | null;
  readonly host_account_id: string | null;
  readonly ended_at: string | null;
};

/**
 * Build miniplayer entries from open-session JOIN live space rows.
 * Ended rows are never included — DB `ended_at` is authoritative.
 */
export function buildCurrentSpaceEntries(
  spaceRows: readonly CurrentSpaceRow[],
  memberId: string
): CurrentSpaceEntry[] {
  const entries: CurrentSpaceEntry[] = [];
  const seen = new Set<string>();
  for (const space of spaceRows) {
    if (space.id.length === 0 || seen.has(space.id)) continue;
    // Some drivers omit null columns → undefined; treat like SQL NULL.
    if (space.ended_at != null) continue;
    seen.add(space.id);
    entries.push({
      spaceId: space.id,
      role: isViewerSpaceHost(
        {
          host_member_id: space.host_member_id,
          host_account_id: space.host_account_id,
          ended_at: space.ended_at,
        },
        memberId
      )
        ? 'host'
        : 'guest',
    });
  }
  return entries;
}

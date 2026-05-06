import type { SpaceMemberRow } from './types';

export type GroupedSpaceMembers = {
  host: SpaceMemberRow | null;
  guests: SpaceMemberRow[];
};

/**
 * Dedupes by `memberId` (prefer host row if both exist), then splits host vs guests.
 */
export function groupSpaceMembers(members: SpaceMemberRow[]): GroupedSpaceMembers {
  const byId = new Map<string, SpaceMemberRow>();
  for (const m of members) {
    const prev = byId.get(m.memberId);
    if (!prev || (prev.role === 'guest' && m.role === 'host')) {
      byId.set(m.memberId, m);
    }
  }
  const list = [...byId.values()];
  const host = list.find((m) => m.role === 'host') ?? null;
  const guests = list
    .filter((m) => m.role === 'guest')
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  return { host, guests };
}

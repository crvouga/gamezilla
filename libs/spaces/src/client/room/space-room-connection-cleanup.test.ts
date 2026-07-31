import { describe, expect, it } from 'bun:test';

/**
 * Documents the Meet-style connection contract enforced by
 * {@link useSpaceRoomConnection} + {@link SpaceOpenRoomsProvider}:
 * effect cleanup must destroy an active room/transport so Close→reopen
 * cannot stack orphan WebSockets when the detail bridge remounts.
 *
 * The host owns lifetime via openSpaceIds; the connect effect still must
 * tear down on its own cleanup when a slot unmounts (leave/end).
 */
describe('space room connection cleanup contract', () => {
  it('treats leave/markClosed as the only intentional disconnect', () => {
    const openSpaceIds = ['space-a'];
    const markClosed = (spaceId: string): string[] =>
      openSpaceIds.filter((id) => id !== spaceId);

    // Close detail does not call markClosed — connection host keeps the id.
    const afterCloseDetail = [...openSpaceIds];
    expect(afterCloseDetail).toEqual(['space-a']);

    // Leave removes the id → SpaceOpenRoomSlot unmount → tearDown.
    const afterLeave = markClosed('space-a');
    expect(afterLeave).toEqual([]);
  });

  it('reuses session clientId across detail remounts while still open', () => {
    const session = new Map<string, string>();
    let seq = 0;
    const getOrCreate = (spaceId: string): string => {
      const existing = session.get(spaceId);
      if (existing !== undefined) return existing;
      seq += 1;
      const next = `client-${seq}`;
      session.set(spaceId, next);
      return next;
    };

    const firstMount = getOrCreate('space-a');
    // Detail unmount (Close) — session map not cleared.
    const secondMount = getOrCreate('space-a');
    expect(secondMount).toBe(firstMount);

    session.delete('space-a'); // leave
    const afterLeave = getOrCreate('space-a');
    expect(afterLeave).not.toBe(firstMount);
  });
});

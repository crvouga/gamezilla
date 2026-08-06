import { describe, expect, it } from 'bun:test';

/**
 * Documents the Meet-style connection contract enforced by
 * {@link useSpaceRoomConnection} + {@link SpaceOpenRoomsProvider}:
 * effect cleanup must destroy an active room/transport so Close→reopen
 * cannot stack orphan WebSockets when the detail bridge remounts.
 *
 * The host owns lifetime via `space_open_sessions`; the connect
 * effect still must tear down on its own cleanup when a slot unmounts.
 */
describe('space room connection cleanup contract', () => {
  it('treats session-row delete as the only intentional disconnect', () => {
    const openSessionIds = ['space-a'];
    const closeSession = (spaceId: string): string[] =>
      openSessionIds.filter((id) => id !== spaceId);

    // Close detail does not delete the session — connection host keeps the id.
    const afterCloseDetail = [...openSessionIds];
    expect(afterCloseDetail).toEqual(['space-a']);

    // Leave/end deletes the session → SpaceOpenRoomSlot unmount → tearDown.
    const afterLeave = closeSession('space-a');
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
    // Detail unmount (Close) — session row (here: map) not cleared.
    const secondMount = getOrCreate('space-a');
    expect(secondMount).toBe(firstMount);

    session.delete('space-a'); // leave
    const afterLeave = getOrCreate('space-a');
    expect(afterLeave).not.toBe(firstMount);
  });
});

import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import type { MatchRoomGame } from '@libs/game-matchmaking-shared-ts/match-room';

/** A room can provide live metadata only for the game currently displayed. */
export function matchingMultiplayerRoomGame(
  current: Pick<MultiplayerGame, 'id' | 'revision'> | null,
  room: MatchRoomGame | null
): MatchRoomGame | null {
  return current !== null &&
    room !== null &&
    room.id === current.id &&
    room.revision >= current.revision
    ? room
    : null;
}

/**
 * A live game's result reaches its stored row only on the server's next
 * sweep, while the device's match room already holds it: until that room is
 * restored, an ongoing stored row of a live game is not yet its state.
 */
export function awaitsMatchRoom(
  row: Pick<MultiplayerGame, 'outcome' | 'fen'> | null,
  opening: boolean,
  rules: {
    readonly forPosition: (fen: string) => { readonly id: string };
    readonly simulation: (id: string) => unknown;
  }
): boolean {
  return (
    row !== null &&
    opening &&
    row.outcome === 'ongoing' &&
    rules.simulation(rules.forPosition(row.fen).id) !== undefined
  );
}

import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createQuery } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import type { Accessor } from 'solid-js';

/**
 * A person's own dealt hand in their matched game, for a game whose
 * authority deals hands: the one row this device holds (only their own ever
 * reaches it), `null` for anyone else and every other game.
 */
export function useMultiplayerHand(
  game: Accessor<MultiplayerGame | null>,
  myId: Accessor<string>
): Accessor<string | null> {
  const own = createQuery(
    () => sql<{ hand: string }>`SELECT hand FROM chess_multiplayer_hands
    WHERE game_id = ${game()?.id ?? ''} AND owner_id = ${myId()} AND deleted_at IS NULL`
  );
  return () => own.rows()[0]?.hand ?? null;
}

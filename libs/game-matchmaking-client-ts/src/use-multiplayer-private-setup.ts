import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import {
  awaitingSetups,
  setupReadySides,
} from '@libs/game-matchmaking-shared-ts/game-state';
import { multiplayerSideOf } from '@libs/game-matchmaking-shared-ts/multiplayer-roster';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createQuery } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { useTurnGames } from '@pkgs/turn-game-client-ts/turn-games-context';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { useRandom } from '@pkgs/uuid-client-ts/solid';
import { type Accessor, createMemo, createSignal } from 'solid-js';

/**
 * A person's own private setup in their matched game: the one this device
 * holds (only their own ever reaches it), the arrangement they are making,
 * and which sides are ready — public, while the setups are not.
 */
export function useMultiplayerPrivateSetup(
  game: Accessor<MultiplayerGame | null>,
  myId: Accessor<string>
) {
  const rules = useTurnGames();
  const random = useRandom();
  const own = createQuery(
    () => sql<{ setup: string }>`SELECT setup FROM chess_multiplayer_setups
    WHERE game_id = ${game()?.id ?? ''} AND owner_id = ${myId()} AND deleted_at IS NULL`
  );
  const setupRules = createMemo(() => {
    const current = game();
    return current === null ? undefined : rules.forPosition(current.fen).setup;
  });
  const side = createMemo(() => {
    const current = game();
    if (current === null) return null;
    return multiplayerSideOf(current, myId());
  });
  const [arranged, setArranged] = createSignal<{
    readonly gameId: string;
    readonly setup: string;
  } | null>(null);
  const draft = createMemo((): string => {
    const choice = arranged();
    return choice !== null && choice.gameId === game()?.id ? choice.setup : '';
  });
  const ownSetup = (): string | null => own.rows()[0]?.setup ?? null;
  return {
    has: (): boolean => setupRules() !== undefined,
    side,
    own: ownSetup,
    draft,
    /** Whether the person still has a setup to choose in an unfinished game. */
    choosing: (): boolean => {
      const current = game();
      const mine = side();
      return (
        current !== null &&
        mine !== null &&
        awaitingSetups(current) &&
        !setupReadySides(current).includes(mine)
      );
    },
    ready: (which: GameSide): boolean => {
      const current = game();
      return current !== null && setupReadySides(current).includes(which);
    },
    arrange: (setup: string): void => {
      const id = game()?.id;
      if (id !== undefined) setArranged({ gameId: id, setup });
    },
    complete: (): boolean => setupRules()?.accept(draft()) != null,
    random: (): void => {
      const drawn = setupRules()?.random(random);
      const id = game()?.id;
      if (drawn !== undefined && id !== undefined)
        setArranged({ gameId: id, setup: drawn });
    },
  };
}

export type MultiplayerPrivateSetup = ReturnType<
  typeof useMultiplayerPrivateSetup
>;

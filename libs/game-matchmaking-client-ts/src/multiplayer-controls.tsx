import { multiplayerSides } from '@libs/game-matchmaking-shared-ts/multiplayer-roster';
import { useTurnGames } from '@pkgs/turn-game-client-ts/turn-games-context';
import { gameSides } from '@pkgs/turn-game-shared-ts/game-rules';
import { type Accessor, createMemo, createSignal } from 'solid-js';
import type {
  MultiplayerConfirm,
  MultiplayerNext,
  MultiplayerStage,
} from './multiplayer-screen-view';
import type { MultiplayerControlsModel } from './use-multiplayer-controls';
import type { MultiplayerData } from './use-multiplayer-data';
import { useMultiplayerSearch } from './use-multiplayer-search';

/** What the stage shows, from the game and search the space's host holds. */
export function multiplayerStage(data: MultiplayerData): MultiplayerStage {
  if (data.game() !== null) return 'game';
  if (data.search() !== null) return 'search';
  return data.loading() ? 'loading' : 'unavailable';
}

/**
 * What comes after a game, or before the first: the search under way, or
 * the choice of a time control for a new one. A watcher is offered neither.
 */
export function useMultiplayerNext(
  data: MultiplayerData
): Accessor<MultiplayerNext> {
  const rules = useTurnGames();
  const search = useMultiplayerSearch(data.search);
  return createMemo((): MultiplayerNext => {
    const waiting = search();
    if (waiting !== null) return { kind: 'searching', search: waiting };
    const mayFind =
      !data.loading() &&
      (data.participant() || data.hostId() === data.myId()) &&
      data.game()?.outcome !== 'ongoing';
    if (!mayFind) return { kind: 'none' };
    return {
      kind: 'find',
      players: gameSides(rules.byId(data.gameId())).length,
      timed:
        rules.capability(data.gameId(), 'matchmaking')?.clockChoices === true,
    };
  });
}

/** The resign or abort waiting to be confirmed, and carrying it out. */
export function useMultiplayerConfirm(
  data: MultiplayerData,
  controls: MultiplayerControlsModel
) {
  const [confirming, setConfirming] = createSignal<MultiplayerConfirm | null>(
    null
  );
  return {
    confirming,
    open: setConfirming,
    close: () => setConfirming(null),
    manyPlayers: () => {
      const game = data.game();
      return game !== null && multiplayerSides(game).length > 2;
    },
    run: () =>
      confirming() === 'abort' ? controls.abort() : controls.resign(),
  };
}

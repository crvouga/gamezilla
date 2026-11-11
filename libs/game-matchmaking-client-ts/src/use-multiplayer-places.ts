import { awaitingSetups } from '@libs/game-matchmaking-shared-ts/game-state';
import { multiplayerSides } from '@libs/game-matchmaking-shared-ts/multiplayer-roster';
import { DEFAULT_TIME_CONTROL } from '@libs/game-matchmaking-shared-ts/time-control';
import { useTurnGames } from '@pkgs/turn-game-client-ts/turn-games-context';
import {
  type ScreenPlaceNavigation,
  useScreenPlace,
} from '@pkgs/turn-game-client-ts/use-screen-place';
import { gameSides } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
} from 'solid-js';
import type { MultiplayerFindChoice } from './multiplayer-find-view';
import type { MultiplayerConfirm } from './multiplayer-game-view';
import {
  MULTIPLAYER_PLACES,
  type MultiplayerPlace,
  type MultiplayerStage,
  multiplayerPlaceKept,
  multiplayerStageOf,
} from './multiplayer-places';
import type { MultiplayerControlsModel } from './use-multiplayer-controls';
import type { MultiplayerData } from './use-multiplayer-data';

/**
 * The stage finding an opponent stands in, from the game and the search
 * the space's host holds and whether this person may see them.
 */
export function useMultiplayerStage(
  data: MultiplayerData,
  denied: Accessor<boolean>
): Accessor<MultiplayerStage> {
  const rules = useTurnGames();
  return createMemo(() => {
    const game = data.game();
    return multiplayerStageOf({
      denied: denied(),
      loading: data.loading(),
      game:
        game === null
          ? null
          : {
              ongoing: game.outcome === 'ongoing',
              awaitingSetups:
                rules.forPosition(game.fen).setup !== undefined &&
                awaitingSetups(game),
            },
      searching: data.search()?.standing === 'waiting',
      mayFind: data.participant() || data.hostId() === data.myId(),
    });
  });
}

type Shown = {
  readonly stage: MultiplayerStage;
  readonly place: MultiplayerPlace;
};

/**
 * The place this device shows within the stage. A stage change forgets the
 * place opened before it, so returning to an earlier stage opens on its
 * home too; the one exception is `multiplayerPlaceKept`. Leaving the moves,
 * by Back, by opening another place or by a stage change that does not
 * keep them, calls `leaveMoves`: the board returns to the game as it
 * stands.
 */
export function useMultiplayerPlaces(
  stage: Accessor<MultiplayerStage>,
  leaveMoves: () => void
): ScreenPlaceNavigation<MultiplayerPlace> {
  const nav = useScreenPlace(MULTIPLAYER_PLACES, stage);
  createEffect<Shown | undefined>((before) => {
    const shown: Shown = { stage: stage(), place: nav.place() };
    if (before === undefined) return shown;
    if (shown.stage !== before.stage) {
      const kept = multiplayerPlaceKept(before, shown.stage);
      if (kept !== null) {
        nav.open(kept);
        return { stage: shown.stage, place: kept };
      }
      nav.home();
    }
    if (before.place.screen === 'moves' && shown.place.screen !== 'moves')
      leaveMoves();
    return shown;
  });
  return nav;
}

/** What a new search from this screen is for, at the clock this device chose. */
export function useMultiplayerFind(data: MultiplayerData) {
  const rules = useTurnGames();
  const [timeControl, setTimeControl] = createSignal(DEFAULT_TIME_CONTROL);
  const find = createMemo(
    (): MultiplayerFindChoice => ({
      players: gameSides(rules.byId(data.gameId())).length,
      timed:
        rules.capability(data.gameId(), 'matchmaking')?.clockChoices === true,
      timeControl: timeControl(),
    })
  );
  return { find, choose: setTimeControl };
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
    open: (kind: MultiplayerConfirm): void => {
      setConfirming(kind);
    },
    close: (): void => {
      setConfirming(null);
    },
    manyPlayers: (): boolean => {
      const game = data.game();
      return game !== null && multiplayerSides(game).length > 2;
    },
    run: () =>
      confirming() === 'abort' ? controls.abort() : controls.resign(),
  };
}

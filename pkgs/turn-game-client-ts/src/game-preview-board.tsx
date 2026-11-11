import type { GameFrameBoardProps } from '@pkgs/turn-game-shared-ts/game-frame';
import { type GameSide, gameSides } from '@pkgs/turn-game-shared-ts/game-rules';
import { createMemo, type JSX, Show, untrack } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { useGamePresentation, useTurnGames } from './turn-games-context';

const ignoreAction = (): void => undefined;

/**
 * A game's board at its starting position, as its own frame draws it: the
 * picture of what is about to be played, on a lobby or a search before any
 * game exists. It faces `viewer` (else the first side), carries no private
 * setup, hand or commitment, and nothing on it is pressed.
 */
export function GamePreviewBoard(props: {
  readonly gameId: string;
  readonly viewer?: GameSide | null | undefined;
  readonly testId: string;
}): JSX.Element {
  const games = useTurnGames();
  const presentation = useGamePresentation();
  const start = createMemo(() => {
    // A game its simulation runs has no still position to picture.
    if (games.simulation(props.gameId) !== undefined) return undefined;
    const rules = games.byId(props.gameId);
    const position = rules.initial();
    return {
      position,
      sides: gameSides(rules),
      frame: presentation(position).frame,
    };
  });
  const viewer = (): GameSide | null => props.viewer ?? null;
  return (
    <Show when={start()} keyed>
      {(shown) => {
        const session = untrack(() =>
          shown.frame.createBoard(previewProps(shown, viewer, props.testId))
        );
        return <Dynamic component={session.Board} />;
      }}
    </Show>
  );
}

type PreviewStart = {
  readonly position: string;
  readonly sides: readonly GameSide[];
  readonly frame: ReturnType<ReturnType<typeof useGamePresentation>>['frame'];
};

function previewProps(
  start: PreviewStart,
  viewer: () => GameSide | null,
  testId: string
): GameFrameBoardProps {
  return {
    simulation: undefined,
    position: start.position,
    lastAction: null,
    get orientation() {
      return viewer() ?? start.sides[0] ?? 'white';
    },
    interactive: false,
    sound: false,
    syncKey: 0,
    onAction: ignoreAction,
    testId,
    setup: null,
    hand: null,
    committed: [],
    commitment: null,
    get viewer() {
      return viewer();
    },
    seats: start.sides.map((side) => ({
      side,
      look: start.frame.seats.look(side),
    })),
  };
}

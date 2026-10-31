import type {
  MultiplayerGame,
  MultiplayerSide,
} from '@libs/game-matchmaking-shared-ts/game-state';
import { awaitingSetups } from '@libs/game-matchmaking-shared-ts/game-state';
import {
  multiplayerOwner,
  multiplayerSideOf,
  multiplayerSides,
} from '@libs/game-matchmaking-shared-ts/multiplayer-roster';
import { useSoundsPreference } from '@pkgs/sounds-client-ts/solid';
import {
  useGamePresentation,
  useTurnGames,
} from '@pkgs/turn-game-client-ts/turn-games-context';
import type { GameFrameBoardProps } from '@pkgs/turn-game-shared-ts/game-frame';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { For, type JSX, Show } from 'solid-js';
import { MultiplayerFrameBoard } from './multiplayer-frame-board';
import { MultiplayerReviewing } from './multiplayer-reviewing';
import type { MultiplayerViewer } from './multiplayer-seat';
import { MultiplayerSeat } from './multiplayer-seat';
import { MultiplayerStatus } from './multiplayer-status';
import { useLowOnTime, useLowOnTimeWarning } from './use-low-on-time';
import type { MatchRoomClient } from './use-match-room';
import { useMatchedSimulation } from './use-matched-simulation';
import type { OwnBoard } from './use-own-board';
import { useShownName } from './use-shown-name';

const otherSide = (side: MultiplayerSide): MultiplayerSide =>
  side === 'white' ? 'black' : 'white';

type BoardProps = {
  readonly game: MultiplayerGame;
  readonly room: MatchRoomClient | null;
  readonly myId: string;
  readonly connected: boolean;
  readonly moving: boolean;
  readonly syncKey: number;
  readonly view: OwnBoard;
  readonly onMove: (uci: string) => Promise<void>;
  /** The viewer's own private setup in this game, if it has one. */
  readonly ownSetup: string | null;
  /** The viewer's own dealt hand in this game, if it deals hands. */
  readonly ownHand: string | null;
};

/**
 * The board and the two seats around it, as this device shows them: seen
 * from the person's own side until they flip it, and on the current
 * position until they review an earlier one, which no piece can be moved on.
 */
function BoardStage(
  props: BoardProps & {
    readonly viewer: MultiplayerViewer;
    /** The person's own side; White's for a watcher. */
    readonly ownSide: MultiplayerSide;
    readonly canMove: boolean;
    readonly simulation: ReturnType<typeof useMatchedSimulation>;
  }
): JSX.Element {
  const sounds = useSoundsPreference();
  const presentation = useGamePresentation();
  // The side nearest the person: their own, until they flip the board.
  const nearSide = (): MultiplayerSide =>
    props.view.flipped() ? otherSide(props.ownSide) : props.ownSide;
  const board: GameFrameBoardProps = {
    get position() {
      return (
        props.simulation.position() ??
        props.view.earlier()?.fen ??
        props.game.fen
      );
    },
    get simulation() {
      return props.simulation.active()
        ? props.simulation.controls()
        : undefined;
    },
    get orientation() {
      return nearSide();
    },
    get interactive() {
      return props.canMove && props.view.earlier() === null;
    },
    get sound() {
      return !sounds.muted();
    },
    get syncKey() {
      return props.syncKey;
    },
    testId: 'multiplayer-board',
    get setup() {
      return props.ownSetup;
    },
    get hand() {
      return props.ownHand;
    },
    committed: [],
    commitment: null,
    get viewer() {
      return multiplayerSideOf(props.game, props.myId);
    },
    get seats() {
      const frame = presentation(props.game.fen).frame;
      return multiplayerSides(props.game).map((side) => ({
        side,
        look: frame.seats.look(side),
      }));
    },
    onAction: (action) => {
      void props.onMove(action);
    },
  };
  return (
    <GameBoardStage
      others={
        <StackVertical gap="sm">
          <For
            each={multiplayerSides(props.game).filter(
              (side) => side !== nearSide()
            )}
          >
            {(side) => (
              <MultiplayerSeat
                game={props.game}
                side={side}
                own={side === props.ownSide}
                near={false}
                viewer={props.viewer}
              />
            )}
          </For>
        </StackVertical>
      }
      own={
        <MultiplayerSeat
          game={props.game}
          side={nearSide()}
          own={nearSide() === props.ownSide}
          near
          viewer={props.viewer}
        />
      }
    >
      <MultiplayerFrameBoard
        presentation={presentation(props.game.fen)}
        board={board}
      />
    </GameBoardStage>
  );
}

export function MultiplayerBoard(props: BoardProps): JSX.Element {
  const rules = useTurnGames();
  const simulation = useMatchedSimulation(
    () => props.game,
    () => props.room,
    () => props.myId,
    () => props.connected
  );
  const lowOnTime = useLowOnTime(() => props.game);
  useLowOnTimeWarning({
    game: () => props.game,
    myId: () => props.myId,
    low: lowOnTime,
  });
  const ownSide = () => multiplayerSideOf(props.game, props.myId) ?? 'white';
  const participant = () => multiplayerSideOf(props.game, props.myId) !== null;
  const canMove = () =>
    participant() &&
    props.connected &&
    !props.moving &&
    props.game.outcome === 'ongoing' &&
    props.game.paused_at_ms === null &&
    !awaitingSetups(props.game) &&
    (simulation.active()
      ? !simulation.controls().paused && !simulation.controls().stale
      : props.game.turn === props.myId);
  // A watcher sees the board from White's side.
  const other = () =>
    multiplayerSides(props.game).find((side) => side !== ownSide()) ?? 'black';
  const opponentName = useShownName(() =>
    multiplayerOwner(props.game, other())
  );
  const winnerName = useShownName(() =>
    multiplayerSides(props.game).includes(props.game.outcome as MultiplayerSide)
      ? multiplayerOwner(props.game, props.game.outcome as MultiplayerSide)
      : ''
  );
  const viewer = (): MultiplayerViewer => ({
    myId: props.myId,
    participant: participant(),
    opponentName: opponentName(),
    opponentRating: props.game[`${other()}_rating`] ?? '',
  });
  return (
    <StackVertical
      gap="md"
      testId="multiplayer-game"
      dataSet={{
        'game-id': props.game.id,
        'can-move': String(canMove()),
        'board-takes-moves': String(canMove() && props.view.earlier() === null),
        revision: String(props.game.revision),
        fen: props.game.fen,
        'shown-position':
          simulation.position() ?? props.view.earlier()?.fen ?? props.game.fen,
        outcome: props.game.outcome,
        reason: props.game.reason ?? '',
      }}
    >
      <BoardStage
        {...props}
        viewer={viewer()}
        ownSide={ownSide()}
        canMove={canMove()}
        simulation={simulation}
      />
      <Show when={rules.turnsForPosition(props.game.fen) !== undefined}>
        <MultiplayerReviewing view={props.view} />
      </Show>
      <MultiplayerStatus
        game={props.game}
        viewer={viewer()}
        winnerName={winnerName()}
        lowOnTime={lowOnTime()}
      />
    </StackVertical>
  );
}

import type {
  MultiplayerGame,
  MultiplayerSide,
} from '@libs/game-matchmaking-shared-ts/game-state';
import { awaitingSetups } from '@libs/game-matchmaking-shared-ts/game-state';
import {
  multiplayerSideOf,
  multiplayerSides,
} from '@libs/game-matchmaking-shared-ts/multiplayer-roster';
import { useSoundsPreference } from '@pkgs/sounds-client-ts/solid';
import { useGamePresentation } from '@pkgs/turn-game-client-ts/turn-games-context';
import type { GameFrameBoardProps } from '@pkgs/turn-game-shared-ts/game-frame';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { For, type JSX } from 'solid-js';
import { MultiplayerFrameBoard } from './multiplayer-frame-board';
import type { MultiplayerViewer } from './multiplayer-seat';
import { MultiplayerSeat } from './multiplayer-seat';
import { MultiplayerStatus } from './multiplayer-status';
import { useLowOnTime } from './use-low-on-time';
import type { MatchRoomClient } from './use-match-room';
import { useMatchedSimulation } from './use-matched-simulation';
import { useMultiplayerViewer } from './use-multiplayer-viewer';
import type { OwnBoard } from './use-own-board';

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
  /** What lies over the board: the versus card, the result card. */
  readonly overlay?: JSX.Element | undefined;
};

/** Every seat but the one nearest the person, above the board. */
function OtherSeats(props: {
  readonly game: MultiplayerGame;
  readonly position: string;
  readonly near: MultiplayerSide;
  readonly ownSide: MultiplayerSide;
  readonly viewer: MultiplayerViewer;
}): JSX.Element {
  return (
    <StackVertical gap="sm">
      <For
        each={multiplayerSides(props.game).filter(
          (side) => side !== props.near
        )}
      >
        {(side) => (
          <MultiplayerSeat
            game={props.game}
            position={props.position}
            side={side}
            own={side === props.ownSide}
            near={false}
            viewer={props.viewer}
          />
        )}
      </For>
    </StackVertical>
  );
}

/** What the harness and the tests read of the game from its stage. */
function gameMark(
  props: BoardProps & { readonly canMove: boolean },
  shown: string
): Record<string, string> {
  return {
    testid: 'multiplayer-game',
    'game-id': props.game.id,
    'can-move': String(props.canMove),
    'board-takes-moves': String(props.canMove && props.view.earlier() === null),
    revision: String(props.game.revision),
    fen: props.game.fen,
    'shown-position': shown,
    outcome: props.game.outcome,
    reason: props.game.reason ?? '',
  };
}

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
  const shown = () =>
    props.simulation.position() ?? props.view.earlier()?.fen ?? props.game.fen;
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
      overlay={props.overlay}
      dataSet={gameMark(props, shown())}
      others={
        <OtherSeats
          game={props.game}
          position={board.position}
          near={nearSide()}
          ownSide={props.ownSide}
          viewer={props.viewer}
        />
      }
      own={
        <MultiplayerSeat
          game={props.game}
          position={board.position}
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

/**
 * The matched game's stage: the seats around the board on the position
 * this device shows, under whatever lies over it. The stage is one element
 * (`GameBoardStage`), so a screen can hold it still.
 */
export function MultiplayerBoard(props: BoardProps): JSX.Element {
  const simulation = useMatchedSimulation(
    () => props.game,
    () => props.room,
    () => props.myId,
    () => props.connected
  );
  const { ownSide, participant, viewer } = useMultiplayerViewer(
    () => props.game,
    () => props.myId
  );
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
  return (
    <BoardStage
      {...props}
      viewer={viewer()}
      ownSide={ownSide()}
      canMove={canMove()}
      simulation={simulation}
    />
  );
}

/**
 * The one line that says where the matched game stands: whose turn, a
 * clock low on time, an offer. It is the screen's live announcement while
 * the game is played.
 */
export function MultiplayerGameStatus(props: {
  readonly game: MultiplayerGame;
  readonly myId: string;
}): JSX.Element {
  const lowOnTime = useLowOnTime(() => props.game);
  const { viewer, winnerName } = useMultiplayerViewer(
    () => props.game,
    () => props.myId
  );
  return (
    <MultiplayerStatus
      game={props.game}
      viewer={viewer()}
      winnerName={winnerName()}
      lowOnTime={lowOnTime()}
    />
  );
}

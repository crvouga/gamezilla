import type { MultiplayerGame } from '@libs/game-matchmaking-shared/game-state';
import type { MultiplayerSide } from '@libs/game-matchmaking-shared/multiplayer-clock';
import { useSoundsPreference } from '@pkgs/sounds-client/solid';
import { useGamePresentation } from '@pkgs/turn-game-client/turn-games-context';
import { GameBoardStage } from '@pkgs/ui-root-client/game-board-stage';
import { StackVertical } from '@pkgs/ui-root-client/stack';
import type { JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { MultiplayerReviewing } from './multiplayer-reviewing';
import type { MultiplayerViewer } from './multiplayer-seat';
import { MultiplayerSeat } from './multiplayer-seat';
import { MultiplayerStatus } from './multiplayer-status';
import { useLowOnTime, useLowOnTimeWarning } from './use-low-on-time';
import type { OwnBoard } from './use-own-board';
import { useShownName } from './use-shown-name';

const otherSide = (side: MultiplayerSide): MultiplayerSide =>
  side === 'white' ? 'black' : 'white';

type BoardProps = {
  readonly game: MultiplayerGame;
  readonly myId: string;
  readonly connected: boolean;
  readonly moving: boolean;
  readonly syncKey: number;
  readonly view: OwnBoard;
  readonly onMove: (uci: string) => Promise<void>;
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
  }
): JSX.Element {
  const sounds = useSoundsPreference();
  const presentation = useGamePresentation();
  // The side nearest the person: their own, until they flip the board.
  const nearSide = (): MultiplayerSide =>
    props.view.flipped() ? otherSide(props.ownSide) : props.ownSide;
  return (
    <GameBoardStage
      top={
        <MultiplayerSeat
          game={props.game}
          side={otherSide(nearSide())}
          own={nearSide() !== props.ownSide}
          near={false}
          viewer={props.viewer}
        />
      }
      bottom={
        <MultiplayerSeat
          game={props.game}
          side={nearSide()}
          own={nearSide() === props.ownSide}
          near
          viewer={props.viewer}
        />
      }
    >
      <Dynamic
        component={presentation(props.game.fen).Board}
        position={props.view.earlier()?.fen ?? props.game.fen}
        orientation={nearSide()}
        interactive={props.canMove && props.view.earlier() === null}
        sound={!sounds.muted()}
        syncKey={props.syncKey}
        testId="multiplayer-board"
        onAction={(action: string) => {
          void props.onMove(action);
        }}
      />
    </GameBoardStage>
  );
}

export function MultiplayerBoard(props: BoardProps): JSX.Element {
  const lowOnTime = useLowOnTime(() => props.game);
  useLowOnTimeWarning({
    game: () => props.game,
    myId: () => props.myId,
    low: lowOnTime,
  });
  const participant = () =>
    props.game.white_id === props.myId || props.game.black_id === props.myId;
  const canMove = () =>
    participant() &&
    props.connected &&
    !props.moving &&
    props.game.outcome === 'ongoing' &&
    props.game.paused_at_ms === null &&
    props.game.turn === props.myId;
  // A watcher sees the board from White's side.
  const white = () => props.game.white_id === props.myId || !participant();
  const opponentName = useShownName(() =>
    white() ? props.game.black_id : props.game.white_id
  );
  const winnerName = useShownName(() =>
    props.game.outcome === 'black' ? props.game.black_id : props.game.white_id
  );
  const viewer = (): MultiplayerViewer => ({
    myId: props.myId,
    participant: participant(),
    opponentName: opponentName(),
    opponentRating:
      (white() ? props.game.black_rating : props.game.white_rating) ?? '',
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
        'shown-position': props.view.earlier()?.fen ?? props.game.fen,
        outcome: props.game.outcome,
        reason: props.game.reason ?? '',
      }}
    >
      <BoardStage
        {...props}
        viewer={viewer()}
        ownSide={white() ? 'white' : 'black'}
        canMove={canMove()}
      />
      <MultiplayerReviewing view={props.view} />
      <MultiplayerStatus
        game={props.game}
        viewer={viewer()}
        winnerName={winnerName()}
        lowOnTime={lowOnTime()}
      />
    </StackVertical>
  );
}

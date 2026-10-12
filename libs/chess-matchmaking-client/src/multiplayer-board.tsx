import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game-state';
import { BOARD_THEME } from '@libs/chess-root-shared/board-theme';
import { useModeration } from '@libs/moderation-client/moderation-context';
import { usernameText } from '@libs/moderation-shared/display';
import { useProfileRow } from '@libs/profile-client/public-use-profile-row';
import { t } from '@lingui/core/macro';
import { ChessBoard } from '@pkgs/chess-board-root-client/chess-board';
import { useSoundsPreference } from '@pkgs/sounds-client/solid';
import { GameBoardStage } from '@pkgs/ui-root-client/game-board-stage';
import type { JSX } from 'solid-js';
import type { MultiplayerViewer } from './multiplayer-seat';
import { MultiplayerSeat } from './multiplayer-seat';
import { MultiplayerStatus } from './multiplayer-status';

/** A person's name as others may see it, by profile id. */
function useShownName(profileId: () => string): () => string {
  const moderation = useModeration();
  const profile = useProfileRow(profileId);
  return () =>
    usernameText(moderation(), profile.row()?.username, profileId()) ||
    t`Deleted account`;
}

export function MultiplayerBoard(props: {
  readonly game: MultiplayerGame;
  readonly myId: string;
  readonly connected: boolean;
  readonly moving: boolean;
  readonly syncKey: number;
  readonly onMove: (uci: string) => Promise<void>;
}): JSX.Element {
  const sounds = useSoundsPreference();
  const participant = () =>
    props.game.white_id === props.myId || props.game.black_id === props.myId;
  const canMove = () =>
    participant() &&
    props.connected &&
    !props.moving &&
    props.game.outcome === 'ongoing' &&
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
    <div
      class="box gap-3"
      data-component="MultiplayerBoard"
      data-testid="multiplayer-game"
      data-game-id={props.game.id}
      data-can-move={String(canMove())}
      data-revision={props.game.revision}
      data-fen={props.game.fen}
      data-outcome={props.game.outcome}
      data-reason={props.game.reason ?? ''}
    >
      <GameBoardStage
        top={
          <MultiplayerSeat
            game={props.game}
            side={white() ? 'black' : 'white'}
            own={false}
            viewer={viewer()}
          />
        }
        bottom={
          <MultiplayerSeat
            game={props.game}
            side={white() ? 'white' : 'black'}
            own
            viewer={viewer()}
          />
        }
      >
        <ChessBoard
          theme={BOARD_THEME}
          fen={props.game.fen}
          fenSyncKey={props.syncKey}
          orientation={white() ? 'white' : 'black'}
          interactive={canMove()}
          premoves={false}
          sound={!sounds.muted()}
          onMove={(move) => {
            void props.onMove(`${move.from}${move.to}${move.promotion ?? ''}`);
          }}
          dataSet={{ testid: 'multiplayer-board' }}
        />
      </GameBoardStage>
      <MultiplayerStatus
        game={props.game}
        viewer={viewer()}
        winnerName={winnerName()}
      />
    </div>
  );
}

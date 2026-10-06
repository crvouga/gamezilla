import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game';
import { useModeration } from '@libs/moderation-client/moderation-context';
import { usernameText } from '@libs/moderation-shared/display';
import { useProfileRow } from '@libs/profile-client/public-use-profile-row';
import { Trans } from '@lingui/solid/macro';
import { ChessBoard } from '@pkgs/chess-board-root-client/chess-board';
import { useSoundsPreference } from '@pkgs/sounds-client/solid';
import { createMemo, type JSX, Show } from 'solid-js';

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
  const white = () => props.game.white_id === props.myId || !participant();
  const opponentId = () =>
    white() ? props.game.black_id : props.game.white_id;
  const opponent = useProfileRow(opponentId);
  const moderation = useModeration();
  const opponentName = () =>
    usernameText(moderation(), opponent.row()?.username, opponentId()) ||
    'Deleted account';
  const description = createMemo(() =>
    !participant() ? (
      <Trans>Watching multiplayer chess.</Trans>
    ) : props.game.outcome === 'ongoing' ? (
      white() ? (
        <Trans>You are White.</Trans>
      ) : (
        <Trans>You are Black.</Trans>
      )
    ) : props.game.outcome === 'draw' ? (
      <Trans>The multiplayer game is drawn.</Trans>
    ) : (props.game.outcome === 'white') === white() ? (
      <Trans>You won the multiplayer game.</Trans>
    ) : (
      <Trans>Your opponent won the multiplayer game.</Trans>
    )
  );
  return (
    <div
      class="box gap-4"
      data-component="MultiplayerBoard"
      data-testid="multiplayer-game"
      data-game-id={props.game.id}
      data-can-move={String(canMove())}
      data-revision={props.game.revision}
      data-fen={props.game.fen}
      data-outcome={props.game.outcome}
      data-reason={props.game.reason ?? ''}
    >
      <p class="text text-text" data-testid="multiplayer-opponent">
        <Trans>Opponent:</Trans> {opponentName()}
      </p>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="multiplayer-announcement"
      >
        {description()}
        <Show when={!participant() && props.game.outcome !== 'ongoing'}>
          <MultiplayerWatcherResult game={props.game} />
        </Show>
        <Show when={props.game.outcome === 'ongoing' && participant()}>
          {props.game.turn === props.myId ? (
            <Trans>Your turn.</Trans>
          ) : (
            <Trans>Your opponent's turn.</Trans>
          )}
          <span data-testid="multiplayer-move-count">
            {props.game.revision} <Trans>moves accepted.</Trans>
          </span>
        </Show>
        <Show when={props.game.reason}>
          <span>{props.game.reason}</span>
        </Show>
      </div>
      <div class="box w-full max-w-lg self-center">
        <ChessBoard
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
      </div>
    </div>
  );
}

function MultiplayerWatcherResult(props: {
  readonly game: MultiplayerGame;
}): JSX.Element {
  const whiteProfile = useProfileRow(() => props.game.white_id);
  const blackProfile = useProfileRow(() => props.game.black_id);
  const moderation = useModeration();
  const winnerName = () => {
    const whiteWon = props.game.outcome === 'white';
    const winner = (whiteWon ? whiteProfile : blackProfile).row();
    const winnerId = whiteWon ? props.game.white_id : props.game.black_id;
    return (
      usernameText(moderation(), winner?.username, winnerId) ||
      'Deleted account'
    );
  };
  return (
    <span data-component="MultiplayerWatcherResult">
      {props.game.outcome === 'draw' ? (
        <Trans>The multiplayer game is drawn.</Trans>
      ) : (
        <Trans>{winnerName()} won the multiplayer game.</Trans>
      )}
    </span>
  );
}

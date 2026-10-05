import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game-state';
import { useProfileRow } from '@libs/profile-client/public-use-profile-row';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { ChessBoard } from '@pkgs/chess-board-root-client/chess-board';
import { useSoundsPreference } from '@pkgs/sounds-client/solid';
import { type JSX, Show } from 'solid-js';
import { MultiplayerAnnouncement } from './multiplayer-announcement';
import { MultiplayerClocks } from './multiplayer-clocks';
import { moveListText } from './multiplayer-format';

function RatingChange(props: { readonly diff: number | null }) {
  return (
    <Show when={props.diff !== null}>
      <span data-testid="multiplayer-rating-change">
        {' '}
        <Trans>
          Your rating changed by {(props.diff ?? 0) > 0 ? '+' : ''}
          {props.diff ?? 0}.
        </Trans>
      </span>
    </Show>
  );
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
  const white = () => props.game.white_id === props.myId;
  const opponent = useProfileRow(() =>
    white() ? props.game.black_id : props.game.white_id
  );
  const opponentName = () => opponent.row()?.username || 'Deleted account';
  const opponentRating = () =>
    (white() ? props.game.black_rating : props.game.white_rating) ?? '';
  return (
    <div
      class="box gap-4"
      data-component="MultiplayerBoard"
      data-testid="multiplayer-game"
      data-game-id={props.game.id}
      data-revision={props.game.revision}
      data-fen={props.game.fen}
      data-outcome={props.game.outcome}
      data-reason={props.game.reason ?? ''}
    >
      <p class="text text-text" data-testid="multiplayer-opponent">
        <Trans>Opponent:</Trans> {opponentName()} ({opponentRating()}) ·{' '}
        <span data-testid="multiplayer-time-control">
          {props.game.time_control ?? ''}
        </span>{' '}
        ·{' '}
        <span data-testid="multiplayer-colour">
          <Show when={white()} fallback={<Trans>You play Black</Trans>}>
            <Trans>You play White</Trans>
          </Show>
        </span>
      </p>
      <MultiplayerClocks game={props.game} />
      <MultiplayerAnnouncement
        game={props.game}
        myId={props.myId}
        opponentName={opponentName()}
        opponentRating={opponentRating()}
      />
      <RatingChange
        diff={
          white() ? props.game.white_rating_diff : props.game.black_rating_diff
        }
      />
      <div class="box w-full max-w-lg self-center">
        <ChessBoard
          fen={props.game.fen}
          fenSyncKey={props.syncKey}
          orientation={white() ? 'white' : 'black'}
          interactive={
            props.connected &&
            !props.moving &&
            props.game.outcome === 'ongoing' &&
            props.game.turn === props.myId
          }
          premoves={false}
          sound={!sounds.muted()}
          onMove={(move) => {
            void props.onMove(`${move.from}${move.to}${move.promotion ?? ''}`);
          }}
          dataSet={{ testid: 'multiplayer-board' }}
        />
      </div>
      <section aria-label={t`Multiplayer move list`}>
        <p class="textMono" data-testid="multiplayer-move-list">
          {moveListText(props.game)}
        </p>
      </section>
    </div>
  );
}

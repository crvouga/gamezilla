import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game-state';
import { useModeration } from '@libs/moderation-client/moderation-context';
import { usernameText } from '@libs/moderation-shared/display';
import { useProfileRow } from '@libs/profile-client/public-use-profile-row';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { ChessBoard } from '@pkgs/chess-board-root-client/chess-board';
import { useSoundsPreference } from '@pkgs/sounds-client/solid';
import { GameBoardStage } from '@pkgs/ui-root-client/game-board-stage';
import { GameSection } from '@pkgs/ui-root-client/game-section';
import { type JSX, Show } from 'solid-js';
import { MultiplayerAnnouncement } from './multiplayer-announcement';
import { MultiplayerClocks } from './multiplayer-clocks';
import { moveListText } from './multiplayer-format';
import { MultiplayerLineup } from './multiplayer-lineup';

function WatcherAnnouncement(props: {
  readonly game: MultiplayerGame;
}): JSX.Element {
  const moderation = useModeration();
  const whiteProfile = useProfileRow(() => props.game.white_id);
  const blackProfile = useProfileRow(() => props.game.black_id);
  const winnerName = () => {
    const whiteWon = props.game.outcome === 'white';
    const profile = whiteWon ? whiteProfile : blackProfile;
    const id = whiteWon ? props.game.white_id : props.game.black_id;
    return (
      usernameText(moderation(), profile.row()?.username, id) ||
      'Deleted account'
    );
  };
  return (
    <p class="text text-text" data-testid="multiplayer-announcement">
      <Trans>Watching multiplayer chess.</Trans>
      <Show
        when={props.game.outcome === 'white' || props.game.outcome === 'black'}
      >
        {' '}
        <Trans>{winnerName()} won the multiplayer game.</Trans>
      </Show>
      <Show when={props.game.outcome === 'draw'}>
        {' '}
        <Trans>The multiplayer game is drawn.</Trans>
      </Show>
    </p>
  );
}

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
  const moderation = useModeration();
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
  const opponentName = () =>
    usernameText(moderation(), opponent.row()?.username, opponentId()) ||
    'Deleted account';
  const opponentRating = () =>
    (white() ? props.game.black_rating : props.game.white_rating) ?? '';
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
      <MultiplayerLineup
        game={props.game}
        myId={props.myId}
        opponentName={opponentName()}
        opponentRating={opponentRating()}
        white={white()}
        participant={participant()}
      />
      <MultiplayerClocks game={props.game} />
      <Show
        when={participant()}
        fallback={<WatcherAnnouncement game={props.game} />}
      >
        <MultiplayerAnnouncement
          game={props.game}
          myId={props.myId}
          opponentName={opponentName()}
          opponentRating={opponentRating()}
        />
      </Show>
      <Show when={participant()}>
        <RatingChange
          diff={
            white()
              ? props.game.white_rating_diff
              : props.game.black_rating_diff
          }
        />
      </Show>
      <GameBoardStage>
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
      </GameBoardStage>
      <GameSection title={t`Multiplayer move list`}>
        <p
          class="textMono break-words text-sm text-text-secondary"
          data-testid="multiplayer-move-list"
        >
          {moveListText(props.game)}
        </p>
      </GameSection>
    </div>
  );
}

import type { MultiplayerGame } from '@libs/game-matchmaking-shared/game-state';
import type { MultiplayerSide } from '@libs/game-matchmaking-shared/multiplayer-clock';
import { AccountAutomationLabel } from '@libs/profile-client/account-automation-label';
import { UserProfileAvatar } from '@libs/profile-client/user-profile-avatar';
import { UserUsername } from '@libs/profile-client/user-username';
import { Trans } from '@lingui/solid/macro';
import { useGameSideLabel } from '@pkgs/turn-game-client/use-game-side-label';
import { Badge } from '@pkgs/ui-root-client/badge';
import {
  GAME_PLAYER_AVATAR_SIZE,
  GamePlayerBar,
} from '@pkgs/ui-root-client/game-player-bar';
import { type JSX, Show } from 'solid-js';
import { MultiplayerClock } from './multiplayer-clocks';

/** Who this device is in the game, and the opponent as they may be shown. */
export type MultiplayerViewer = {
  readonly myId: string;
  readonly participant: boolean;
  readonly opponentName: string;
  readonly opponentRating: string;
};

function SideName(props: {
  readonly side: MultiplayerSide;
  readonly position: string;
}): JSX.Element {
  const gameSideLabel = useGameSideLabel();
  return <>{gameSideLabel(props.position, props.side)}</>;
}

function SeatName(props: {
  readonly profileId: string;
  readonly own: boolean;
  readonly viewer: MultiplayerViewer;
}): JSX.Element {
  return (
    <Show
      when={!props.own}
      fallback={<UserUsername profileId={props.profileId} withAt={false} />}
    >
      <span data-testid="multiplayer-opponent">
        {props.viewer.opponentName} ({props.viewer.opponentRating})
      </span>
    </Show>
  );
}

/** The person's own seat says which colour they play; any other names its side. */
function SeatTags(props: {
  readonly position: string;
  readonly profileId: string;
  readonly side: MultiplayerSide;
  readonly own: boolean;
  readonly viewer: MultiplayerViewer;
}): JSX.Element {
  const gameSideLabel = useGameSideLabel();
  return (
    <>
      <Show
        when={props.own && props.viewer.participant}
        fallback={
          <Badge
            intent="neutral"
            label={<SideName side={props.side} position={props.position} />}
          />
        }
      >
        <Badge
          intent="neutral"
          label={
            <span data-testid="multiplayer-colour">
              <Trans>
                You play {gameSideLabel(props.position, props.side)}
              </Trans>
            </span>
          }
        />
      </Show>
      <Show when={!props.own}>
        <AccountAutomationLabel profileId={props.profileId} />
      </Show>
    </>
  );
}

/**
 * One side's seat beside the board: who plays it, which colour, and its
 * clock. `own` is the person's own seat, or White's for a watcher; `near` is
 * the seat below the board, nearest the person holding the device. They are
 * the same seat until the person flips the board.
 */
export function MultiplayerSeat(props: {
  readonly game: MultiplayerGame;
  readonly side: MultiplayerSide;
  readonly own: boolean;
  readonly near: boolean;
  readonly viewer: MultiplayerViewer;
}): JSX.Element {
  const profileId = () =>
    props.side === 'white' ? props.game.white_id : props.game.black_id;
  return (
    <GamePlayerBar
      active={
        props.game.outcome === 'ongoing' && props.game.turn === profileId()
      }
      avatar={
        <UserProfileAvatar
          profileId={profileId()}
          size={GAME_PLAYER_AVATAR_SIZE}
        />
      }
      name={
        <SeatName
          profileId={profileId()}
          own={props.own}
          viewer={props.viewer}
        />
      }
      tags={
        <SeatTags
          position={props.game.fen}
          profileId={profileId()}
          side={props.side}
          own={props.own}
          viewer={props.viewer}
        />
      }
      trailing={<MultiplayerClock game={props.game} side={props.side} />}
      dataSet={{
        testid: props.near ? 'multiplayer-seat-near' : 'multiplayer-seat-far',
      }}
    />
  );
}

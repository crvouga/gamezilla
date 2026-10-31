import type {
  MultiplayerGame,
  MultiplayerSide,
} from '@libs/game-matchmaking-shared-ts/game-state';
import { multiplayerOwner } from '@libs/game-matchmaking-shared-ts/multiplayer-roster';
import { frameSwatch } from '@libs/game-session-client-ts/game-frame-look';
import { AccountAutomationLabel } from '@libs/profile-client-ts/account-automation-label';
import { UserProfileAvatar } from '@libs/profile-client-ts/user-profile-avatar';
import { UserUsername } from '@libs/profile-client-ts/user-username';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { useGamePresentation } from '@pkgs/turn-game-client-ts/turn-games-context';
import { useGameSideLabel } from '@pkgs/turn-game-client-ts/use-game-side-label';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import {
  GAME_PLAYER_AVATAR_SIZE,
  GamePlayerBar,
} from '@pkgs/ui-root-client-ts/game-player-bar';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { For, type JSX, Show } from 'solid-js';
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
  readonly multiple?: boolean;
}): JSX.Element {
  return (
    <Show
      when={!props.own && !props.multiple}
      fallback={<UserUsername profileId={props.profileId} withAt={false} />}
    >
      <Text variant="inherit" testId="multiplayer-opponent">
        {props.viewer.opponentName} ({props.viewer.opponentRating})
      </Text>
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
            <Text variant="inherit" testId="multiplayer-colour">
              <Trans>
                You play {gameSideLabel(props.position, props.side)}
              </Trans>
            </Text>
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
 * One side's seat beside the board: identity, game-specific figures and
 * public facts in the displayed position, and the live clock. `own` is the person's own seat, or White's for a watcher; `near` is
 * the seat below the board, nearest the person holding the device. They are
 * the same seat until the person flips the board.
 */
export function MultiplayerSeat(props: {
  readonly game: MultiplayerGame;
  /** The position shown by the board, including review and simulation. */
  readonly position: string;
  readonly side: MultiplayerSide;
  readonly own: boolean;
  readonly near: boolean;
  readonly viewer: MultiplayerViewer;
}): JSX.Element {
  const presentation = useGamePresentation();
  const frame = () => presentation(props.game.fen).frame;
  const profileId = () => multiplayerOwner(props.game, props.side);
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
          multiple={Boolean(props.game.red_id)}
          viewer={props.viewer}
        />
      }
      swatch={frameSwatch(frame().seats.look(props.side))}
      stat={frame().seats.stat(props.position, props.side)}
      state={
        frame().seats.out(props.position, props.side)
          ? { kind: 'out', label: t`Out` }
          : null
      }
      tags={
        <>
          <SeatTags
            position={props.position}
            profileId={profileId()}
            side={props.side}
            own={props.own}
            viewer={props.viewer}
          />
          <For each={frame().seats.facts(props.position, props.side, [])}>
            {(fact) => <Badge intent="neutral" label={fact} />}
          </For>
        </>
      }
      trailing={
        <Show
          when={props.game.white_ms !== null && props.game.black_ms !== null}
        >
          <MultiplayerClock game={props.game} side={props.side} />
        </Show>
      }
      dataSet={{
        testid: props.game.red_id
          ? `multiplayer-seat-${props.side}`
          : props.near
            ? 'multiplayer-seat-near'
            : 'multiplayer-seat-far',
        side: props.side,
        'profile-id': profileId(),
      }}
    />
  );
}

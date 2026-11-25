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
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { useGamePresentation } from '@pkgs/turn-game-client-ts/turn-games-context';
import { useGameSideLabel } from '@pkgs/turn-game-client-ts/use-game-side-label';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import {
  GAME_PLAYER_AVATAR_SIZE,
  GamePlayerBar,
} from '@pkgs/ui-root-client-ts/game-player-bar';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import type { JSX } from '@solidjs/web';
import { For, Show } from 'solid-js';
import { MultiplayerClock } from './multiplayer-clocks';

/** Who this device is in the game, and the opponent as they may be shown. */
export type MultiplayerViewer = {
  readonly myId: string;
  readonly participant: boolean;
  readonly opponentName: string;
  readonly opponentRating: string;
};

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

/**
 * `You` on the person's own seat, after their name, the one mark every
 * game's own seat wears: filled, and never giving way to the seat's facts.
 * Their side is the swatch before the name; a listener (and a reader) hears
 * it in words, `You play Red`.
 */
function OwnMark(props: {
  readonly position: string;
  readonly side: MultiplayerSide;
}): JSX.Element {
  const gameSideLabel = useGameSideLabel();
  return (
    <Badge
      intent="info"
      size="sm"
      tone="solid"
      label={
        <Text variant="inherit" testId="multiplayer-colour">
          <Trans>You</Trans>
          <VisuallyHidden>
            {' '}
            <Trans>play {gameSideLabel(props.position, props.side)}</Trans>
          </VisuallyHidden>
        </Text>
      }
    />
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
  /** No connection: the person's own turn waits for it, and says so. */
  readonly connected?: boolean | undefined;
}): JSX.Element {
  const presentation = useGamePresentation();
  const frame = () => presentation(props.game.fen).frame;
  const gameSideLabel = useGameSideLabel();
  const profileId = () => multiplayerOwner(props.game, props.side);
  return (
    <GamePlayerBar
      // Offline, the person's own turn waits: no call to act, and an
      // amber tag says why, matching the status line. A draw offered to
      // the person keeps their seat to move: playing on declines it.
      active={
        props.game.outcome === 'ongoing' &&
        props.game.turn === profileId() &&
        !(props.connected === false && profileId() === props.viewer.myId)
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
      nameTag={
        <Show when={props.own && props.viewer.participant}>
          <OwnMark position={props.position} side={props.side} />
        </Show>
      }
      swatch={frameSwatch(frame().seats.look(props.side))}
      swatchLabel={gameSideLabel(props.position, props.side)}
      tagsPlacement="line"
      stat={frame().seats.stat(props.position, props.side)}
      state={
        frame().seats.out(props.position, props.side)
          ? { kind: 'out', label: t`Out` }
          : null
      }
      tags={
        <>
          <Show when={!props.own}>
            <AccountAutomationLabel profileId={profileId()} />
          </Show>
          <Show
            when={
              props.connected === false && profileId() === props.viewer.myId
            }
          >
            <Badge intent="warning" label={<Trans>Offline</Trans>} />
          </Show>
          <For each={frame().seats.facts(props.position, props.side, [])}>
            {(fact) => <Badge intent="neutral" label={fact} />}
          </For>
        </>
      }
      // The person's own turn is the status line's "Your turn." above the
      // board; their seat marks it by its tint and edge alone, so the two
      // never say it twice. Anyone else's seat says they are to move.
      turnLabel={
        <Show when={profileId() !== props.viewer.myId}>
          <Trans>To move</Trans>
        </Show>
      }
      trailing={
        <Show
          when={props.game.white_ms !== null && props.game.black_ms !== null}
        >
          <MultiplayerClock
            game={props.game}
            side={props.side}
            muted={props.connected === false}
          />
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

import type { CustomGameSide } from '@libs/game-session-shared-ts/custom-game-state';
import { UserProfileAvatar } from '@libs/profile-client-ts/user-profile-avatar';
import { Trans } from '@lingui/solid/macro';
import { useGamePresentation } from '@pkgs/turn-game-client-ts/turn-games-context';
import { useGameSideLabel } from '@pkgs/turn-game-client-ts/use-game-side-label';
import { Avatar } from '@pkgs/ui-root-client-ts/avatar';
import { Badge, HostBadge } from '@pkgs/ui-root-client-ts/badge';
import { Divider } from '@pkgs/ui-root-client-ts/divider';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameDisclosure } from '@pkgs/ui-root-client-ts/game-disclosure';
import {
  GAME_PLAYER_AVATAR_SIZE,
  GamePlayerBar,
} from '@pkgs/ui-root-client-ts/game-player-bar';
import { GameActions, GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { For, type JSX, Match, Show, Switch } from 'solid-js';
import { CustomGamePerson, useBotLevel } from './custom-game-person';
import {
  CustomGameInvitation,
  CustomGameSideChoices,
} from './custom-game-side-choices';
import { CustomGameClock } from './custom-game-status';
import { frameSwatch } from './game-frame-look';
import { frameViewerNotice } from './game-frame-setup-copy';
import { useFrameViewer } from './game-frame-viewer';
import type { CustomGameScreenModel } from './use-custom-game-screen';

type SideProps = { model: CustomGameScreenModel; side: CustomGameSide };

/**
 * A person's picture, the bot, a guest playing on this device, an open
 * seat, or the person placeholder of a place nobody may take.
 */
function SeatAvatar(props: SideProps): JSX.Element {
  const participant = () => props.model.current()![props.side];
  return (
    <Switch fallback={<Avatar size={GAME_PLAYER_AVATAR_SIZE} />}>
      <Match
        when={
          participant().kind === 'person' || participant().kind === 'invitation'
        }
      >
        <UserProfileAvatar
          profileId={participant().person}
          size={GAME_PLAYER_AVATAR_SIZE}
        />
      </Match>
      <Match when={participant().kind === 'bot'}>
        <Avatar size={GAME_PLAYER_AVATAR_SIZE} kind="bot" />
      </Match>
      <Match when={participant().kind === 'local'}>
        <Avatar size={GAME_PLAYER_AVATAR_SIZE} kind="guest" />
      </Match>
      <Match when={participant().kind === 'open'}>
        <Avatar size={GAME_PLAYER_AVATAR_SIZE} kind="emptySeat" />
      </Match>
    </Switch>
  );
}

/**
 * The seat's colour, the host's tag on the host's own seat, the viewer's
 * own seat at someone else's table, and whether its holder is ready.
 */
function SeatTags(props: SideProps): JSX.Element {
  const gameSideLabel = useGameSideLabel();
  const game = () => props.model.current()!;
  const ready = () =>
    props.model.current()?.ready.includes(props.side) === true;
  const holder = () => game()[props.side];
  const hosts = () =>
    holder().kind === 'person' && holder().person === game().creator;
  const visiting = () =>
    props.model.mySide() === props.side && !props.model.canConfigure();
  return (
    <>
      <Badge
        intent="neutral"
        label={gameSideLabel(props.model.current()?.fen ?? '', props.side)}
      />
      <Show when={hosts()}>
        <HostBadge
          size="sm"
          dataSet={{ testid: `custom-game-${props.side}-host` }}
        />
      </Show>
      <Show when={visiting()}>
        <Badge
          intent="info"
          label={<Trans>You · guest</Trans>}
          dataSet={{ testid: `custom-game-${props.side}-you` }}
        />
      </Show>
      <Show
        when={ready()}
        fallback={
          <Badge intent="neutral" label={<Trans>Getting ready</Trans>} />
        }
      >
        <Badge intent="success" label={<Trans>Ready</Trans>} />
      </Show>
    </>
  );
}

/**
 * One seat while the game is set up: who holds it, its look, its clock and
 * the choices for it. Once the game is played the frame's seats
 * (`game-frame-seats.tsx`) show it.
 */
function CustomGameSeat(props: SideProps): JSX.Element {
  const level = useBotLevel(props);
  const presentation = useGamePresentation();
  const look = () =>
    frameSwatch(
      presentation(props.model.current()!.fen).frame.seats.look(props.side)
    );
  return (
    <GamePlayerBar
      dataSet={{ testid: `custom-game-${props.side}` }}
      swatch={look()}
      name={
        <Text variant="inherit" testId={`custom-game-${props.side}-person`}>
          <CustomGamePerson
            participant={props.model.current()![props.side]}
            level={level()}
          />
        </Text>
      }
      avatar={<SeatAvatar {...props} />}
      tags={<SeatTags {...props} />}
      trailing={
        props.model.current()!.minutes > 0 ? (
          <CustomGameClock game={props.model.current()!} side={props.side} />
        ) : undefined
      }
    >
      <CustomGameSideActions {...props} />
    </GamePlayerBar>
  );
}

/**
 * A person who may take a seat sits in the first open one; someone who may
 * not, or finds every seat taken, is told they watch.
 */
function SeatsNotice(props: { model: CustomGameScreenModel }): JSX.Element {
  const viewer = useFrameViewer(props.model);
  const notice = () =>
    frameViewerNotice(viewer.role(), viewer.openSides().length);
  return (
    <>
      <Show when={notice()}>
        {(text) => (
          <P tone="secondary" testId="custom-game-viewer">
            {text()}
          </P>
        )}
      </Show>
      <Show when={viewer.role() === 'member' ? viewer.openSides()[0] : null}>
        {(side) => (
          <GameActions>
            <GameActionButton
              title={<Trans>Take a seat</Trans>}
              dataSet={{ testid: 'custom-game-take-seat' }}
              operation={() =>
                props.model.choose({ operation: 'claim', side: side() })
              }
            />
          </GameActions>
        )}
      </Show>
    </>
  );
}

/** Every seat while the game is set up, each with its own choices. */
export function CustomGameSeats(props: {
  model: CustomGameScreenModel;
}): JSX.Element {
  return (
    <GameSection title={<Trans>Players</Trans>}>
      <SeatsNotice model={props.model} />
      <For each={props.model.current()?.sides ?? []}>
        {(side, index) => (
          <>
            <Show when={index() > 0}>
              <Divider />
            </Show>
            <CustomGameSeat model={props.model} side={side} />
          </>
        )}
      </For>
    </GameSection>
  );
}

function CustomGameSideActions(props: SideProps): JSX.Element {
  const participant = () => props.model.current()![props.side];
  return (
    <>
      <Show when={participant().kind === 'invitation'}>
        <CustomGameInvitation {...props} />
      </Show>
      <Show when={participant().kind === 'open' && props.model.canJoin()}>
        <GameActionButton
          title={<Trans>Sit here</Trans>}
          variant="solid"
          dataSet={{ testid: `custom-game-${props.side}-claim` }}
          operation={() =>
            props.model.choose({ operation: 'claim', side: props.side })
          }
        />
      </Show>
      <Show
        when={
          participant().kind === 'person' &&
          participant().person === props.model.myId() &&
          props.model.canJoin()
        }
      >
        <GameActionButton
          title={<Trans>Leave seat</Trans>}
          dataSet={{ testid: `custom-game-${props.side}-release` }}
          operation={() =>
            props.model.choose({ operation: 'release', side: props.side })
          }
        />
      </Show>
      <Show when={props.model.canConfigure()}>
        <GameDisclosure
          title={<Trans>Change who sits here</Trans>}
          dataSet={{ testid: `custom-game-${props.side}-choices` }}
        >
          <CustomGameSideChoices {...props} />
        </GameDisclosure>
      </Show>
    </>
  );
}

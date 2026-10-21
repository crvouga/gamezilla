import type { CustomGameSide } from '@libs/game-session-shared/custom-game-state';
import { UserProfileAvatar } from '@libs/profile-client/user-profile-avatar';
import { Trans } from '@lingui/solid/macro';
import { useGameSideLabel } from '@pkgs/turn-game-client/use-game-side-label';
import { Avatar } from '@pkgs/ui-root-client/avatar';
import { Badge } from '@pkgs/ui-root-client/badge';
import { Divider } from '@pkgs/ui-root-client/divider';
import { GameActionButton } from '@pkgs/ui-root-client/game-action-button';
import { GameDisclosure } from '@pkgs/ui-root-client/game-disclosure';
import {
  GAME_PLAYER_AVATAR_SIZE,
  GamePlayerBar,
} from '@pkgs/ui-root-client/game-player-bar';
import { GameSection } from '@pkgs/ui-root-client/game-section';
import { BotIcon } from '@pkgs/ui-root-client/icons';
import { Text } from '@pkgs/ui-root-client/text';
import { type JSX, Match, Show, Switch } from 'solid-js';
import { CustomGamePerson } from './custom-game-person';
import {
  CustomGameInvitation,
  CustomGameSideChoices,
} from './custom-game-side-choices';
import { CustomGameClock } from './custom-game-status';
import type { CustomGameScreenModel } from './use-custom-game-screen';

type SideProps = { model: CustomGameScreenModel; side: CustomGameSide };

/** A person's picture, the bot's plate, or the placeholder of an empty seat. */
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
        <Avatar
          size={GAME_PLAYER_AVATAR_SIZE}
          icon={BotIcon}
          background="surfaceMuted"
          foreground="icon"
        />
      </Match>
    </Switch>
  );
}

/** The seat's colour, then whether its holder is ready while a game is set up. */
function SeatTags(props: SideProps): JSX.Element {
  const gameSideLabel = useGameSideLabel();
  const ready = () =>
    props.model.current()?.ready.includes(props.side) === true;
  return (
    <>
      <Badge
        intent="neutral"
        label={gameSideLabel(props.model.current()?.fen ?? '', props.side)}
      />
      <Show when={props.model.current()?.status === 'configuring'}>
        <Show
          when={ready()}
          fallback={
            <Badge intent="neutral" label={<Trans>Getting ready</Trans>} />
          }
        >
          <Badge intent="success" label={<Trans>Ready</Trans>} />
        </Show>
      </Show>
    </>
  );
}

/**
 * One side of the game: who holds it, its colour and its clock. While the
 * game is set up it also carries the choices for that side.
 */
export function CustomGameSeat(props: SideProps): JSX.Element {
  return (
    <GamePlayerBar
      dataSet={{ testid: `custom-game-${props.side}` }}
      name={
        <Text variant="inherit" testId={`custom-game-${props.side}-person`}>
          <CustomGamePerson participant={props.model.current()![props.side]} />
        </Text>
      }
      avatar={<SeatAvatar {...props} />}
      tags={<SeatTags {...props} />}
      trailing={
        props.model.current()!.minutes > 0 ? (
          <CustomGameClock game={props.model.current()!} side={props.side} />
        ) : undefined
      }
      active={
        props.model.current()?.status === 'active' &&
        props.model.current()?.turn === props.side
      }
    >
      {props.model.current()?.status === 'configuring' ? (
        <CustomGameSideActions {...props} />
      ) : undefined}
    </GamePlayerBar>
  );
}

/** Both seats while the game is set up, each with its own choices. */
export function CustomGameSeats(props: {
  model: CustomGameScreenModel;
}): JSX.Element {
  return (
    <GameSection title={<Trans>Players</Trans>}>
      <CustomGameSeat model={props.model} side="white" />
      <Divider />
      <CustomGameSeat model={props.model} side="black" />
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
          title={<Trans>Claim this side</Trans>}
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
          title={<Trans>Release this side</Trans>}
          dataSet={{ testid: `custom-game-${props.side}-release` }}
          operation={() =>
            props.model.choose({ operation: 'release', side: props.side })
          }
        />
      </Show>
      <Show when={props.model.canConfigure()}>
        <GameDisclosure
          title={<Trans>Change participant</Trans>}
          dataSet={{ testid: `custom-game-${props.side}-choices` }}
        >
          <CustomGameSideChoices {...props} />
        </GameDisclosure>
      </Show>
    </>
  );
}

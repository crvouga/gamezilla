import type { CustomGameSide } from '@libs/game-session-shared-ts/custom-game-state';
import { UserProfileAvatar } from '@libs/profile-client-ts/user-profile-avatar';
import { Trans } from '@lingui/solid/macro';
import { useGameSideLabel } from '@pkgs/turn-game-client-ts/use-game-side-label';
import { Avatar } from '@pkgs/ui-root-client-ts/avatar';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { Divider } from '@pkgs/ui-root-client-ts/divider';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameDisclosure } from '@pkgs/ui-root-client-ts/game-disclosure';
import {
  GAME_PLAYER_AVATAR_SIZE,
  GamePlayerBar,
} from '@pkgs/ui-root-client-ts/game-player-bar';
import { GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { For, type JSX, Match, Show, Switch } from 'solid-js';
import { CustomGamePerson, useBotLevel } from './custom-game-person';
import {
  CustomGameInvitation,
  CustomGameSideChoices,
} from './custom-game-side-choices';
import { CustomGameClock } from './custom-game-status';
import type { CustomGameScreenModel } from './use-custom-game-screen';

type SideProps = { model: CustomGameScreenModel; side: CustomGameSide };

/**
 * A person's picture, the bot, an open seat, or the person placeholder of a
 * place someone on this device plays or nobody may take.
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
      <Match when={participant().kind === 'open'}>
        <Avatar size={GAME_PLAYER_AVATAR_SIZE} kind="emptySeat" />
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
      <Show when={props.model.current()?.status === 'active'}>
        <SeatPlayTags {...props} />
      </Show>
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
 * While the game is played: a side a stand-in bot plays says so, and while
 * every side chooses in secret, whether this side has chosen (never what).
 */
function SeatPlayTags(props: SideProps): JSX.Element {
  const game = () => props.model.current()!;
  return (
    <>
      <Show when={game().standIns.includes(props.side)}>
        <Badge
          intent="warning"
          label={<Trans>Stand-in bot</Trans>}
          dataSet={{ testid: `custom-game-${props.side}-stand-in` }}
        />
      </Show>
      <Show when={game().committed.includes(props.side)}>
        <Badge
          intent="success"
          label={<Trans>Chosen</Trans>}
          dataSet={{ testid: `custom-game-${props.side}-committed` }}
        />
      </Show>
      <Show when={game().awaiting.includes(props.side)}>
        <Badge intent="neutral" label={<Trans>Choosing</Trans>} />
      </Show>
    </>
  );
}

/** The person whose side a stand-in plays takes it back. */
function TakeBackSide(props: SideProps): JSX.Element {
  const game = () => props.model.current()!;
  return (
    <Show
      when={
        game().status === 'active' &&
        game().standIns.includes(props.side) &&
        game()[props.side].person === props.model.myId() &&
        props.model.canPlay()
      }
    >
      <GameActionButton
        title={<Trans>Take back my side</Trans>}
        variant="solid"
        dataSet={{ testid: 'custom-game-reclaim' }}
        operation={() => props.model.choose({ operation: 'reclaim' })}
      />
    </Show>
  );
}

/** Whether `side` decides now: its turn, or its secret choice still open. */
function seatDeciding(model: CustomGameScreenModel, side: CustomGameSide) {
  const game = model.current();
  if (game?.status !== 'active') return false;
  return game.awaiting.length > 0
    ? game.awaiting.includes(side)
    : game.turn === side;
}

/**
 * One side of the game: who holds it, its colour and its clock. While the
 * game is set up it also carries the choices for that side.
 */
export function CustomGameSeat(props: SideProps): JSX.Element {
  const level = useBotLevel(props);
  return (
    <GamePlayerBar
      dataSet={{ testid: `custom-game-${props.side}` }}
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
      active={seatDeciding(props.model, props.side)}
    >
      {props.model.current()?.status === 'configuring' ? (
        <CustomGameSideActions {...props} />
      ) : (
        <TakeBackSide {...props} />
      )}
    </GamePlayerBar>
  );
}

/** Both seats while the game is set up, each with its own choices. */
export function CustomGameSeats(props: {
  model: CustomGameScreenModel;
}): JSX.Element {
  return (
    <GameSection title={<Trans>Players</Trans>}>
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

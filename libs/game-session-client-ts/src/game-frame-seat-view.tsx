import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import { Trans } from '@lingui/solid/macro';
import type { BotDifficulty } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  BotIcon,
  DoorOpenIcon,
  LockIcon,
  LogOutIcon,
  SmartphoneIcon,
  UserIcon,
  UserPlusIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { For, type JSX, Match, Show, Switch } from 'solid-js';
import {
  createFrameChoices,
  FrameChoiceRow,
  type FrameChoices,
} from './game-frame-choice';
import {
  FrameHolderName,
  FramePersonAvatar,
  FramePersonName,
} from './game-frame-people';
import type { FramePlaceProps } from './game-frame-screen-view';
import { FramePlacePage } from './game-frame-shell';
import type { FrameSeatChoices, FrameSetupSeat } from './game-frame-view-types';

type Props = FramePlaceProps;

type SeatProps = Props & {
  readonly seat: FrameSetupSeat;
  readonly choices: FrameChoices;
};

const INVITEE_AVATAR_SIZE = 32;

/** The choices that name only the seat. */
type SeatOperation = Exclude<
  Extract<CustomGameInput, { side: unknown }>['operation'],
  'invite' | 'difficulty'
>;

/** One choice about the seat, as the room takes it. */
function seatChoice(
  props: SeatProps,
  operation: SeatOperation
): () => Promise<void> {
  return () => props.onChoose({ operation, side: props.seat.side });
}

/** The viewer's own part in the seat: sitting, leaving, an invitation. */
function OwnSeatRows(props: SeatProps): JSX.Element {
  const side = () => props.seat.side;
  const invitation = () => props.seat.invitation;
  return (
    <Show
      when={
        props.seat.canSit ||
        props.seat.canLeave ||
        invitation()?.canAnswer === true ||
        invitation()?.canRevoke === true
      }
    >
      <MenuSection>
        <Show when={props.seat.canSit}>
          <FrameChoiceRow
            choices={props.choices}
            id={`custom-game-${side()}-claim`}
            leading={<UserIcon size={24} />}
            title={<Trans>Sit here</Trans>}
            operation={seatChoice(props, 'claim')}
          />
        </Show>
        <Show when={invitation()?.canAnswer}>
          <FrameChoiceRow
            choices={props.choices}
            id={`custom-game-${side()}-accept`}
            title={<Trans>Accept the invitation</Trans>}
            operation={seatChoice(props, 'accept')}
          />
          <FrameChoiceRow
            choices={props.choices}
            id={`custom-game-${side()}-decline`}
            title={<Trans>Decline the invitation</Trans>}
            operation={seatChoice(props, 'decline')}
          />
        </Show>
        <Show when={invitation()?.canRevoke}>
          <FrameChoiceRow
            choices={props.choices}
            id={`custom-game-${side()}-revoke`}
            title={<Trans>Revoke the invitation</Trans>}
            tone="destructive"
            operation={seatChoice(props, 'revoke')}
          />
        </Show>
        <Show when={props.seat.canLeave}>
          <FrameChoiceRow
            choices={props.choices}
            id={`custom-game-${side()}-release`}
            leading={<LogOutIcon size={24} />}
            title={<Trans>Leave seat</Trans>}
            operation={seatChoice(props, 'release')}
          />
        </Show>
      </MenuSection>
    </Show>
  );
}

/** Everything the host may put in the seat; the holder it has is marked. */
function HolderRows(
  props: SeatProps & { readonly offered: FrameSeatChoices }
): JSX.Element {
  const side = () => props.seat.side;
  const kind = () => props.seat.holder.kind;
  return (
    <MenuSection title={<Trans>Who sits here</Trans>}>
      <FrameChoiceRow
        choices={props.choices}
        id={`custom-game-${side()}-take`}
        leading={<UserIcon size={24} />}
        title={<Trans>Me</Trans>}
        selected={props.seat.own && kind() === 'person'}
        operation={seatChoice(props, 'take')}
      />
      <Show when={props.offered.invitees}>
        <MenuRow
          leading={<UserPlusIcon size={24} />}
          title={<Trans>Someone in this space</Trans>}
          caption={<Trans>They get an invitation</Trans>}
          selected={kind() === 'invitation'}
          onClick={() => props.onOpen({ screen: 'invite', side: side() })}
          dataSet={{ testid: `custom-game-${side()}-invite-choose` }}
        />
      </Show>
      <Show when={props.offered.bots}>
        <FrameChoiceRow
          choices={props.choices}
          id={`custom-game-${side()}-bot`}
          leading={<BotIcon size={24} />}
          title={<Trans>A bot</Trans>}
          selected={kind() === 'bot'}
          operation={seatChoice(props, 'bot')}
        />
      </Show>
      <Show when={props.offered.localPlayers}>
        <FrameChoiceRow
          choices={props.choices}
          id={`custom-game-${side()}-local`}
          leading={<SmartphoneIcon size={24} />}
          title={<Trans>A player on this device</Trans>}
          selected={kind() === 'local'}
          operation={seatChoice(props, 'local')}
        />
      </Show>
      <FrameChoiceRow
        choices={props.choices}
        id={`custom-game-${side()}-open`}
        leading={<DoorOpenIcon size={24} />}
        title={<Trans>Open seat</Trans>}
        caption={<Trans>Anyone in this space may sit</Trans>}
        selected={kind() === 'open'}
        operation={seatChoice(props, 'open')}
      />
      <FrameChoiceRow
        choices={props.choices}
        id={`custom-game-${side()}-close`}
        leading={<LockIcon size={24} />}
        title={<Trans>Closed seat</Trans>}
        caption={<Trans>Nobody may sit until you choose</Trans>}
        selected={kind() === 'closed'}
        operation={seatChoice(props, 'close')}
      />
    </MenuSection>
  );
}

function difficultyName(difficulty: BotDifficulty): JSX.Element {
  return (
    <Switch fallback={<Trans>Hard</Trans>}>
      <Match when={difficulty === 'easy'}>
        <Trans>Easy</Trans>
      </Match>
      <Match when={difficulty === 'medium'}>
        <Trans>Medium</Trans>
      </Match>
    </Switch>
  );
}

/** The levels the bot in this seat can play at. */
function DifficultyRows(
  props: SeatProps & { readonly offered: FrameSeatChoices }
): JSX.Element {
  return (
    <Show when={props.offered.difficulties.length > 0}>
      <MenuSection title={<Trans>Bot difficulty</Trans>}>
        <For each={props.offered.difficulties}>
          {(difficulty) => (
            <FrameChoiceRow
              choices={props.choices}
              id={`custom-${props.seat.side}-difficulty-${difficulty}`}
              title={difficultyName(difficulty)}
              selected={props.offered.difficulty === difficulty}
              operation={() =>
                props.onChoose({
                  operation: 'difficulty',
                  side: props.seat.side,
                  difficulty,
                })
              }
            />
          )}
        </For>
      </MenuSection>
    </Show>
  );
}

/**
 * One seat while the game is set up: who sits in it. Each choice is a row;
 * pressing one sends it and returns to the lobby, where the seat shows it.
 */
export function FrameSeatPlace(
  props: Props & { readonly seat: FrameSetupSeat }
): JSX.Element {
  const choices = createFrameChoices(() => props.onClose());
  return (
    <FramePlacePage
      {...props}
      screenId="custom-game-seat"
      title={props.seat.sideLabel}
      subtitle={
        <FrameHolderName
          holder={props.seat.holder}
          plainName={props.seat.plainName}
          people={props.people}
        />
      }
    >
      <OwnSeatRows {...props} choices={choices} />
      <Show when={props.seat.choices}>
        {(offered) => (
          <>
            <HolderRows {...props} choices={choices} offered={offered()} />
            <DifficultyRows {...props} choices={choices} offered={offered()} />
          </>
        )}
      </Show>
    </FramePlacePage>
  );
}

/**
 * Inviting one of the space's members to a seat: each member a row;
 * pressing one invites them and returns to the lobby.
 */
export function FrameInvitePlace(
  props: Props & { readonly seat: FrameSetupSeat }
): JSX.Element {
  const choices = createFrameChoices(() => props.onOpen({ screen: 'lobby' }));
  const side = () => props.seat.side;
  const invitees = () => props.seat.choices?.invitees ?? [];
  return (
    <FramePlacePage
      {...props}
      screenId="custom-game-invite"
      title={<Trans>Invite to {props.seat.sideLabel}</Trans>}
    >
      <Show
        when={invitees().length > 0}
        fallback={
          <MenuSection>
            <MenuRow
              title={<Trans>Nobody else is in this space yet</Trans>}
              caption={<Trans>Share the space, or leave the seat open.</Trans>}
            />
          </MenuSection>
        }
      >
        <MenuSection title={<Trans>People in this space</Trans>}>
          <For each={invitees()}>
            {(invitee) => (
              <FrameChoiceRow
                choices={choices}
                id={
                  invitee.disabled
                    ? `custom-game-${side()}-seated`
                    : `custom-game-${side()}-invitable`
                }
                choice={invitee.person}
                leading={
                  <FramePersonAvatar
                    person={invitee.person}
                    plainName={invitee.plainName}
                    size={INVITEE_AVATAR_SIZE}
                    people={props.people}
                  />
                }
                title={
                  <FramePersonName
                    person={invitee.person}
                    plainName={invitee.plainName}
                    people={props.people}
                  />
                }
                caption={
                  invitee.disabled ? <Trans>Already seated</Trans> : undefined
                }
                disabled={invitee.disabled}
                operation={() =>
                  props.onChoose({
                    operation: 'invite',
                    side: side(),
                    person: invitee.person,
                  })
                }
              />
            )}
          </For>
        </MenuSection>
      </Show>
    </FramePlacePage>
  );
}

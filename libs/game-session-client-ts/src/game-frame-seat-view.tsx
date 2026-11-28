import type { GameSessionInput } from '@libs/game-session-shared-ts/game-session-choice';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import {
  DoorOpenIcon,
  LockIcon,
  LogOutIcon,
  SmartphoneIcon,
  UserIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { FriendsArt } from '@pkgs/ui-root-client-ts/illustration';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import type { JSX } from '@solidjs/web';
import { For, Show } from 'solid-js';
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
import { FramePlacePage } from './game-frame-shell';
import type { FrameSeatChoices, FrameSetupSeat } from './game-frame-view-types';
import type { FramePlaceProps } from './game-session-screen-view';

type Props = FramePlaceProps;

type SeatProps = Props & {
  readonly seat: FrameSetupSeat;
  readonly choices: FrameChoices;
};

const INVITEE_AVATAR_SIZE = 32;

/** The choices that name only the seat. */
type SeatOperation = Exclude<
  Extract<GameSessionInput, { side: unknown }>['operation'],
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
            id={`game-session-${side()}-claim`}
            leading={<UserIcon size={20} />}
            title={<Trans>Sit here</Trans>}
            operation={seatChoice(props, 'claim')}
          />
        </Show>
        <Show when={invitation()?.canAnswer}>
          <FrameChoiceRow
            choices={props.choices}
            id={`game-session-${side()}-accept`}
            title={<Trans>Accept the invitation</Trans>}
            operation={seatChoice(props, 'accept')}
          />
          <FrameChoiceRow
            choices={props.choices}
            id={`game-session-${side()}-decline`}
            title={<Trans>Decline the invitation</Trans>}
            operation={seatChoice(props, 'decline')}
          />
        </Show>
        <Show when={invitation()?.canRevoke}>
          <FrameChoiceRow
            choices={props.choices}
            id={`game-session-${side()}-revoke`}
            title={<Trans>Revoke the invitation</Trans>}
            tone="destructive"
            operation={seatChoice(props, 'revoke')}
          />
        </Show>
        <Show when={props.seat.canLeave}>
          <FrameChoiceRow
            choices={props.choices}
            id={`game-session-${side()}-release`}
            leading={<LogOutIcon size={20} />}
            title={<Trans>Leave seat</Trans>}
            operation={seatChoice(props, 'release')}
          />
        </Show>
      </MenuSection>
    </Show>
  );
}

/** People who may sit here. A bot is never a choice on this screen. */
function HolderRows(
  props: SeatProps & { readonly offered: FrameSeatChoices }
): JSX.Element {
  const side = () => props.seat.side;
  const kind = () => props.seat.holder.kind;
  return (
    <MenuSection title={<Trans>Who sits here</Trans>}>
      <FrameChoiceRow
        choices={props.choices}
        id={`game-session-${side()}-take`}
        leading={<UserIcon size={20} />}
        title={<Trans>Me</Trans>}
        selected={props.seat.own && kind() === 'person'}
        operation={seatChoice(props, 'take')}
      />
      <Show when={props.offered.localPlayers}>
        <FrameChoiceRow
          choices={props.choices}
          id={`game-session-${side()}-local`}
          leading={<SmartphoneIcon size={20} />}
          title={<Trans>A player on this device</Trans>}
          selected={kind() === 'local'}
          operation={seatChoice(props, 'local')}
        />
      </Show>
      <Show when={props.offered.invitees}>
        <MenuRow
          leading={<FriendsArt />}
          title={<Trans>Someone in this space</Trans>}
          caption={<Trans>They get an invitation</Trans>}
          selected={kind() === 'invitation'}
          onClick={() => props.onOpen({ screen: 'invite', side: side() })}
          dataSet={{ testid: `game-session-${side()}-invite-choose` }}
        />
      </Show>
      <FrameChoiceRow
        choices={props.choices}
        id={`game-session-${side()}-open`}
        leading={<DoorOpenIcon size={20} />}
        title={<Trans>Open seat</Trans>}
        caption={<Trans>Anyone in this space may sit</Trans>}
        selected={kind() === 'open'}
        operation={seatChoice(props, 'open')}
      />
      <FrameChoiceRow
        choices={props.choices}
        id={`game-session-${side()}-close`}
        leading={<LockIcon size={20} />}
        title={<Trans>Closed seat</Trans>}
        caption={<Trans>Nobody may sit until you choose</Trans>}
        selected={kind() === 'closed'}
        operation={seatChoice(props, 'close')}
      />
    </MenuSection>
  );
}

/**
 * One seat at a friend's table: a person, an invitation, or an open seat.
 * Pressing a choice sends it and returns to the lobby.
 */
export function FrameSeatPlace(
  props: Props & { readonly seat: FrameSetupSeat }
): JSX.Element {
  const choices = createFrameChoices(() => props.onClose());
  return (
    <FramePlacePage
      {...props}
      screenId="game-session-setup-seat"
      back={<Trans>Back to setup</Trans>}
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
  const choices = createFrameChoices(() => props.onOpen({ screen: 'setup' }));
  const side = () => props.seat.side;
  const invitees = () => props.seat.choices?.invitees ?? [];
  return (
    <FramePlacePage
      {...props}
      screenId="game-session-setup-invite"
      back={<Trans>Back to the seat</Trans>}
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
                    ? `game-session-${side()}-seated`
                    : `game-session-${side()}-invitable`
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
                  // Says what a press does: it sends the invitation.
                  invitee.disabled ? (
                    <Trans>Already seated</Trans>
                  ) : (
                    <Trans>Invite to play {props.seat.sideLabel}</Trans>
                  )
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

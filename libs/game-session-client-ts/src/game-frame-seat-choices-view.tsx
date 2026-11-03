import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameActions } from '@pkgs/ui-root-client-ts/game-section';
import { Select } from '@pkgs/ui-root-client-ts/select';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createMemo, createSignal, For, type JSX, Show } from 'solid-js';
import { FramePersonName } from './game-frame-people';
import type {
  FrameInvitation,
  FramePeople,
  FrameSeatChoices,
  FrameSetupSeat,
} from './game-frame-view-types';

type Choose = (input: CustomGameInput) => Promise<void>;

type SeatProps = {
  readonly seat: FrameSetupSeat;
  readonly people?: FramePeople | undefined;
  readonly onChoose: Choose;
};

/** An invitation on a seat: answered by the invited person, revoked by the host. */
export function FrameInvitationView(
  props: SeatProps & { readonly invitation: FrameInvitation }
): JSX.Element {
  const side = () => props.seat.side;
  return (
    <StackVertical gap="md">
      <Show when={props.invitation.mine}>
        <P role="status" testId={`custom-game-${side()}-invitation`}>
          <FramePersonName
            person={props.invitation.inviter}
            plainName={props.invitation.inviterName}
            people={props.people}
            bold
          />{' '}
          <Trans>invites you to play {props.seat.sideLabel}.</Trans>
        </P>
      </Show>
      <GameActions>
        <Show when={props.invitation.canAnswer}>
          <GameActionButton
            title={<Trans>Accept</Trans>}
            variant="solid"
            dataSet={{ testid: `custom-game-${side()}-accept` }}
            operation={() =>
              props.onChoose({ operation: 'accept', side: side() })
            }
          />
          <GameActionButton
            title={<Trans>Decline</Trans>}
            dataSet={{ testid: `custom-game-${side()}-decline` }}
            operation={() =>
              props.onChoose({ operation: 'decline', side: side() })
            }
          />
        </Show>
        <Show when={props.invitation.canRevoke}>
          <GameActionButton
            title={<Trans>Revoke invitation</Trans>}
            dataSet={{ testid: `custom-game-${side()}-revoke` }}
            operation={() =>
              props.onChoose({ operation: 'revoke', side: side() })
            }
          />
        </Show>
      </GameActions>
    </StackVertical>
  );
}

/** The levels a bot in this seat can play at. */
function FrameDifficultyView(
  props: SeatProps & { readonly choices: FrameSeatChoices }
): JSX.Element {
  const side = () => props.seat.side;
  return (
    <Show when={props.choices.difficulties.length > 0}>
      <P variant="caption" tone="secondary">
        <Trans>Bot difficulty</Trans>
      </P>
      <GameActions>
        <For each={props.choices.difficulties}>
          {(difficulty) => (
            <GameActionButton
              title={
                difficulty === 'easy' ? (
                  <Trans>Easy</Trans>
                ) : difficulty === 'medium' ? (
                  <Trans>Medium</Trans>
                ) : (
                  <Trans>Hard</Trans>
                )
              }
              variant={
                props.choices.difficulty === difficulty ? 'solid' : 'outline'
              }
              dataSet={{ testid: `custom-${side()}-difficulty-${difficulty}` }}
              operation={() =>
                props.onChoose({
                  operation: 'difficulty',
                  side: side(),
                  difficulty,
                })
              }
            />
          )}
        </For>
      </GameActions>
    </Show>
  );
}

/** Invite one of the space's members to this seat. */
function FrameInviteView(
  props: SeatProps & { readonly invitees: FrameSeatChoices['invitees'] & {} }
): JSX.Element {
  const side = () => props.seat.side;
  const [person, setPerson] = createSignal('');
  const options = createMemo(() =>
    props.invitees.map((invitee) => ({
      value: invitee.person,
      label: (
        <FramePersonName
          person={invitee.person}
          plainName={invitee.plainName}
          people={props.people}
        />
      ),
      disabled: invitee.disabled,
      // Someone who may be invited, as a person picks them from the list.
      ...(invitee.disabled
        ? {}
        : { dataSet: { testid: `custom-game-${side()}-invitable` } }),
    }))
  );
  return (
    <>
      <Select
        label={<Trans>Invite a space member</Trans>}
        placeholder={t`Choose a person`}
        options={options()}
        value={person()}
        onValueChange={(value) => setPerson(String(value))}
        dataSet={{ testid: `custom-game-${side()}-invite-person` }}
        triggerDataSet={{ testid: `custom-game-${side()}-invite-choose` }}
      />
      <GameActionButton
        title={<Trans>Invite</Trans>}
        disabled={person() === ''}
        dataSet={{ testid: `custom-game-${side()}-invite` }}
        operation={() =>
          props.onChoose({
            operation: 'invite',
            side: side(),
            person: person(),
          })
        }
      />
    </>
  );
}

/** Everything the host may put in a seat. */
export function FrameSeatChoicesView(
  props: SeatProps & { readonly choices: FrameSeatChoices }
): JSX.Element {
  const side = () => props.seat.side;
  const seatChoice = (
    operation: 'take' | 'local' | 'bot' | 'open' | 'close'
  ): Promise<void> => props.onChoose({ operation, side: side() });
  return (
    <StackVertical gap="md">
      <GameActions>
        <GameActionButton
          title={<Trans>Take this seat</Trans>}
          dataSet={{ testid: `custom-game-${side()}-take` }}
          operation={() => seatChoice('take')}
        />
        <Show when={props.choices.localPlayers}>
          <GameActionButton
            title={<Trans>Player on this device</Trans>}
            dataSet={{ testid: `custom-game-${side()}-local` }}
            operation={() => seatChoice('local')}
          />
        </Show>
        <Show when={props.choices.bots}>
          <GameActionButton
            title={<Trans>Bot</Trans>}
            dataSet={{ testid: `custom-game-${side()}-bot` }}
            operation={() => seatChoice('bot')}
          />
        </Show>
        <GameActionButton
          title={<Trans>Open seat</Trans>}
          dataSet={{ testid: `custom-game-${side()}-open` }}
          operation={() => seatChoice('open')}
        />
        <GameActionButton
          title={<Trans>Close seat</Trans>}
          dataSet={{ testid: `custom-game-${side()}-close` }}
          operation={() => seatChoice('close')}
        />
      </GameActions>
      <FrameDifficultyView {...props} />
      <Show when={props.choices.invitees}>
        {(invitees) => <FrameInviteView {...props} invitees={invitees()} />}
      </Show>
    </StackVertical>
  );
}

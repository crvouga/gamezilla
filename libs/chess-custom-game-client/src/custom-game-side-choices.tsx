import type { CustomGameSide } from '@libs/chess-custom-game-shared/custom-game-state';
import { UserUsername } from '@libs/profile-client/user-username';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { GameActionButton } from '@pkgs/ui-root-client/game-action-button';
import { Select } from '@pkgs/ui-root-client/select';
import { createMemo, createSignal, type JSX, Show } from 'solid-js';
import type { CustomGameScreenModel } from './use-custom-game-screen';

type SideProps = { model: CustomGameScreenModel; side: CustomGameSide };

export function CustomGameInvitation(props: SideProps): JSX.Element {
  const mine = (): boolean =>
    props.model.current()?.[props.side].person === props.model.myId();
  return (
    <div class="box flex-row gap-2 flex-wrap">
      <Show when={mine()}>
        <p
          class="text textBody"
          role="status"
          data-testid={`chess-custom-${props.side}-invitation`}
        >
          <UserUsername
            profileId={props.model.current()?.creator ?? ''}
            withAt={false}
          />{' '}
          <Show
            when={props.side === 'white'}
            fallback={<Trans>invites you to play Black.</Trans>}
          >
            <Trans>invites you to play White.</Trans>
          </Show>
        </p>
      </Show>
      <Show when={mine() && props.model.canJoin()}>
        <GameActionButton
          title={<Trans>Accept</Trans>}
          variant="solid"
          dataSet={{ testid: `chess-custom-${props.side}-accept` }}
          operation={() =>
            props.model.choose({ operation: 'accept', side: props.side })
          }
        />
        <GameActionButton
          title={<Trans>Decline</Trans>}
          dataSet={{ testid: `chess-custom-${props.side}-decline` }}
          operation={() =>
            props.model.choose({ operation: 'decline', side: props.side })
          }
        />
      </Show>
      <Show when={props.model.canInvite()}>
        <GameActionButton
          title={<Trans>Revoke invitation</Trans>}
          dataSet={{ testid: `chess-custom-${props.side}-revoke` }}
          operation={() =>
            props.model.choose({ operation: 'revoke', side: props.side })
          }
        />
      </Show>
    </div>
  );
}

export function CustomGameSideChoices(props: SideProps): JSX.Element {
  const [person, setPerson] = createSignal('');
  const invitations = createMemo(() =>
    props.model.members().map((id) => {
      const disabled =
        id === props.model.current()?.white.person ||
        id === props.model.current()?.black.person;
      return {
        value: id,
        label: <UserUsername profileId={id} withAt={false} />,
        disabled,
        // Someone who may be invited, as a person picks them from the list.
        ...(disabled
          ? {}
          : { dataSet: { testid: `chess-custom-${props.side}-invitable` } }),
      };
    })
  );
  return (
    <div class="box gap-2">
      <div class="box flex-row gap-2 flex-wrap">
        <GameActionButton
          title={<Trans>Take this side</Trans>}
          dataSet={{ testid: `chess-custom-${props.side}-take` }}
          operation={() =>
            props.model.choose({ operation: 'take', side: props.side })
          }
        />
        <Show when={props.model.canBot()}>
          <GameActionButton
            title={<Trans>Bot</Trans>}
            dataSet={{ testid: `chess-custom-${props.side}-bot` }}
            operation={() =>
              props.model.choose({ operation: 'bot', side: props.side })
            }
          />
        </Show>
        <GameActionButton
          title={<Trans>Open place</Trans>}
          dataSet={{ testid: `chess-custom-${props.side}-open` }}
          operation={() =>
            props.model.choose({ operation: 'open', side: props.side })
          }
        />
        <GameActionButton
          title={<Trans>Close place</Trans>}
          dataSet={{ testid: `chess-custom-${props.side}-close` }}
          operation={() =>
            props.model.choose({ operation: 'close', side: props.side })
          }
        />
      </div>
      <Show when={props.model.canInvite()}>
        <Select
          label={<Trans>Invite a space member</Trans>}
          placeholder={t`Choose a person`}
          options={invitations()}
          value={person()}
          onValueChange={(value) => setPerson(String(value))}
          dataSet={{ testid: `chess-custom-${props.side}-invite-person` }}
          triggerDataSet={{
            testid: `chess-custom-${props.side}-invite-choose`,
          }}
        />
        <GameActionButton
          title={<Trans>Invite</Trans>}
          disabled={person() === ''}
          dataSet={{ testid: `chess-custom-${props.side}-invite` }}
          operation={() =>
            props.model.choose({
              operation: 'invite',
              side: props.side,
              person: person(),
            })
          }
        />
      </Show>
    </div>
  );
}

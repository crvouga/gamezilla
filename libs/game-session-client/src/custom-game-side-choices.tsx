import type { CustomGameSide } from '@libs/game-session-shared/custom-game-state';
import { UserUsername } from '@libs/profile-client/user-username';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { useGameSideLabel } from '@pkgs/turn-game-client/use-game-side-label';
import { GameActionButton } from '@pkgs/ui-root-client/game-action-button';
import { GameActions } from '@pkgs/ui-root-client/game-section';
import { Select } from '@pkgs/ui-root-client/select';
import { createMemo, createSignal, type JSX, Show } from 'solid-js';
import { CustomGameDifficulty } from './custom-game-difficulty';
import type { CustomGameScreenModel } from './use-custom-game-screen';

type SideProps = { model: CustomGameScreenModel; side: CustomGameSide };

export function CustomGameInvitation(props: SideProps): JSX.Element {
  const gameSideLabel = useGameSideLabel();
  const mine = (): boolean =>
    props.model.current()?.[props.side].person === props.model.myId();
  return (
    <div class="box gap-3">
      <Show when={mine()}>
        <p
          class="text textBody flex flex-row flex-wrap gap-x-1"
          role="status"
          data-testid={`custom-game-${props.side}-invitation`}
        >
          <UserUsername
            profileId={props.model.current()?.creator ?? ''}
            withAt={false}
            variant="bodyBold"
          />{' '}
          <Trans>
            invites you to play{' '}
            {gameSideLabel(props.model.current()?.fen ?? '', props.side)}.
          </Trans>
        </p>
      </Show>
      <GameActions>
        <Show when={mine() && props.model.canJoin()}>
          <GameActionButton
            title={<Trans>Accept</Trans>}
            variant="solid"
            dataSet={{ testid: `custom-game-${props.side}-accept` }}
            operation={() =>
              props.model.choose({ operation: 'accept', side: props.side })
            }
          />
          <GameActionButton
            title={<Trans>Decline</Trans>}
            dataSet={{ testid: `custom-game-${props.side}-decline` }}
            operation={() =>
              props.model.choose({ operation: 'decline', side: props.side })
            }
          />
        </Show>
        <Show when={props.model.canInvite()}>
          <GameActionButton
            title={<Trans>Revoke invitation</Trans>}
            dataSet={{ testid: `custom-game-${props.side}-revoke` }}
            operation={() =>
              props.model.choose({ operation: 'revoke', side: props.side })
            }
          />
        </Show>
      </GameActions>
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
          : { dataSet: { testid: `custom-game-${props.side}-invitable` } }),
      };
    })
  );
  return (
    <div class="box gap-3">
      <GameActions>
        <GameActionButton
          title={<Trans>Take this side</Trans>}
          dataSet={{ testid: `custom-game-${props.side}-take` }}
          operation={() =>
            props.model.choose({ operation: 'take', side: props.side })
          }
        />
        <Show when={props.model.canBot()}>
          <GameActionButton
            title={<Trans>Bot</Trans>}
            dataSet={{ testid: `custom-game-${props.side}-bot` }}
            operation={() =>
              props.model.choose({ operation: 'bot', side: props.side })
            }
          />
        </Show>
        <GameActionButton
          title={<Trans>Open place</Trans>}
          dataSet={{ testid: `custom-game-${props.side}-open` }}
          operation={() =>
            props.model.choose({ operation: 'open', side: props.side })
          }
        />
        <GameActionButton
          title={<Trans>Close place</Trans>}
          dataSet={{ testid: `custom-game-${props.side}-close` }}
          operation={() =>
            props.model.choose({ operation: 'close', side: props.side })
          }
        />
      </GameActions>
      <CustomGameDifficulty {...props} />
      <Show when={props.model.canInvite()}>
        <Select
          label={<Trans>Invite a space member</Trans>}
          placeholder={t`Choose a person`}
          options={invitations()}
          value={person()}
          onValueChange={(value) => setPerson(String(value))}
          dataSet={{ testid: `custom-game-${props.side}-invite-person` }}
          triggerDataSet={{
            testid: `custom-game-${props.side}-invite-choose`,
          }}
        />
        <GameActionButton
          title={<Trans>Invite</Trans>}
          disabled={person() === ''}
          dataSet={{ testid: `custom-game-${props.side}-invite` }}
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

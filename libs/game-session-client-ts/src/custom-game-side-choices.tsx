import type { CustomGameSide } from '@libs/game-session-shared-ts/custom-game-state';
import { UserUsername } from '@libs/profile-client-ts/user-username';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { useTurnGames } from '@pkgs/turn-game-client-ts/turn-games-context';
import { useGameSideLabel } from '@pkgs/turn-game-client-ts/use-game-side-label';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameActions } from '@pkgs/ui-root-client-ts/game-section';
import { Select } from '@pkgs/ui-root-client-ts/select';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createMemo, createSignal, type JSX, Show } from 'solid-js';
import { CustomGameDifficulty } from './custom-game-difficulty';
import type { CustomGameScreenModel } from './use-custom-game-screen';

type SideProps = { model: CustomGameScreenModel; side: CustomGameSide };

export function CustomGameInvitation(props: SideProps): JSX.Element {
  const gameSideLabel = useGameSideLabel();
  const mine = (): boolean =>
    props.model.current()?.[props.side].person === props.model.myId();
  return (
    <StackVertical gap="md">
      <Show when={mine()}>
        <P role="status" testId={`custom-game-${props.side}-invitation`}>
          <UserUsername
            profileId={props.model.current()?.creator ?? ''}
            withAt={false}
            variant="bodyBold"
          />{' '}
          <Trans>
            invites you to play{' '}
            {gameSideLabel(props.model.current()?.fen ?? '', props.side)}.
          </Trans>
        </P>
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
    </StackVertical>
  );
}

export function CustomGameSideChoices(props: SideProps): JSX.Element {
  const rules = useTurnGames();
  const localPlayers = () => {
    const game = props.model.current();
    return (
      game !== null &&
      rules.capability(rules.forPosition(game.fen).id, 'custom-games')
        ?.localPlayers === true
    );
  };
  const [person, setPerson] = createSignal('');
  const invitations = createMemo(() =>
    props.model.members().map((id) => {
      const game = props.model.current();
      const disabled =
        game?.sides.some((side) => game[side].person === id) ?? false;
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
    <StackVertical gap="md">
      <GameActions>
        <GameActionButton
          title={<Trans>Take this seat</Trans>}
          dataSet={{ testid: `custom-game-${props.side}-take` }}
          operation={() =>
            props.model.choose({ operation: 'take', side: props.side })
          }
        />
        <Show when={localPlayers() && props.model.canConfigure()}>
          <GameActionButton
            title={<Trans>Player on this device</Trans>}
            dataSet={{ testid: `custom-game-${props.side}-local` }}
            operation={() =>
              props.model.choose({ operation: 'local', side: props.side })
            }
          />
        </Show>
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
          title={<Trans>Open seat</Trans>}
          dataSet={{ testid: `custom-game-${props.side}-open` }}
          operation={() =>
            props.model.choose({ operation: 'open', side: props.side })
          }
        />
        <GameActionButton
          title={<Trans>Close seat</Trans>}
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
    </StackVertical>
  );
}

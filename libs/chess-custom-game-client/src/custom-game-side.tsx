import type { CustomGameSide } from '@libs/chess-custom-game-shared/custom-game-state';
import { UserUsername } from '@libs/profile-client/user-username';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client/button';
import { Select } from '@pkgs/ui-root-client/select';
import { createMemo, createSignal, For, type JSX, Show } from 'solid-js';
import { CustomGameAction } from './custom-game-action';
import { CustomGamePerson } from './custom-game-person';
import type { CustomGameScreenModel } from './use-custom-game-screen';

type SideProps = { model: CustomGameScreenModel; side: CustomGameSide };

function CustomGameInvitation(props: SideProps): JSX.Element {
  const mine = (): boolean =>
    props.model.current()?.[props.side].person === props.model.myId();
  return (
    <div class="box flex-row gap-2 flex-wrap">
      <Show when={mine() && props.model.canJoin()}>
        <CustomGameAction
          title={<Trans>Accept</Trans>}
          testId={`chess-custom-${props.side}-accept`}
          operation={() =>
            props.model.choose({ operation: 'accept', side: props.side })
          }
        />
        <CustomGameAction
          title={<Trans>Decline</Trans>}
          testId={`chess-custom-${props.side}-decline`}
          operation={() =>
            props.model.choose({ operation: 'decline', side: props.side })
          }
        />
      </Show>
      <Show when={props.model.canInvite()}>
        <CustomGameAction
          title={<Trans>Revoke invitation</Trans>}
          testId={`chess-custom-${props.side}-revoke`}
          operation={() =>
            props.model.choose({ operation: 'revoke', side: props.side })
          }
        />
      </Show>
    </div>
  );
}

function CustomGameSideChoices(props: SideProps): JSX.Element {
  const [person, setPerson] = createSignal('');
  const invitations = createMemo(() =>
    props.model.members().map((id) => ({
      value: id,
      label: <UserUsername profileId={id} withAt={false} />,
      disabled:
        id === props.model.current()?.white.person ||
        id === props.model.current()?.black.person,
    }))
  );
  return (
    <div class="box gap-2">
      <div class="box flex-row gap-2 flex-wrap">
        <CustomGameAction
          title={<Trans>Take this side</Trans>}
          testId={`chess-custom-${props.side}-take`}
          operation={() =>
            props.model.choose({ operation: 'take', side: props.side })
          }
        />
        <Show when={props.model.canBot()}>
          <CustomGameAction
            title={<Trans>Bot</Trans>}
            testId={`chess-custom-${props.side}-bot`}
            operation={() =>
              props.model.choose({ operation: 'bot', side: props.side })
            }
          />
        </Show>
        <CustomGameAction
          title={<Trans>Open place</Trans>}
          testId={`chess-custom-${props.side}-open`}
          operation={() =>
            props.model.choose({ operation: 'open', side: props.side })
          }
        />
        <CustomGameAction
          title={<Trans>Close place</Trans>}
          testId={`chess-custom-${props.side}-close`}
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
        />
        <CustomGameAction
          title={<Trans>Invite</Trans>}
          disabled={person() === ''}
          testId={`chess-custom-${props.side}-invite`}
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

export function CustomGameSideCard(props: SideProps): JSX.Element {
  const [advanced, setAdvanced] = createSignal(false);
  const participant = () => props.model.current()![props.side];
  const configuring = (): boolean =>
    props.model.current()?.status === 'configuring';
  const controls = (): boolean => configuring() && props.model.canConfigure();
  return (
    <section
      class="box gap-3 rounded-lg border p-4"
      data-component="CustomGameSide"
      data-testid={`chess-custom-${props.side}`}
    >
      <h2 class="textSubtitle">
        <Show when={props.side === 'white'} fallback={<Trans>Black</Trans>}>
          <Trans>White</Trans>
        </Show>
      </h2>
      <p class="textBodyBold" data-testid={`chess-custom-${props.side}-person`}>
        <CustomGamePerson participant={participant()} />
      </p>
      <Show when={props.model.current()?.ready.includes(props.side)}>
        <p>
          <Trans>Ready</Trans>
        </p>
      </Show>
      <Show when={configuring() && participant().kind === 'invitation'}>
        <CustomGameInvitation {...props} />
      </Show>
      <Show
        when={
          configuring() &&
          participant().kind === 'open' &&
          props.model.canJoin()
        }
      >
        <CustomGameAction
          title={<Trans>Claim this side</Trans>}
          testId={`chess-custom-${props.side}-claim`}
          operation={() =>
            props.model.choose({ operation: 'claim', side: props.side })
          }
        />
      </Show>
      <Show
        when={
          configuring() &&
          participant().kind === 'person' &&
          participant().person === props.model.myId() &&
          props.model.canJoin()
        }
      >
        <CustomGameAction
          title={<Trans>Release this side</Trans>}
          testId={`chess-custom-${props.side}-release`}
          operation={() =>
            props.model.choose({ operation: 'release', side: props.side })
          }
        />
      </Show>
      <Show when={controls()}>
        <Button
          title={<Trans>Change participant</Trans>}
          variant="ghost"
          onClick={() => setAdvanced(!advanced())}
          dataSet={{ testid: `chess-custom-${props.side}-choices` }}
        />
        <Show when={advanced()}>
          <CustomGameSideChoices {...props} />
        </Show>
      </Show>
    </section>
  );
}

export function CustomGameSides(props: {
  model: CustomGameScreenModel;
}): JSX.Element {
  return (
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <For each={['white', 'black'] as const}>
        {(side) => <CustomGameSideCard model={props.model} side={side} />}
      </For>
    </div>
  );
}

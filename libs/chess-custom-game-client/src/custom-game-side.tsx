import type { CustomGameSide } from '@libs/chess-custom-game-shared/custom-game-state';
import { UserProfileAvatar } from '@libs/profile-client/user-profile-avatar';
import { Trans } from '@lingui/solid/macro';
import { GameActionButton } from '@pkgs/ui-root-client/game-action-button';
import { GameDisclosure } from '@pkgs/ui-root-client/game-disclosure';
import { GamePlayerCard } from '@pkgs/ui-root-client/game-player-card';
import { GameVersus } from '@pkgs/ui-root-client/game-versus';
import { type JSX, Show } from 'solid-js';
import { CustomGamePerson } from './custom-game-person';
import {
  CustomGameInvitation,
  CustomGameSideChoices,
} from './custom-game-side-choices';
import type { CustomGameScreenModel } from './use-custom-game-screen';

type SideProps = { model: CustomGameScreenModel; side: CustomGameSide };

export function CustomGameSideCard(props: SideProps): JSX.Element {
  const participant = () => props.model.current()![props.side];
  const configuring = (): boolean =>
    props.model.current()?.status === 'configuring';
  return (
    <GamePlayerCard
      dataSet={{ testid: `chess-custom-${props.side}` }}
      label={
        <Show when={props.side === 'white'} fallback={<Trans>Black</Trans>}>
          <Trans>White</Trans>
        </Show>
      }
      name={
        <span data-testid={`chess-custom-${props.side}-person`}>
          <CustomGamePerson participant={participant()} />
        </span>
      }
      avatar={
        <Show
          when={
            participant().kind === 'person' ||
            participant().kind === 'invitation'
          }
        >
          <UserProfileAvatar profileId={participant().person} size={48} />
        </Show>
      }
      active={
        props.model.current()?.status === 'active' &&
        props.model.current()?.turn === props.side
      }
      ready={props.model.current()?.ready.includes(props.side) === true}
      status={
        <Show
          when={props.model.current()?.ready.includes(props.side)}
          fallback={
            <Show when={configuring()}>
              <Trans>Getting ready</Trans>
            </Show>
          }
        >
          <Trans>Ready</Trans>
        </Show>
      }
    >
      <CustomGameSideActions {...props} />
    </GamePlayerCard>
  );
}

export function CustomGameSides(props: {
  model: CustomGameScreenModel;
}): JSX.Element {
  return (
    <GameVersus
      stackOnSmall={props.model.current()?.status === 'configuring'}
      first={<CustomGameSideCard model={props.model} side="white" />}
      second={<CustomGameSideCard model={props.model} side="black" />}
    />
  );
}

function CustomGameSideActions(props: SideProps): JSX.Element {
  const participant = () => props.model.current()![props.side];
  const configuring = () => props.model.current()?.status === 'configuring';
  const controls = () => configuring() && props.model.canConfigure();
  return (
    <>
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
        <GameActionButton
          title={<Trans>Claim this side</Trans>}
          dataSet={{ testid: `chess-custom-${props.side}-claim` }}
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
        <GameActionButton
          title={<Trans>Release this side</Trans>}
          dataSet={{ testid: `chess-custom-${props.side}-release` }}
          operation={() =>
            props.model.choose({ operation: 'release', side: props.side })
          }
        />
      </Show>
      <Show when={controls()}>
        <GameDisclosure
          title={<Trans>Change participant</Trans>}
          dataSet={{ testid: `chess-custom-${props.side}-choices` }}
        >
          <CustomGameSideChoices {...props} />
        </GameDisclosure>
      </Show>
    </>
  );
}

import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game-state';
import {
  bothHaveMoved,
  isFinished,
  otherPerson,
} from '@libs/chess-matchmaking-shared/game-state';
import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client/button';
import type { MutationButtonLabels } from '@pkgs/ui-root-client/use-mutation-button';
import { useMutationButton } from '@pkgs/ui-root-client/use-mutation-button';
import { type JSX, Show } from 'solid-js';
import type { MultiplayerControlsModel } from './use-multiplayer-controls';

function ActionButton(props: {
  readonly operation: () => Promise<void>;
  readonly labels: MutationButtonLabels;
  readonly testid: string;
}): JSX.Element {
  const action = useMutationButton({
    operation: () => props.operation(),
    labels: props.labels,
  });
  return <Button {...action.buttonProps} dataSet={{ testid: props.testid }} />;
}

function DrawActions(props: {
  readonly game: MultiplayerGame;
  readonly myId: string;
  readonly controls: MultiplayerControlsModel;
}): JSX.Element {
  const offered = () =>
    props.game.draw_offer_by === otherPerson(props.game, props.myId);
  return (
    <Show
      when={offered()}
      fallback={
        <ActionButton
          operation={props.controls.offerDraw}
          labels={{
            idle: <Trans>Offer a multiplayer draw</Trans>,
            success: <Trans>Multiplayer draw offered</Trans>,
          }}
          testid="multiplayer-offer-draw"
        />
      }
    >
      <ActionButton
        operation={props.controls.acceptDraw}
        labels={{ idle: <Trans>Accept the multiplayer draw</Trans> }}
        testid="multiplayer-accept-draw"
      />
      <ActionButton
        operation={props.controls.declineDraw}
        labels={{ idle: <Trans>Decline the multiplayer draw</Trans> }}
        testid="multiplayer-decline-draw"
      />
    </Show>
  );
}

function RematchActions(props: {
  readonly game: MultiplayerGame;
  readonly myId: string;
  readonly controls: MultiplayerControlsModel;
}): JSX.Element {
  const offered = () =>
    props.game.rematch_offer_by === otherPerson(props.game, props.myId);
  return (
    <Show
      when={offered()}
      fallback={
        <ActionButton
          operation={props.controls.offerRematch}
          labels={{
            idle: <Trans>Offer a multiplayer rematch</Trans>,
            success: <Trans>Multiplayer rematch offered</Trans>,
          }}
          testid="multiplayer-offer-rematch"
        />
      }
    >
      <ActionButton
        operation={props.controls.acceptRematch}
        labels={{ idle: <Trans>Accept the multiplayer rematch</Trans> }}
        testid="multiplayer-accept-rematch"
      />
      <ActionButton
        operation={props.controls.declineRematch}
        labels={{ idle: <Trans>Decline the multiplayer rematch</Trans> }}
        testid="multiplayer-decline-rematch"
      />
    </Show>
  );
}

/** What a person can do with their game: only what its state allows. */
export function MultiplayerGameActions(props: {
  readonly game: MultiplayerGame;
  readonly myId: string;
  readonly controls: MultiplayerControlsModel;
  readonly looking: boolean;
  readonly onConfirm: (kind: 'abort' | 'resign') => void;
}): JSX.Element {
  return (
    <div
      class="box flex-row flex-wrap gap-2"
      data-component="MultiplayerGameActions"
    >
      <Show when={props.game.outcome === 'ongoing'}>
        <Show
          when={bothHaveMoved(props.game)}
          fallback={
            <Button
              title={<Trans>Abort the multiplayer game</Trans>}
              onClick={() => props.onConfirm('abort')}
              dataSet={{ testid: 'multiplayer-abort' }}
            />
          }
        >
          <Button
            title={<Trans>Resign multiplayer chess</Trans>}
            onClick={() => props.onConfirm('resign')}
            dataSet={{ testid: 'multiplayer-resign' }}
          />
        </Show>
        <DrawActions
          game={props.game}
          myId={props.myId}
          controls={props.controls}
        />
      </Show>
      <Show when={props.game.outcome !== 'ongoing' && !props.looking}>
        <Show when={isFinished(props.game.outcome)}>
          <RematchActions
            game={props.game}
            myId={props.myId}
            controls={props.controls}
          />
        </Show>
        <ActionButton
          operation={props.controls.newOpponent}
          labels={{
            idle: <Trans>Find a new opponent</Trans>,
            success: <Trans>Opponent search accepted</Trans>,
          }}
          testid="multiplayer-new-opponent"
        />
      </Show>
    </div>
  );
}

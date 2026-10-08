import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game-state';
import {
  bothHaveMoved,
  isFinished,
  otherPerson,
} from '@libs/chess-matchmaking-shared/game-state';
import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client/button';
import { GameActionButton } from '@pkgs/ui-root-client/game-action-button';
import { GameSection } from '@pkgs/ui-root-client/game-section';
import { type JSX, Show } from 'solid-js';
import type { MultiplayerControlsModel } from './use-multiplayer-controls';

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
        <GameActionButton
          operation={props.controls.offerDraw}
          title={<Trans>Offer a multiplayer draw</Trans>}
          successLabel={<Trans>Multiplayer draw offered</Trans>}
          dataSet={{ testid: 'multiplayer-offer-draw' }}
        />
      }
    >
      <GameActionButton
        operation={props.controls.acceptDraw}
        title={<Trans>Accept the multiplayer draw</Trans>}
        dataSet={{ testid: 'multiplayer-accept-draw' }}
      />
      <GameActionButton
        operation={props.controls.declineDraw}
        title={<Trans>Decline the multiplayer draw</Trans>}
        dataSet={{ testid: 'multiplayer-decline-draw' }}
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
        <GameActionButton
          operation={props.controls.offerRematch}
          title={<Trans>Offer a multiplayer rematch</Trans>}
          successLabel={<Trans>Multiplayer rematch offered</Trans>}
          dataSet={{ testid: 'multiplayer-offer-rematch' }}
        />
      }
    >
      <GameActionButton
        operation={props.controls.acceptRematch}
        title={<Trans>Accept the multiplayer rematch</Trans>}
        dataSet={{ testid: 'multiplayer-accept-rematch' }}
      />
      <GameActionButton
        operation={props.controls.declineRematch}
        title={<Trans>Decline the multiplayer rematch</Trans>}
        dataSet={{ testid: 'multiplayer-decline-rematch' }}
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
  const playing = () =>
    props.game.white_id === props.myId || props.game.black_id === props.myId;
  return (
    <GameSection title={<Trans>Game actions</Trans>}>
      <div class="box flex-row flex-wrap gap-2">
        <Show when={playing() && props.game.outcome === 'ongoing'}>
          <Show
            when={bothHaveMoved(props.game)}
            fallback={
              <Button
                title={<Trans>Abort the multiplayer game</Trans>}
                intent="danger"
                variant="ghost"
                onClick={() => props.onConfirm('abort')}
                dataSet={{ testid: 'multiplayer-abort' }}
              />
            }
          >
            <Button
              title={<Trans>Resign multiplayer chess</Trans>}
              intent="danger"
              variant="ghost"
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
        <Show
          when={playing() && props.game.outcome !== 'ongoing' && !props.looking}
        >
          <Show when={isFinished(props.game.outcome)}>
            <RematchActions
              game={props.game}
              myId={props.myId}
              controls={props.controls}
            />
          </Show>
          <GameActionButton
            operation={props.controls.newOpponent}
            title={<Trans>Find a new opponent</Trans>}
            variant="solid"
            successLabel={<Trans>Opponent search accepted</Trans>}
            dataSet={{ testid: 'multiplayer-new-opponent' }}
          />
        </Show>
      </div>
    </GameSection>
  );
}

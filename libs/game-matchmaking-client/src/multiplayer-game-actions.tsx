import type { MultiplayerGame } from '@libs/game-matchmaking-shared/game-state';
import {
  bothHaveMoved,
  isFinished,
  otherPerson,
} from '@libs/game-matchmaking-shared/game-state';
import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client/button';
import { GameActionButton } from '@pkgs/ui-root-client/game-action-button';
import { GameActions } from '@pkgs/ui-root-client/game-section';
import { VisuallyHidden } from '@pkgs/ui-root-client/visually-hidden';
import { type JSX, Show } from 'solid-js';
import type { MultiplayerControlsModel } from './use-multiplayer-controls';

// Each label is short for the eye. A listener, who cannot see which game the
// row belongs to, also hears the rest of the sentence.

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
          title={
            <Trans>
              Offer a<VisuallyHidden> multiplayer</VisuallyHidden> draw
            </Trans>
          }
          successLabel={<Trans>Multiplayer draw offered</Trans>}
          dataSet={{ testid: 'multiplayer-offer-draw' }}
        />
      }
    >
      <GameActionButton
        operation={props.controls.acceptDraw}
        variant="solid"
        title={
          <Trans>
            Accept<VisuallyHidden> the multiplayer</VisuallyHidden> draw
          </Trans>
        }
        dataSet={{ testid: 'multiplayer-accept-draw' }}
      />
      <GameActionButton
        operation={props.controls.declineDraw}
        title={
          <Trans>
            Decline<VisuallyHidden> the multiplayer draw</VisuallyHidden>
          </Trans>
        }
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
          title={
            <Trans>
              <VisuallyHidden>Offer a multiplayer </VisuallyHidden>Rematch
            </Trans>
          }
          successLabel={<Trans>Multiplayer rematch offered</Trans>}
          dataSet={{ testid: 'multiplayer-offer-rematch' }}
        />
      }
    >
      <GameActionButton
        operation={props.controls.acceptRematch}
        variant="solid"
        title={
          <Trans>
            Accept<VisuallyHidden> the multiplayer</VisuallyHidden> rematch
          </Trans>
        }
        dataSet={{ testid: 'multiplayer-accept-rematch' }}
      />
      <GameActionButton
        operation={props.controls.declineRematch}
        title={
          <Trans>
            Decline<VisuallyHidden> the multiplayer rematch</VisuallyHidden>
          </Trans>
        }
        dataSet={{ testid: 'multiplayer-decline-rematch' }}
      />
    </Show>
  );
}

/** Before both have moved a game is aborted; after that it is resigned. */
function LeaveGameAction(props: {
  readonly game: MultiplayerGame;
  readonly onConfirm: (kind: 'abort' | 'resign') => void;
}): JSX.Element {
  return (
    <Show
      when={bothHaveMoved(props.game)}
      fallback={
        <Button
          title={
            <Trans>
              Abort<VisuallyHidden> the multiplayer game</VisuallyHidden>
            </Trans>
          }
          intent="danger"
          variant="ghost"
          onClick={() => props.onConfirm('abort')}
          dataSet={{ testid: 'multiplayer-abort' }}
        />
      }
    >
      <Button
        title={
          <Trans>
            Resign<VisuallyHidden> multiplayer game</VisuallyHidden>
          </Trans>
        }
        intent="danger"
        variant="ghost"
        onClick={() => props.onConfirm('resign')}
        dataSet={{ testid: 'multiplayer-resign' }}
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
  const ongoing = () => playing() && props.game.outcome === 'ongoing';
  const over = () =>
    playing() && props.game.outcome !== 'ongoing' && !props.looking;
  return (
    <Show when={ongoing() || over()}>
      <GameActions>
        <Show when={ongoing()}>
          <DrawActions
            game={props.game}
            myId={props.myId}
            controls={props.controls}
          />
          <LeaveGameAction game={props.game} onConfirm={props.onConfirm} />
        </Show>
        <Show when={over()}>
          <GameActionButton
            operation={props.controls.newOpponent}
            title={
              <Trans>
                <VisuallyHidden>Find a </VisuallyHidden>New opponent
              </Trans>
            }
            variant="solid"
            successLabel={<Trans>Opponent search accepted</Trans>}
            dataSet={{ testid: 'multiplayer-new-opponent' }}
          />
          <Show when={isFinished(props.game.outcome)}>
            <RematchActions
              game={props.game}
              myId={props.myId}
              controls={props.controls}
            />
          </Show>
        </Show>
      </GameActions>
    </Show>
  );
}

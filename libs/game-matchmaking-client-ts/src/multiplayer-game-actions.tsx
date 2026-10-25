import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import {
  bothHaveMoved,
  isFinished,
} from '@libs/game-matchmaking-shared-ts/game-state';
import {
  multiplayerPeople,
  multiplayerSideOf,
} from '@libs/game-matchmaking-shared-ts/multiplayer-roster';
import { Trans } from '@lingui/solid/macro';
import { useTurnGames } from '@pkgs/turn-game-client-ts/turn-games-context';
import type { SimulationExecution } from '@pkgs/turn-game-shared-ts/simulation-execution';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameActions } from '@pkgs/ui-root-client-ts/game-section';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
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
    Boolean(
      props.game.draw_offer_by &&
        props.game.draw_offer_by !== props.myId &&
        multiplayerPeople(props.game).includes(props.game.draw_offer_by)
    );
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
    Boolean(
      props.game.rematch_offer_by &&
        props.game.rematch_offer_by !== props.myId &&
        multiplayerPeople(props.game).includes(props.game.rematch_offer_by)
    );
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

/** Before play begins a game is aborted; afterwards it is resigned. */
function LeaveGameAction(props: {
  readonly started: boolean;
  readonly onConfirm: (kind: 'abort' | 'resign') => void;
}): JSX.Element {
  return (
    <Show
      when={props.started}
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
  readonly execution: SimulationExecution | undefined;
  readonly myId: string;
  readonly controls: MultiplayerControlsModel;
  readonly looking: boolean;
  readonly onConfirm: (kind: 'abort' | 'resign') => void;
}): JSX.Element {
  const rules = useTurnGames();
  const started = () =>
    rules.turnsForPosition(props.game.fen) !== undefined
      ? bothHaveMoved(props.game)
      : props.execution?.started === true;
  const playing = () => multiplayerSideOf(props.game, props.myId) !== null;
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
          <LeaveGameAction started={started()} onConfirm={props.onConfirm} />
        </Show>
        <Show when={over()}>
          <GameActionButton
            operation={props.controls.newOpponent}
            title={
              <Show
                when={multiplayerPeople(props.game).length > 2}
                fallback={
                  <Trans>
                    <VisuallyHidden>Find a </VisuallyHidden>New opponent
                  </Trans>
                }
              >
                <Trans>
                  <VisuallyHidden>Find </VisuallyHidden>New players
                </Trans>
              </Show>
            }
            variant="solid"
            successLabel={
              <Show
                when={multiplayerPeople(props.game).length > 2}
                fallback={<Trans>Opponent search accepted</Trans>}
              >
                <Trans>Player search accepted</Trans>
              </Show>
            }
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

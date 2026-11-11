import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import { type JSX, Show } from 'solid-js';
import type {
  MultiplayerGameCommands,
  MultiplayerGameView,
} from './multiplayer-game-view';
import { MultiplayerMoveList } from './multiplayer-move-list';
import {
  type MultiplayerPlaceFrame,
  MultiplayerStagePlace,
} from './multiplayer-place-frame';
import type { MultiplayerPlace, MultiplayerStage } from './multiplayer-places';

type PlayProps = MultiplayerPlaceFrame & {
  readonly title: string;
  /** The seats, the board on the live position and the announcement line. */
  readonly board: JSX.Element;
  readonly game: MultiplayerGameView;
  readonly commands: MultiplayerGameCommands;
  readonly onOpen: (place: MultiplayerPlace) => void;
};

/**
 * Whether the game's commands have anything to offer this person. The
 * moves are stepped through only once play has begun.
 */
export function multiplayerHasCommands(
  game: MultiplayerGameView,
  stage: MultiplayerStage
): boolean {
  return (
    game.leave !== null ||
    game.draw === 'offer' ||
    game.flip !== null ||
    (stage === 'playing' && game.moves !== null)
  );
}

/** The one way to the game's commands, where there are any. */
export function MultiplayerCommandsControl(props: {
  readonly game: MultiplayerGameView;
  readonly stage: MultiplayerStage;
  readonly onOpen: (place: MultiplayerPlace) => void;
}): JSX.Element {
  return (
    <Show when={multiplayerHasCommands(props.game, props.stage)}>
      <Button
        title={<Trans>Game menu</Trans>}
        variant="outline"
        intent="neutral"
        onClick={() => props.onOpen({ screen: 'commands' })}
        dataSet={{ testid: 'multiplayer-open-commands' }}
      />
    </Show>
  );
}

// Each label is short for the eye. A listener, who cannot see which game the
// row belongs to, also hears the rest of the sentence.

/** A draw offered to the person waits for their answer, right under the board. */
function DrawAnswer(props: PlayProps): JSX.Element {
  return (
    <Show when={props.game.draw === 'answer'}>
      <GameActionButton
        operation={props.commands.acceptDraw}
        variant="solid"
        title={
          <Trans>
            Accept<VisuallyHidden> the multiplayer</VisuallyHidden> draw
          </Trans>
        }
        dataSet={{ testid: 'multiplayer-accept-draw' }}
      />
      <GameActionButton
        operation={props.commands.declineDraw}
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

/**
 * The matched game in play, on the live position: the seats, the board,
 * the line that says whose turn it is, an offered draw's answer, and one
 * control that opens the game's commands. The moves played sit beside the
 * board when there is room and under it otherwise; choosing one opens the
 * moves, on that position.
 */
export function MultiplayerPlayView(props: PlayProps): JSX.Element {
  return (
    <MultiplayerStagePlace {...props} title={props.title}>
      <GameSessionLayout
        notices={props.notices}
        actionsBeside
        actions={
          <>
            <DrawAnswer {...props} />
            <MultiplayerCommandsControl
              game={props.game}
              stage={props.stage}
              onOpen={props.onOpen}
            />
          </>
        }
        aside={
          <Show when={props.game.moves}>
            {(moves) => (
              <GameSection title={<Trans>Moves</Trans>}>
                <MultiplayerMoveList
                  moves={moves()}
                  onChoose={(ply) => {
                    props.commands.chooseMove(ply);
                    props.onOpen({ screen: 'moves' });
                  }}
                />
              </GameSection>
            )}
          </Show>
        }
      >
        {props.board}
      </GameSessionLayout>
    </MultiplayerStagePlace>
  );
}

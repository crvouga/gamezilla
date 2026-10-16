import type { MultiplayerGame } from '@libs/game-matchmaking-shared/game-state';
import { isFinished } from '@libs/game-matchmaking-shared/game-state';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { useGamePresentation } from '@pkgs/turn-game-client/turn-games-context';
import { Button } from '@pkgs/ui-root-client/button';
import { GameActions, GameSection } from '@pkgs/ui-root-client/game-section';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  RefreshCwIcon,
} from '@pkgs/ui-root-client/icons';
import { VisuallyHidden } from '@pkgs/ui-root-client/visually-hidden';
import { For, type JSX, Show } from 'solid-js';
import type { MultiplayerMove } from './multiplayer-format';
import { MultiplayerGameRecord } from './multiplayer-game-record';
import type { OwnBoard } from './use-own-board';

type MovesProps = { readonly view: OwnBoard };

/** One move of the list: choosing it shows the position after it. */
function MoveChoice(
  props: MovesProps & { readonly move: MultiplayerMove }
): JSX.Element {
  const shown = () => props.view.shownPly() === props.move.ply;
  return (
    <li class="box flex-row items-center gap-1">
      <Show when={props.move.numbering !== ''}>
        <span class="text textCaption textNumeral">{props.move.numbering}</span>
      </Show>{' '}
      <Button
        title={props.move.san}
        size="sm"
        variant={shown() ? 'solid' : 'ghost'}
        intent="neutral"
        aria-label={t`Show the position after ${props.move.name}`}
        aria-current={shown()}
        onClick={() => props.view.chooseMove(props.move.ply)}
        dataSet={{ testid: `multiplayer-move-${String(props.move.ply)}` }}
      />{' '}
    </li>
  );
}

/** The accepted moves in algebraic notation, each one a position to choose. */
function MoveList(props: MovesProps): JSX.Element {
  return (
    <>
      <ol
        class="box flex-row flex-wrap items-center gap-x-2 gap-y-1"
        aria-label={t`Moves played`}
        data-testid="multiplayer-move-list"
      >
        <For each={props.view.moves()}>
          {(move) => <MoveChoice view={props.view} move={move} />}
        </For>
      </ol>
      <Show when={props.view.moves().length === 0}>
        <p class="text textCaption">
          <Trans>No moves yet.</Trans>
        </p>
      </Show>
    </>
  );
}

// Each label is short for the eye; a listener also hears where it leads.

/** Step through the positions of the game, or go to either end of it. */
function ReviewSteps(props: MovesProps): JSX.Element {
  const atStart = () => props.view.shownPly() === 0;
  const atCurrent = () => props.view.earlier() === null;
  return (
    <>
      <Button
        title={
          <Trans>
            <VisuallyHidden>Go to the </VisuallyHidden>Start
          </Trans>
        }
        icon={ChevronsLeftIcon}
        size="sm"
        variant="outline"
        intent="neutral"
        disabled={atStart()}
        onClick={props.view.goToStart}
        dataSet={{ testid: 'multiplayer-review-start' }}
      />
      <Button
        title={
          <Trans>
            Back<VisuallyHidden> one move</VisuallyHidden>
          </Trans>
        }
        icon={ChevronLeftIcon}
        size="sm"
        variant="outline"
        intent="neutral"
        disabled={atStart()}
        onClick={props.view.stepBack}
        dataSet={{ testid: 'multiplayer-review-back' }}
      />
      <Button
        title={
          <Trans>
            Forward<VisuallyHidden> one move</VisuallyHidden>
          </Trans>
        }
        icon={ChevronRightIcon}
        size="sm"
        variant="outline"
        intent="neutral"
        disabled={atCurrent()}
        onClick={props.view.stepForward}
        dataSet={{ testid: 'multiplayer-review-forward' }}
      />
      <Button
        title={
          <Trans>
            <VisuallyHidden>Return to the </VisuallyHidden>Current
            <VisuallyHidden> position</VisuallyHidden>
          </Trans>
        }
        icon={ChevronsRightIcon}
        size="sm"
        variant="outline"
        intent="neutral"
        disabled={atCurrent()}
        onClick={props.view.returnToCurrent}
        dataSet={{ testid: 'multiplayer-review-current' }}
      />
    </>
  );
}

/** Turn the person's own board around, and back the same way. */
function FlipBoard(props: MovesProps): JSX.Element {
  return (
    <Button
      title={<Trans>Flip board</Trans>}
      icon={RefreshCwIcon}
      size="sm"
      variant="ghost"
      intent="neutral"
      aria-pressed={props.view.flipped()}
      onClick={props.view.flip}
      dataSet={{ testid: 'multiplayer-flip-board' }}
    />
  );
}

/**
 * The moves of the game and what a person can do with their own board:
 * review any earlier position, and flip the board. With the keyboard, the
 * left and right arrows step through the moves while this region has focus.
 */
export function MultiplayerMoves(props: {
  readonly game: MultiplayerGame;
  readonly view: OwnBoard;
}): JSX.Element {
  const presentation = useGamePresentation();
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') props.view.stepBack();
    else props.view.stepForward();
  };
  return (
    <GameSection
      title={<Trans>Moves</Trans>}
      footer={
        isFinished(props.game.outcome) ? (
          <MultiplayerGameRecord game={props.game} />
        ) : undefined
      }
    >
      <div
        class="box gap-4"
        role="group"
        tabIndex={0}
        aria-label={t`Moves. The left and right arrow keys step through them.`}
        onKeyDown={onKeyDown}
        data-testid="multiplayer-moves"
      >
        <MoveList view={props.view} />
        <GameActions>
          <ReviewSteps view={props.view} />
          <Show when={presentation(props.game.fen).canFlip}>
            <FlipBoard view={props.view} />
          </Show>
        </GameActions>
      </div>
    </GameSection>
  );
}

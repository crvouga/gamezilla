import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import { isFinished } from '@libs/game-matchmaking-shared-ts/game-state';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import {
  useGamePresentation,
  useTurnGames,
} from '@pkgs/turn-game-client-ts/turn-games-context';
import { ArrowKeyGroup } from '@pkgs/ui-root-client-ts/arrow-key-group';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameActions, GameSection } from '@pkgs/ui-root-client-ts/game-section';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  RefreshCwIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { ListEntry, OrderedList } from '@pkgs/ui-root-client-ts/semantic-list';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
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
    <ListEntry>
      <StackHorizontal align="center" gap="xs">
        <Show when={props.move.numbering !== ''}>
          <Text variant="caption" numeral>
            {props.move.numbering}
          </Text>
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
      </StackHorizontal>
    </ListEntry>
  );
}

/** The accepted moves in algebraic notation, each one a position to choose. */
function MoveList(props: MovesProps): JSX.Element {
  return (
    <>
      <StackHorizontal wrap align="center" gap="sm">
        <OrderedList
          aria-label={t`Moves played`}
          testId="multiplayer-move-list"
        >
          <For each={props.view.moves()}>
            {(move) => <MoveChoice view={props.view} move={move} />}
          </For>
        </OrderedList>
      </StackHorizontal>
      <Show when={props.view.moves().length === 0}>
        <P variant="caption" tone="secondary">
          <Trans>No moves yet.</Trans>
        </P>
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
  const rules = useTurnGames();
  const hasTurns = () => rules.turnsForPosition(props.game.fen) !== undefined;
  return (
    <Show when={hasTurns() || isFinished(props.game.outcome)}>
      <GameSection
        title={hasTurns() ? <Trans>Moves</Trans> : <Trans>Game record</Trans>}
        footer={
          isFinished(props.game.outcome) ? (
            <MultiplayerGameRecord game={props.game} />
          ) : undefined
        }
      >
        <Show when={hasTurns()}>
          <ArrowKeyGroup
            aria-label={t`Moves. The left and right arrow keys step through them.`}
            onPrevious={props.view.stepBack}
            onNext={props.view.stepForward}
            testId="multiplayer-moves"
          >
            <MoveList view={props.view} />
            <GameActions>
              <ReviewSteps view={props.view} />
              <Show when={presentation(props.game.fen).canFlip}>
                <FlipBoard view={props.view} />
              </Show>
            </GameActions>
          </ArrowKeyGroup>
        </Show>
      </GameSection>
    </Show>
  );
}

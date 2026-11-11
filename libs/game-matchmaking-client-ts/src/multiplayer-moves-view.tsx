import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { ArrowKeyGroup } from '@pkgs/ui-root-client-ts/arrow-key-group';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { CopyToClipboardField } from '@pkgs/ui-root-client-ts/copy-to-clipboard-field';
import { GameActions, GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  HistoryIcon,
  RefreshCwIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import { type JSX, Show } from 'solid-js';
import type {
  MultiplayerGameCommands,
  MultiplayerGameView,
  MultiplayerMovesShown,
  MultiplayerRecordView,
} from './multiplayer-game-view';
import { MultiplayerMoveList } from './multiplayer-move-list';
import {
  type MultiplayerPlaceFrame,
  MultiplayerStagePlace,
} from './multiplayer-place-frame';

type MovesProps = MultiplayerPlaceFrame & {
  readonly title: string;
  /** The seats around the board on the position chosen here. */
  readonly board: JSX.Element;
  /** The line that says where the game stands. */
  readonly status: JSX.Element;
  readonly game: MultiplayerGameView;
  readonly commands: MultiplayerGameCommands;
};

type StepsProps = {
  readonly moves: MultiplayerMovesShown;
  readonly commands: MultiplayerGameCommands;
};

/**
 * Says the board shows an earlier position, and which: it is for reviewing
 * only, and one step returns to the game as it really stands. A listener
 * hears it when it appears and whenever the position changes.
 */
function Reviewing(props: StepsProps): JSX.Element {
  return (
    <Show when={props.moves.reviewing}>
      {(reviewing) => (
        <Notice
          icon={HistoryIcon}
          dataSet={{ testid: 'multiplayer-reviewing' }}
        >
          <StackVertical align="start" gap="sm">
            <Text variant="inherit" role="status">
              <Show
                when={reviewing().after}
                fallback={
                  <Trans>
                    You are reviewing an earlier position, at the start of the
                    game. No piece can be moved on it.
                  </Trans>
                }
              >
                {(move) => (
                  <Trans>
                    You are reviewing an earlier position, after {move()}. No
                    piece can be moved on it.
                  </Trans>
                )}
              </Show>
            </Text>
            <Button
              title={<Trans>Return to current position</Trans>}
              size="sm"
              variant="outline"
              intent="neutral"
              onClick={props.commands.returnToCurrent}
              dataSet={{ testid: 'multiplayer-return-to-current' }}
            />
          </StackVertical>
        </Notice>
      )}
    </Show>
  );
}

// Each label is short for the eye; a listener also hears where it leads.

/** To either end of the game. */
function ReviewEnds(props: StepsProps): JSX.Element {
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
        disabled={props.moves.shownPly === 0}
        onClick={props.commands.goToStart}
        dataSet={{ testid: 'multiplayer-review-start' }}
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
        disabled={props.moves.reviewing === null}
        onClick={props.commands.returnToCurrent}
        dataSet={{ testid: 'multiplayer-review-current' }}
      />
    </>
  );
}

/** One move back or forward through the positions of the game. */
function ReviewSteps(props: StepsProps): JSX.Element {
  return (
    <>
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
        disabled={props.moves.shownPly === 0}
        onClick={props.commands.stepBack}
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
        disabled={props.moves.reviewing === null}
        onClick={props.commands.stepForward}
        dataSet={{ testid: 'multiplayer-review-forward' }}
      />
    </>
  );
}

/** A game that is over with a result can be kept: its record and final position. */
function GameRecord(props: {
  readonly record: MultiplayerRecordView;
  readonly copy: (text: string) => Promise<void>;
}): JSX.Element {
  return (
    <StackVertical gap="md">
      <CopyToClipboardField
        label={<Trans>Game record</Trans>}
        helperText={t`Copy the complete game record.`}
        copiedLabel={t`Game record copied`}
        value={props.record.record}
        copy={props.copy}
        dataSet={{ testid: 'multiplayer-game-record' }}
        triggerDataSet={{ testid: 'multiplayer-copy-game-record' }}
      />
      <CopyToClipboardField
        label={<Trans>Final position</Trans>}
        copiedLabel={t`Final position copied`}
        value={props.record.finalPosition}
        copy={props.copy}
        dataSet={{ testid: 'multiplayer-final-position' }}
        triggerDataSet={{ testid: 'multiplayer-copy-final-position' }}
      />
    </StackVertical>
  );
}

/**
 * The move list and its steps. With the keyboard, the left and right
 * arrows step through the moves while this region has focus.
 */
function MoveSteps(
  props: StepsProps & { readonly flip: MultiplayerGameView['flip'] }
): JSX.Element {
  return (
    <ArrowKeyGroup
      aria-label={t`Moves. The left and right arrow keys step through them.`}
      onPrevious={props.commands.stepBack}
      onNext={props.commands.stepForward}
      testId="multiplayer-moves"
    >
      <MultiplayerMoveList
        moves={props.moves}
        onChoose={props.commands.chooseMove}
      />
      <GameActions>
        <ReviewEnds {...props} />
        <ReviewSteps {...props} />
        <Show when={props.flip}>
          {(flip) => (
            <Button
              title={<Trans>Flip board</Trans>}
              icon={RefreshCwIcon}
              size="sm"
              variant="ghost"
              intent="neutral"
              aria-pressed={flip().flipped}
              onClick={props.commands.flip}
              dataSet={{ testid: 'multiplayer-flip-board' }}
            />
          )}
        </Show>
      </GameActions>
    </ArrowKeyGroup>
  );
}

/**
 * Stepping through the moves of the matched game on this device's own
 * board: choose a move, step back and forward, go to either end. The board
 * shows the position chosen here and takes no move while it is an earlier
 * one; leaving returns it to the game as it stands. Once the game is over
 * with a result, its record and final position can be copied from here.
 */
export function MultiplayerMovesView(props: MovesProps): JSX.Element {
  return (
    <MultiplayerStagePlace {...props} title={props.title}>
      <GameSessionLayout
        notices={props.notices}
        actionsBeside
        status={
          <>
            {props.status}
            <Show when={props.game.moves}>
              {(moves) => (
                <Reviewing moves={moves()} commands={props.commands} />
              )}
            </Show>
          </>
        }
        aside={
          <GameSection
            title={
              <Show
                when={props.game.moves !== null}
                fallback={<Trans>Game record</Trans>}
              >
                <Trans>Moves</Trans>
              </Show>
            }
            fill
            footer={
              <Show when={props.game.record}>
                {(record) => (
                  <GameRecord record={record()} copy={props.commands.copy} />
                )}
              </Show>
            }
          >
            <Show when={props.game.moves}>
              {(moves) => (
                <MoveSteps
                  moves={moves()}
                  commands={props.commands}
                  flip={props.game.flip}
                />
              )}
            </Show>
          </GameSection>
        }
      >
        {props.board}
      </GameSessionLayout>
    </MultiplayerStagePlace>
  );
}

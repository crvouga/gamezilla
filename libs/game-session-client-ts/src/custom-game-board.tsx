import { t } from '@lingui/core/macro';
import { Plural, Trans } from '@lingui/solid/macro';
import { useTurnGames } from '@pkgs/turn-game-client-ts/turn-games-context';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import { GameActions, GameSection } from '@pkgs/ui-root-client-ts/game-section';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { Select } from '@pkgs/ui-root-client-ts/select';
import { ListEntry, OrderedList } from '@pkgs/ui-root-client-ts/semantic-list';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { createMemo, createSignal, Index, type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { CustomGameError } from './custom-game-error';
import { CustomGameStatus } from './custom-game-status';
import type { FrameBoard } from './game-frame-play';
import { FrameNearSeat, FrameOthers } from './game-frame-seats';
import { frameTable, sameTable } from './game-frame-table';
import type { CustomGameReview } from './use-custom-game-review';
import type { CustomGameScreenModel } from './use-custom-game-screen';

type BoardProps = { model: CustomGameScreenModel; review: CustomGameReview };

/** Step through the moves, or return to the position being played. */
function ReviewSteps(props: BoardProps): JSX.Element {
  return (
    <GameActions>
      <Button
        title={<Trans>Previous move</Trans>}
        icon={ChevronLeftIcon}
        size="sm"
        variant="outline"
        intent="neutral"
        disabled={props.review.displayedPly() === 0}
        onClick={() => props.review.seek(props.review.displayedPly() - 1)}
        dataSet={{ testid: 'custom-game-review-back' }}
      />
      <Button
        title={<Trans>Next move</Trans>}
        icon={ChevronRightIcon}
        size="sm"
        variant="outline"
        intent="neutral"
        disabled={
          props.review.displayedPly() >=
          (props.review.game()?.moves.length ?? 0)
        }
        onClick={() => props.review.seek(props.review.displayedPly() + 1)}
        dataSet={{ testid: 'custom-game-review-forward' }}
      />
      <Button
        title={<Trans>Return to current position</Trans>}
        size="sm"
        variant="ghost"
        onClick={props.review.returnLive}
        dataSet={{ testid: 'custom-game-review-live' }}
      />
    </GameActions>
  );
}

/** Jump straight to a numbered position. */
function ReviewJump(props: BoardProps): JSX.Element {
  const [jump, setJump] = createSignal('0');
  return (
    <StackHorizontal align="end" gap="sm">
      <StackVertical grow>
        <TextInput
          type="number"
          label={<Trans>Move number to review</Trans>}
          value={jump()}
          onChangeText={setJump}
          dataSet={{ testid: 'custom-game-review-ply' }}
        />
      </StackVertical>
      <Button
        title={<Trans>Review position</Trans>}
        variant="outline"
        intent="neutral"
        onClick={() => props.review.seek(Number(jump()))}
        dataSet={{ testid: 'custom-game-review-seek' }}
      />
    </StackHorizontal>
  );
}

/** How many of the latest moves the record lists; earlier ones are reached by number. */
const LISTED_MOVES = 40;

function ReviewMoves(props: BoardProps): JSX.Element {
  const moves = () => props.review.game()?.moves ?? [];
  // The latest moves only: a long game (a Hearts game's every card) would
  // otherwise list hundreds; any earlier one is reached by its number.
  const first = createMemo(() => Math.max(0, moves().length - LISTED_MOVES));
  // Labels compare by value, so a move appended updates one row, not all.
  const labels = createMemo(() =>
    moves()
      .slice(first())
      .map((move) => move.san)
  );
  const earlier = () => first();
  return (
    <Show
      when={moves().length > 0}
      fallback={
        <P variant="caption" tone="secondary">
          <Trans>No moves yet.</Trans>
        </P>
      }
    >
      <Show when={earlier() > 0}>
        <P
          variant="caption"
          tone="secondary"
          dataSet={{ testid: 'custom-game-earlier-moves' }}
        >
          <Plural
            value={earlier()}
            one="# earlier move. Review it by its move number."
            other="# earlier moves. Review any of them by its move number."
          />
        </P>
      </Show>
      <StackHorizontal wrap gap="xs">
        <OrderedList aria-label={t`Moves played`} start={first() + 1}>
          {/* By position and label, not by object: each change parses fresh
              move objects, and a long game would otherwise rebuild its whole
              list on every move. */}
          <Index each={labels()}>
            {(label, index) => (
              <ListEntry>
                <Button
                  title={label()}
                  size="sm"
                  variant={
                    props.review.displayedPly() === first() + index + 1
                      ? 'solid'
                      : 'ghost'
                  }
                  intent="neutral"
                  onClick={() => props.review.seek(first() + index + 1)}
                  dataSet={{
                    testid: `custom-game-review-move-${first() + index + 1}`,
                  }}
                />
              </ListEntry>
            )}
          </Index>
        </OrderedList>
      </StackHorizontal>
    </Show>
  );
}

/** The game's record: its moves, and the earlier games of this space. */
export function CustomGameRecord(props: BoardProps): JSX.Element {
  const rules = useTurnGames();
  const hasTurns = () =>
    rules.turnsForPosition(props.review.fen()) !== undefined;
  const options = createMemo(() => [
    { value: 'live', label: <Trans>Current game</Trans> },
    ...props.model.games().history.map((game, index) => ({
      value: game.id,
      label: <Trans>Earlier game {index + 1}</Trans>,
    })),
  ]);
  return (
    <GameSection
      title={<Trans>Game record</Trans>}
      dataSet={{ component: 'CustomGameReview' }}
    >
      <Show when={props.model.games().history.length > 0}>
        <Select
          label={<Trans>Game record</Trans>}
          options={options()}
          value={props.review.selection()}
          onValueChange={(value) => props.review.select(String(value))}
          dataSet={{ testid: 'custom-game-history' }}
        />
      </Show>
      <Show when={hasTurns()}>
        <ReviewMoves {...props} />
        <ReviewSteps {...props} />
        <ReviewJump {...props} />
      </Show>
      <Show when={props.model.openHistory}>
        <Button
          title={<Trans>History and stats</Trans>}
          onClick={() => props.model.openHistory?.()}
          dataSet={{ testid: 'custom-game-history-stats' }}
        />
      </Show>
      <CustomGameError reason={props.review.error()} />
    </GameSection>
  );
}

/** One public render snapshot, so automated observers never combine different turns. */
function publicBoardState(props: BoardProps, canMove: boolean): string {
  const current = props.model.current();
  return JSON.stringify({
    position: props.review.fen(),
    status: current?.status ?? '',
    turn: current?.turn ?? '',
    outcome: current?.outcome ?? '',
    ply: current?.moves.length ?? 0,
    canMove,
  });
}

/** The board the frame mounted and, under it, the board's own controls. */
function FrameBoardView(props: { board: FrameBoard }): JSX.Element {
  return (
    <Show when={props.board.session()} keyed>
      {(session) => (
        <>
          <Dynamic component={session.Board} />
          <Show when={session.controls}>
            {(controls) => <Dynamic component={controls()} />}
          </Show>
        </>
      )}
    </Show>
  );
}

/**
 * The board and the people around it. Once the game is under way the seats
 * sit around it (the other seats above, the person's own nearest them, the
 * turn between); while it is set up the seats are in the Players section
 * with their choices, and the line about the game is in the status row.
 */
export function CustomGameBoard(
  props: BoardProps & { board: FrameBoard }
): JSX.Element {
  const seated = (): boolean => props.model.current()?.status !== 'configuring';
  // The same table after a move keeps every seat mounted.
  const table = createMemo(
    () => frameTable(props.model.current()?.sides ?? [], props.model.mySide()),
    undefined,
    { equals: sameTable }
  );
  return (
    <GameBoardStage
      dataSet={{
        testid: 'custom-game-public',
        state: publicBoardState(props, props.board.interactive()),
        fen: props.review.fen(),
        status: props.model.current()?.status ?? '',
        turn: props.model.current()?.turn ?? '',
        outcome: props.model.current()?.outcome ?? '',
        ply: String(props.model.current()?.moves.length ?? 0),
        canmove: String(props.board.interactive()),
      }}
      others={
        <Show when={seated()}>
          <FrameOthers
            model={props.model}
            table={table()}
            position={props.board.position()}
          />
        </Show>
      }
      turn={
        <Show when={seated()}>
          <CustomGameStatus model={props.model} />
        </Show>
      }
      own={
        <Show when={seated()}>
          <FrameNearSeat
            model={props.model}
            table={table()}
            position={props.board.position()}
          />
        </Show>
      }
    >
      <FrameBoardView board={props.board} />
      <CustomGameError
        reason={
          props.model.simulation.error()
            ? t`The game stopped. Your last saved score is kept. Reopen the game to try again.`
            : ''
        }
      />
    </GameBoardStage>
  );
}

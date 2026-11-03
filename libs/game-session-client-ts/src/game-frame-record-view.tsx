import { t } from '@lingui/core/macro';
import { Plural, Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
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
import { FrameErrorView } from './game-frame-status-view';
import type { FrameRecord } from './game-frame-view-types';

/** Moving through the record: to a numbered position, back to the live one, or another game. */
export type FrameReviewHandlers = {
  readonly onSeek: (ply: number) => void;
  readonly onReturnLive: () => void;
  readonly onSelectRecord: (selection: string) => void;
  readonly onOpenHistory: () => void;
};

type RecordProps = FrameReviewHandlers & { readonly record: FrameRecord };

/** Step through the moves, or return to the position being played. */
function ReviewSteps(props: RecordProps): JSX.Element {
  return (
    <GameActions>
      <Button
        title={<Trans>Previous move</Trans>}
        icon={ChevronLeftIcon}
        size="sm"
        variant="outline"
        intent="neutral"
        disabled={props.record.displayedPly === 0}
        onClick={() => props.onSeek(props.record.displayedPly - 1)}
        dataSet={{ testid: 'custom-game-review-back' }}
      />
      <Button
        title={<Trans>Next move</Trans>}
        icon={ChevronRightIcon}
        size="sm"
        variant="outline"
        intent="neutral"
        disabled={props.record.displayedPly >= props.record.moves.length}
        onClick={() => props.onSeek(props.record.displayedPly + 1)}
        dataSet={{ testid: 'custom-game-review-forward' }}
      />
      <Button
        title={<Trans>Return to current position</Trans>}
        size="sm"
        variant="ghost"
        onClick={() => props.onReturnLive()}
        dataSet={{ testid: 'custom-game-review-live' }}
      />
    </GameActions>
  );
}

/** Jump straight to a numbered position. */
function ReviewJump(props: RecordProps): JSX.Element {
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
        onClick={() => props.onSeek(Number(jump()))}
        dataSet={{ testid: 'custom-game-review-seek' }}
      />
    </StackHorizontal>
  );
}

/** How many of the latest moves the record lists; earlier ones are reached by number. */
const LISTED_MOVES = 40;

function ReviewMoves(props: RecordProps): JSX.Element {
  // The latest moves only: a long game (a Hearts game's every card) would
  // otherwise list hundreds; any earlier one is reached by its number.
  const first = createMemo(() =>
    Math.max(0, props.record.moves.length - LISTED_MOVES)
  );
  // Labels compare by value, so a move appended updates one row, not all.
  const labels = createMemo(() => props.record.moves.slice(first()));
  return (
    <Show
      when={props.record.moves.length > 0}
      fallback={
        <P variant="caption" tone="secondary">
          <Trans>No moves yet.</Trans>
        </P>
      }
    >
      <Show when={first() > 0}>
        <P
          variant="caption"
          tone="secondary"
          dataSet={{ testid: 'custom-game-earlier-moves' }}
        >
          <Plural
            value={first()}
            one="# earlier move. Review it by its move number."
            other="# earlier moves. Review any of them by its move number."
          />
        </P>
      </Show>
      <StackHorizontal wrap gap="xs">
        <OrderedList aria-label={t`Moves played`} start={first() + 1}>
          {/* By position and label, not by object: a long game would
              otherwise rebuild its whole list on every move. */}
          <Index each={labels()}>
            {(label, index) => (
              <ListEntry>
                <Button
                  title={label()}
                  size="sm"
                  variant={
                    props.record.displayedPly === first() + index + 1
                      ? 'solid'
                      : 'ghost'
                  }
                  intent="neutral"
                  onClick={() => props.onSeek(first() + index + 1)}
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
export function FrameRecordView(props: RecordProps): JSX.Element {
  const options = createMemo(() => [
    { value: 'live', label: <Trans>Current game</Trans> },
    ...props.record.earlier.map((id, index) => ({
      value: id,
      label: <Trans>Earlier game {index + 1}</Trans>,
    })),
  ]);
  return (
    <GameSection
      title={<Trans>Game record</Trans>}
      dataSet={{ component: 'CustomGameReview' }}
    >
      <Show when={props.record.earlier.length > 0}>
        <Select
          label={<Trans>Game record</Trans>}
          options={options()}
          value={props.record.selection}
          onValueChange={(value) => props.onSelectRecord(String(value))}
          dataSet={{ testid: 'custom-game-history' }}
        />
      </Show>
      <Show when={props.record.turns}>
        <ReviewMoves {...props} />
        <ReviewSteps {...props} />
        <ReviewJump {...props} />
      </Show>
      <Show when={props.record.history}>
        <Button
          title={<Trans>History and stats</Trans>}
          onClick={() => props.onOpenHistory()}
          dataSet={{ testid: 'custom-game-history-stats' }}
        />
      </Show>
      <FrameErrorView text={props.record.error} />
    </GameSection>
  );
}

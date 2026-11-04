import { t } from '@lingui/core/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { MoveStrip } from '@pkgs/ui-root-client-ts/move-strip';
import { createScrollTarget } from '@pkgs/ui-root-client-ts/scroll';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { createEffect, createMemo, Index, type JSX } from 'solid-js';
import type { FrameReviewHandlers } from './game-frame-record-view';
import type { FrameRecord } from './game-frame-view-types';

/** How many of the latest moves the strip under the board carries. */
const STRIP_MOVES = 12;

const STEP_SIZE = 32;

/**
 * The latest moves as one row under the board, for a narrow screen whose
 * record sits below the play actions: step back or forward at its ends,
 * or jump to one of the latest moves. The full record, with every move,
 * the move-number field and earlier games, stays below.
 */
export function FrameMoveStripView(
  props: Pick<FrameReviewHandlers, 'onSeek'> & { readonly record: FrameRecord }
): JSX.Element {
  const first = createMemo(() =>
    Math.max(0, props.record.moves.length - STRIP_MOVES)
  );
  const labels = createMemo(() => props.record.moves.slice(first()));
  const shown = (): number => props.record.displayedPly;
  // The shown move stays in view, the latest one while the game is live.
  const current = createScrollTarget();
  createEffect(() => {
    void shown();
    current.scrollIntoView({
      behavior: 'instant',
      inline: 'nearest',
      block: 'nearest',
    });
  });
  return (
    <MoveStrip
      testId="custom-game-move-strip"
      leading={
        <IconButton
          label={t`Previous move`}
          size={STEP_SIZE}
          disabled={shown() === 0}
          onClick={() => props.onSeek(shown() - 1)}
        >
          <ChevronLeftIcon />
        </IconButton>
      }
      trailing={
        <IconButton
          label={t`Next move`}
          size={STEP_SIZE}
          disabled={shown() >= props.record.moves.length}
          onClick={() => props.onSeek(shown() + 1)}
        >
          <ChevronRightIcon />
        </IconButton>
      }
    >
      <Index each={labels()}>
        {(label, index) => (
          <StackHorizontal
            scrollTarget={
              shown() === first() + index + 1 ? current.target : undefined
            }
          >
            <Button
              title={label()}
              size="sm"
              variant={shown() === first() + index + 1 ? 'solid' : 'ghost'}
              intent="neutral"
              aria-label={t`Move ${first() + index + 1}: ${label()}`}
              onClick={() => props.onSeek(first() + index + 1)}
            />
          </StackHorizontal>
        )}
      </Index>
    </MoveStrip>
  );
}

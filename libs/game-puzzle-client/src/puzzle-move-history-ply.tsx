import type { PuzzleHistoryPly } from '@libs/game-puzzle-shared/move-history';
import { type JSX, Show } from 'solid-js';
import { PUZZLE_TEST_ENABLED } from './puzzle-test-enabled';
import type { PuzzleMoveWriting } from './use-puzzle-notation';

type HistoryPlyChipProps = {
  ply: PuzzleHistoryPly;
  selected: boolean;
  interactive: boolean;
  writing: PuzzleMoveWriting;
  onSeek: (solveIdx: number) => void;
};

function MoveNumberLabel(props: { label: string }): JSX.Element {
  return <p class="text textCaption textNumeral pr-1">{props.label}</p>;
}

function HistoryPlyChip(props: HistoryPlyChipProps): JSX.Element {
  const handlePress = (): void => {
    props.onSeek(props.ply.solveIdxAfter);
  };
  return (
    <button
      class="clickable px-2 py-0.5 rounded-sm"
      classList={{ 'bg-success-surface': props.selected }}
      data-testid={`chess-puzzle-move-ply-${props.ply.plyIndex}`}
      type="button"
      disabled={!props.interactive || props.selected}
      onClick={handlePress}
      role="button"
      aria-pressed={props.selected}
      aria-label={props.ply.label}
    >
      <code
        class="text textLabel textNumeral"
        classList={{ 'text-success': props.selected }}
      >
        {props.writing.format(props.ply.label)}
      </code>
    </button>
  );
}

/**
 * Test-only marker on whichever chip the move list is highlighting, rendered
 * from the same `selected` branch as the highlight itself — so a scenario
 * asserts the §7 "current move highlighted" rule, not a parallel signal.
 */
function SelectedPlyProbe(props: {
  ply: PuzzleHistoryPly;
  selected: boolean;
}): JSX.Element {
  if (!PUZZLE_TEST_ENABLED) return <></>;
  return (
    <Show when={props.selected}>
      <span class="sr-only" data-testid="chess-puzzle-move-ply-selected">
        {`${props.ply.plyIndex}|${props.ply.label}`}
      </span>
    </Show>
  );
}

export function HistoryPlyCluster(props: {
  ply: PuzzleHistoryPly;
  selectedSolveIdx: number;
  interactive: boolean;
  writing: PuzzleMoveWriting;
  onSeek: (solveIdx: number) => void;
  selectedRef?: (el: HTMLElement) => void;
}): JSX.Element {
  const prefix = props.writing.moveNumber(props.ply.before, props.ply.plyIndex);
  return (
    <div
      class="box flex-row items-center gap-1 shrink-0 grow-0"
      ref={props.selectedRef}
    >
      {prefix !== null ? <MoveNumberLabel label={prefix} /> : null}
      <HistoryPlyChip
        ply={props.ply}
        selected={props.ply.solveIdxAfter === props.selectedSolveIdx}
        interactive={props.interactive}
        writing={props.writing}
        onSeek={props.onSeek}
      />
      <SelectedPlyProbe
        ply={props.ply}
        selected={props.ply.solveIdxAfter === props.selectedSolveIdx}
      />
    </div>
  );
}

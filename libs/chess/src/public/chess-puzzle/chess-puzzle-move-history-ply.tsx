import type { JSX } from 'solid-js';

import type { PuzzleHistoryPly } from '../chess-puzzle-move-history';

type HistoryPlyChipProps = {
  ply: PuzzleHistoryPly;
  selected: boolean;
  interactive: boolean;
  onSeek: (solveIdx: number) => void;
};

function MoveNumberLabel(props: {
  moveNumber: number;
  ellipsis: boolean;
}): JSX.Element {
  const label = props.ellipsis
    ? `${props.moveNumber}...`
    : `${props.moveNumber}.`;
  return (
    <p class="text textCaption text-text-secondary font-semibold pr-1">
      {label}
    </p>
  );
}

export function moveNumberPrefix(
  ply: PuzzleHistoryPly
): { moveNumber: number; ellipsis: boolean } | null {
  if (ply.color === 'w') {
    return { moveNumber: ply.moveNumber, ellipsis: false };
  }
  if (ply.plyIndex === 0) {
    return { moveNumber: ply.moveNumber, ellipsis: true };
  }
  return null;
}

function HistoryPlyChip(props: HistoryPlyChipProps): JSX.Element {
  const handlePress = (): void => {
    props.onSeek(props.ply.solveIdxAfter);
  };
  return (
    <button
      class="clickable px-1.5 py-0.5 rounded-xs"
      style={{ background: props.selected ? 'successSurface' : 'transparent' }}
      data-testid={`chess-puzzle-move-ply-${props.ply.plyIndex}`}
      type="button"
      disabled={!props.interactive || props.selected}
      onClick={handlePress}
      role="button"
      aria-pressed={props.selected}
      aria-label={props.ply.san}
    >
      <code
        class="text textMono"
        style={{
          color: props.selected ? 'success' : 'text',
          'font-weight': props.selected ? '700' : '600',
        }}
      >
        {props.ply.san}
      </code>
    </button>
  );
}

export function HistoryPlyCluster(props: {
  ply: PuzzleHistoryPly;
  selectedSolveIdx: number;
  interactive: boolean;
  onSeek: (solveIdx: number) => void;
  selectedRef?: (el: HTMLElement) => void;
}): JSX.Element {
  const prefix = moveNumberPrefix(props.ply);
  return (
    <div
      class="box flex-row items-center gap-1 shrink-0 grow-0"
      ref={props.selectedRef}
    >
      {prefix !== null ? (
        <MoveNumberLabel
          moveNumber={prefix.moveNumber}
          ellipsis={prefix.ellipsis}
        />
      ) : null}
      <HistoryPlyChip
        ply={props.ply}
        selected={props.ply.solveIdxAfter === props.selectedSolveIdx}
        interactive={props.interactive}
        onSeek={props.onSeek}
      />
    </div>
  );
}

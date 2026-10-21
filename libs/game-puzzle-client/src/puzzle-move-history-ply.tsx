import type { PuzzleHistoryPly } from '@libs/game-puzzle-shared/move-history';
import { Pressable } from '@pkgs/ui-root-client/pressable';
import type { ScrollTarget } from '@pkgs/ui-root-client/scroll';
import { StackHorizontal } from '@pkgs/ui-root-client/stack';
import { Surface } from '@pkgs/ui-root-client/surface';
import { Code, P } from '@pkgs/ui-root-client/text';
import { VisuallyHidden } from '@pkgs/ui-root-client/visually-hidden';
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
  return (
    <P variant="caption" numeral>
      {props.label}
    </P>
  );
}

function HistoryPlyChip(props: HistoryPlyChipProps): JSX.Element {
  // The current move is already shown: pressing it again does nothing.
  const handlePress = (): void => {
    if (props.selected) return;
    props.onSeek(props.ply.solveIdxAfter);
  };
  return (
    <Pressable
      radius="sm"
      tint={!props.selected}
      testId={`chess-puzzle-move-ply-${props.ply.plyIndex}`}
      disabled={!props.interactive}
      onPress={handlePress}
      pressed={props.selected}
      aria-label={props.ply.label}
    >
      <Surface
        tone={props.selected ? 'success' : 'transparent'}
        radius="sm"
        paddingX="sm"
      >
        <Code
          variant="label"
          numeral
          tone={props.selected ? 'success' : undefined}
        >
          {props.writing.format(props.ply.label)}
        </Code>
      </Surface>
    </Pressable>
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
      <VisuallyHidden testId="chess-puzzle-move-ply-selected">
        {`${props.ply.plyIndex}|${props.ply.label}`}
      </VisuallyHidden>
    </Show>
  );
}

export function HistoryPlyCluster(props: {
  ply: PuzzleHistoryPly;
  selectedSolveIdx: number;
  interactive: boolean;
  writing: PuzzleMoveWriting;
  onSeek: (solveIdx: number) => void;
  /** The move list's scroll target, given to the cluster it should reveal. */
  scrollTarget?: ScrollTarget | undefined;
}): JSX.Element {
  const prefix = props.writing.moveNumber(props.ply.before, props.ply.plyIndex);
  return (
    <StackHorizontal align="center" gap="xs" scrollTarget={props.scrollTarget}>
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
    </StackHorizontal>
  );
}

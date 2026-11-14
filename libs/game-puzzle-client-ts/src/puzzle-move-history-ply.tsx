import type { PuzzleHistoryPly } from '@libs/game-puzzle-shared-ts/move-history';
import { Pressable } from '@pkgs/ui-root-client-ts/pressable';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import { Code, Text } from '@pkgs/ui-root-client-ts/text';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import { createMemo, For, type JSX, Show } from 'solid-js';
import { PUZZLE_TEST_ENABLED } from './puzzle-test-enabled';
import type { PuzzleMoveWriting } from './use-puzzle-notation';

type HistoryPlyChipProps = {
  ply: PuzzleHistoryPly;
  /** The move's number (`4.`, `4…`), or null when the turn needs none. */
  prefix: string | null;
  selected: boolean;
  interactive: boolean;
  writing: PuzzleMoveWriting;
  onSeek: (solveIdx: number) => void;
};

/**
 * The move's number inside its chip, quiet beside the move, so a reply
 * numbered on its own (`4…`) reads as one move, `4… g6`, never as a cut-off
 * label beside it.
 */
function MoveNumberLabel(props: { label: string }): JSX.Element {
  return (
    <Text variant="label" tone="secondary" numeral>
      {`${props.label}\u00a0`}
    </Text>
  );
}

/** The move as it reads: its number, quiet, then the move. */
function PlyFace(
  props: HistoryPlyChipProps & { testId?: string }
): JSX.Element {
  return (
    // The move on the board is what is chosen, in the selection's blue,
    // never the green that says a move was correct.
    <Surface
      tone={props.selected ? 'tint-subtle' : 'transparent'}
      radius="sm"
      paddingX="sm"
      direction="horizontal"
      align="baseline"
      testId={props.testId}
    >
      {props.prefix !== null ? <MoveNumberLabel label={props.prefix} /> : null}
      <Code variant="label" numeral tone={props.selected ? 'tint' : undefined}>
        {props.writing.format(props.ply.label)}
      </Code>
    </Surface>
  );
}

function HistoryPlyChip(props: HistoryPlyChipProps): JSX.Element {
  // The current move is already shown: pressing it again does nothing.
  const handlePress = (): void => {
    if (props.selected) return;
    props.onSeek(props.ply.solveIdxAfter);
  };
  const testId = (): string => `chess-puzzle-move-ply-${props.ply.plyIndex}`;
  // A strip that is read, not pressed, shows its moves at full strength:
  // a disabled control's fade would make the line look unavailable.
  return (
    <Show
      when={props.interactive}
      fallback={<PlyFace {...props} testId={testId()} />}
    >
      <Pressable
        radius="sm"
        tint={!props.selected}
        testId={testId()}
        onPress={handlePress}
        pressed={props.selected}
        aria-label={
          props.prefix === null
            ? props.ply.label
            : `${props.prefix} ${props.ply.label}`
        }
      >
        <PlyFace {...props} />
      </Pressable>
    </Show>
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
}): JSX.Element {
  const prefix = props.writing.moveNumber(props.ply.before, props.ply.plyIndex);
  return (
    <StackHorizontal align="center" gap="xs">
      <HistoryPlyChip
        ply={props.ply}
        prefix={prefix}
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

/**
 * The line's moves in numbered pairs (`5. Nxe5 Bxd1`), each pair one
 * unbroken group: a strip that wraps breaks between pairs, never leaving a
 * reply alone at the start of a row. A game that numbers no move groups
 * each move on its own.
 */
export function HistoryPlyPairs(props: {
  plies: readonly PuzzleHistoryPly[];
  selectedSolveIdx: number;
  interactive: boolean;
  writing: PuzzleMoveWriting;
  onSeek: (solveIdx: number) => void;
}): JSX.Element {
  const pairs = createMemo(() => {
    const numbered = (ply: PuzzleHistoryPly): boolean =>
      props.writing.moveNumber(ply.before, ply.plyIndex) !== null;
    const pairing = props.plies.some(numbered);
    const out: PuzzleHistoryPly[][] = [];
    for (const ply of props.plies) {
      const last = out.at(-1);
      if (!pairing || numbered(ply) || last === undefined) out.push([ply]);
      else last.push(ply);
    }
    return out;
  });
  return (
    <For each={pairs()}>
      {(pair) => (
        <StackHorizontal align="center" gap="xs" wrap={false}>
          <For each={pair}>
            {(ply) => (
              <HistoryPlyCluster
                ply={ply}
                selectedSolveIdx={props.selectedSolveIdx}
                interactive={props.interactive}
                writing={props.writing}
                onSeek={props.onSeek}
              />
            )}
          </For>
        </StackHorizontal>
      )}
    </For>
  );
}

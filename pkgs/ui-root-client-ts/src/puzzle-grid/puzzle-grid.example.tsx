import type { JSX } from '@solidjs/web';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { PuzzleGrid, type PuzzleGridTile } from './index';

/** `count` numbered tiles: the first `solved` solved, the next one current. */
export function sequenceTiles(
  count: number,
  solved: number,
  onPress: (number: number) => void = () => undefined
): PuzzleGridTile[] {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const state =
      index < solved ? 'solved' : index === solved ? 'current' : 'open';
    return {
      key: `puzzle-${number}`,
      number,
      label: `Dock ${String(number).padStart(2, '0')}, ${
        state === 'solved'
          ? 'solved'
          : state === 'current'
            ? 'next'
            : 'unplayed'
      }`,
      state,
      onPress: () => onPress(number),
      dataSet: { testid: `example-puzzle-${number}` },
    } satisfies PuzzleGridTile;
  });
}

/** A pack of thirty with three solved and the fourth next. */
export default function PuzzleGridExample(): JSX.Element {
  return (
    <ExampleRoot>
      <PuzzleGrid
        label="Puzzles in Warehouse basics"
        tiles={sequenceTiles(30, 3)}
      />
    </ExampleRoot>
  );
}

/** @jsxImportSource solid-js */

import { TileRack, type TileRackTile } from '@pkgs/ui-root-client-ts/tile-rack';
import {
  WordTileBoard,
  type WordTileBoardCell,
  type WordTileSquare,
} from '@pkgs/ui-root-client-ts/word-tile-board';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

const COLUMNS = ['a', 'b', 'c', 'd', 'e'];
const ROWS = ['1', '2', '3', '4', '5'];
const SQUARES: Readonly<Record<number, WordTileSquare>> = {
  0: 'TW',
  6: 'DL',
  8: 'TL',
  12: 'start',
  18: 'DW',
};
const SQUARE_TEXT: Readonly<Record<WordTileSquare, string>> = {
  DL: '2L',
  TL: '3L',
  DW: '2W',
  TW: '3W',
  start: '★',
};
const WORD: Readonly<Record<number, string>> = { 11: 'C', 12: 'A', 13: 'T' };

function stateOf(
  index: number,
  tentative: ReadonlySet<number>
): WordTileBoardCell['state'] {
  if (WORD[index] !== undefined) return index === 13 ? 'recent' : 'committed';
  return tentative.has(index) ? 'tentative' : 'empty';
}

function labelOf(index: number, id: string, letter: string): string {
  const square = SQUARES[index] ?? null;
  if (letter !== '')
    return `${letter} 1, ${id}${WORD[index] === undefined ? ', tentative' : ''}`;
  return `${square === null ? '' : `${SQUARE_TEXT[square]}, `}${id}, empty`;
}

function cells(tentative: ReadonlySet<number>): readonly WordTileBoardCell[] {
  return Array.from({ length: 25 }, (_, index) => {
    const id = `${COLUMNS[index % 5]}${ROWS[Math.floor(index / 5)]}`;
    const committed = WORD[index];
    const letter = committed ?? (tentative.has(index) ? 'S' : '');
    const square = SQUARES[index] ?? null;
    return {
      id,
      letter,
      points: letter === '' ? null : 1,
      square,
      state: stateOf(index, tentative),
      label: labelOf(index, id, letter),
      enabled: committed === undefined,
    };
  });
}

/** A small board with a word on it and a rack placing tentative tiles. */
export default function WordTileBoardExample(): JSX.Element {
  const [tentative, setTentative] = createSignal<ReadonlySet<number>>(
    new Set()
  );
  const [selected, setSelected] = createSignal<string | null>(null);
  const rack = (): readonly TileRackTile[] =>
    ['S', 'E', 'A'].map((letter, n) => ({
      id: String(n),
      letter,
      points: 1,
      selected: selected() === String(n),
      placed: n === 0 && tentative().size > 0,
      label: `${letter}, 1 point`,
      enabled: true,
    }));
  return (
    <ExampleRoot>
      <WordTileBoard
        label="Example word board"
        testId="example-word-board"
        columnLabels={COLUMNS}
        rowLabels={ROWS}
        cells={cells(tentative())}
        squareText={(square) => SQUARE_TEXT[square]}
        onActivate={(id) => {
          const index = cells(new Set()).findIndex((c) => c.id === id);
          if (selected() === '0') setTentative(new Set([index]));
          setSelected(null);
        }}
      />
      <TileRack
        label="Example rack"
        testId="example-rack"
        tiles={rack()}
        onActivate={(id) => setSelected((s) => (s === id ? null : id))}
      />
    </ExampleRoot>
  );
}

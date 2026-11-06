/** @jsxImportSource solid-js */

import {
  CellGridBoard,
  type CellGridCell,
} from '@pkgs/ui-root-client-ts/cell-grid-board';
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];
/** Draughts men on the dark squares: dark at the top, light at the bottom. */
const MEN = [
  '.d.d.d.d',
  'd.d.d.d.',
  '.d.h.d.d',
  '..r.....',
  '........',
  'l.l.l.l.',
  '.l.l.l.l',
  'l.l.l.l.',
].join('');

type Square = Pick<CellGridCell, 'glyph' | 'tone' | 'emphasis' | 'identity'> & {
  readonly word: string;
};

const EMPTY: Square = {
  glyph: '',
  tone: 'open',
  emphasis: 'none',
  word: 'empty',
};
/** What each mark in `MEN` puts on its square. */
const SQUARES: Readonly<Record<string, Square>> = {
  d: { glyph: '●', tone: 'occupied', identity: 'two', word: 'dark man' },
  l: { glyph: '●', tone: 'occupied', identity: 'one', word: 'light man' },
  h: {
    glyph: '●',
    tone: 'occupied',
    identity: 'two',
    emphasis: 'pending',
    word: 'dark man, hint',
  },
  r: {
    glyph: '',
    tone: 'critical',
    emphasis: 'refused',
    word: 'refused move',
  },
};

function cells(): readonly CellGridCell[] {
  return MEN.split('').map((mark, index): CellGridCell => {
    const id = `${FILES[index % 8]}${RANKS[Math.floor(index / 8)]}`;
    const square = SQUARES[mark] ?? EMPTY;
    return {
      id,
      glyph: square.glyph,
      label: `${id}: ${square.word}`,
      tone: square.tone,
      emphasis: square.emphasis,
      identity: square.identity,
      enabled: square.identity !== undefined,
    };
  });
}

/** A checkered board with light and dark pieces, a hinted piece and a refused square. */
export default function CheckeredBoardExample(): JSX.Element {
  return (
    <ExampleRoot>
      <CellGridBoard
        boardTheme="checkered"
        label="Draughts board"
        testId="example-checkered"
        columnLabels={FILES}
        rowLabels={RANKS}
        cells={cells()}
      />
    </ExampleRoot>
  );
}

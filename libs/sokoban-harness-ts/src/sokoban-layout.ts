import {
  decodeSokobanBoard,
  encodeSokobanBoard,
  sokobanBoardRows,
} from '@libs/sokoban-shared-ts/sokoban-definition';
import type { SokobanBoard } from '@libs/sokoban-shared-ts/sokoban-types';

/** A board as the specifications lay it out: a header row, then one row per board row. */
export type LayoutTable = readonly (readonly string[])[];

const SYMBOLS: Readonly<Record<string, string>> = {
  wall: '#',
  floor: ' ',
  goal: '.',
  outside: '~',
  worker: '@',
  'worker on goal': '+',
  crate: '$',
  'crate on goal': '*',
};
const WORDS = Object.fromEntries(
  Object.entries(SYMBOLS).map(([word, symbol]) => [symbol, word])
);

/** The canonical definition of the board a table lays out. */
export function layoutDefinition(table: LayoutTable): string {
  const rows = table.slice(1).map((row) =>
    row
      .slice(1)
      .map((word) => {
        const symbol = SYMBOLS[word.trim()];
        if (symbol === undefined) throw new Error(`Unknown square: ${word}`);
        return symbol;
      })
      .join('')
  );
  const board = decodeSokobanBoard(JSON.stringify({ format: 1, rows }));
  if (!board.valid)
    throw new Error(`Unreadable layout: ${JSON.stringify(board.issues)}`);
  return encodeSokobanBoard(board.value);
}

export function layoutBoard(table: LayoutTable): SokobanBoard {
  const board = decodeSokobanBoard(layoutDefinition(table));
  if (!board.valid) throw new Error('Unreadable layout');
  return board.value;
}

/** The board's squares as the specifications name them, row by row. */
export function boardWords(definition: string): readonly (readonly string[])[] {
  const board = decodeSokobanBoard(definition);
  if (!board.valid) return [];
  return sokobanBoardRows(board.value).map((row) =>
    [...row].map((symbol) => WORDS[symbol] ?? symbol)
  );
}

export function tableWords(table: LayoutTable): readonly (readonly string[])[] {
  return table.slice(1).map((row) => row.slice(1).map((word) => word.trim()));
}

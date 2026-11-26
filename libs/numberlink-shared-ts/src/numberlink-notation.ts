import {
  formatNotationRecord,
  type NumberlinkRecord,
  parseNotationRecords,
} from './numberlink-notation-records';
import type { Cell, NumberlinkIssue, Validation } from './numberlink-types';

/**
 * NL1: one self-contained ASCII line per Numberlink board, read like a
 * chess FEN; grammar, bounds, extension records and a worked example are in
 * `docs/NUMBERLINK_NOTATION.md`. Every board has exactly one spelling.
 *
 *   notation = "NL1:" row 1*("/" row) *(";" record)
 *   row      = 1*(run / endpoint)   ; run: 1-20 empty cells; endpoint: A-Z, a-z
 *   record   = key "=" value        ; each key once, written in ASCII order
 */
export const NUMBERLINK_NOTATION_VERSION = 'NL1';
export const PAIR_LETTERS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const MAX_LENGTH = 2048;
const MIN_SIZE = 2;
const MAX_SIZE = 20;

/** A pair named by its letter, endpoints in reading order. */
export type NotationPair = {
  readonly letter: string;
  readonly endpoints: readonly [Cell, Cell];
};

export type NumberlinkNotation = {
  readonly width: number;
  readonly height: number;
  /** In letter order, which is the reading order of each pair's first endpoint. */
  readonly pairs: readonly NotationPair[];
  readonly records: readonly NumberlinkRecord[];
};

type Refusal = { readonly valid: false; readonly issues: NumberlinkIssue[] };

function refuse(code: string, message: string): Refusal {
  return { valid: false, issues: [{ code, message }] };
}

/** Text in a versioned Numberlink notation rather than a JSON definition. */
export function isNumberlinkNotation(text: string): boolean {
  return text.startsWith('NL');
}

type Row = { readonly width: number; readonly letters: [string, number][] };

function readRun(text: string, start: number): number {
  let end = start;
  while (end < text.length && text[end]! >= '0' && text[end]! <= '9') end++;
  return end;
}

function parseRow(text: string, row: number): Validation<Row> {
  const letters: [string, number][] = [];
  let x = 0;
  let index = 0;
  while (index < text.length) {
    const char = text[index]!;
    if (char >= '1' && char <= '9') {
      const end = readRun(text, index);
      x += Number(text.slice(index, end));
      index = end;
    } else if (PAIR_LETTERS.includes(char)) {
      letters.push([char, x]);
      x += 1;
      index += 1;
    } else
      return refuse(
        'notation_syntax',
        `Row ${row + 1}: "${char}" is not a cell. Write empty runs as 1 to 20 and endpoints as letters.`
      );
    if (x > MAX_SIZE)
      return refuse(
        'notation_bounds',
        `Row ${row + 1} is wider than ${MAX_SIZE} cells.`
      );
  }
  return { valid: true, value: { width: x, letters } };
}

function parseRows(texts: readonly string[]): Validation<Row[]> {
  if (texts.length < MIN_SIZE || texts.length > MAX_SIZE)
    return refuse(
      'notation_bounds',
      `Use ${MIN_SIZE} to ${MAX_SIZE} rows, not ${texts.length}.`
    );
  const rows: Row[] = [];
  for (const [index, text] of texts.entries()) {
    const row = parseRow(text, index);
    if (!row.valid) return row;
    const width = rows[0]?.width ?? row.value.width;
    if (row.value.width < MIN_SIZE || row.value.width !== width)
      return refuse(
        'notation_bounds',
        `Row ${index + 1} is ${row.value.width} cells wide; every row needs the same width, from ${MIN_SIZE} to ${MAX_SIZE} cells.`
      );
    rows.push(row.value);
  }
  return { valid: true, value: rows };
}

/** Each letter twice, first met in alphabet order, so the names carry no choice. */
function pairsOf(rows: readonly Row[]): Validation<NotationPair[]> {
  const found = new Map<string, Cell[]>();
  for (const [y, row] of rows.entries())
    for (const [letter, x] of row.letters) {
      const cells = found.get(letter);
      if (cells === undefined) {
        const expected = PAIR_LETTERS[found.size];
        if (letter !== expected)
          return refuse(
            'notation_pairs',
            `Name pairs in reading order: the next new pair is ${expected}, not ${letter}.`
          );
        found.set(letter, [{ x, y }]);
      } else cells.push({ x, y });
    }
  const pairs: NotationPair[] = [];
  for (const [letter, cells] of found) {
    if (cells.length !== 2)
      return refuse(
        'notation_pairs',
        `Pair ${letter} needs exactly two endpoints, not ${cells.length}.`
      );
    pairs.push({ letter, endpoints: [cells[0]!, cells[1]!] });
  }
  if (pairs.length === 0)
    return refuse('notation_pairs', 'Place at least one pair of endpoints.');
  return { valid: true, value: pairs };
}

function versionOf(text: string): Validation<string> {
  const match = /^NL(\d{1,4}):/.exec(text);
  if (match === null)
    return refuse(
      'notation_syntax',
      'Start the notation with NL1: followed by the rows.'
    );
  if (match[0] !== `${NUMBERLINK_NOTATION_VERSION}:`)
    return refuse(
      'notation_version',
      'This puzzle was written for a newer version of Numberlink. Update the app or choose another puzzle.'
    );
  return { valid: true, value: text.slice(match[0].length) };
}

/** Reads untrusted text; never throws, and refuses anything outside the grammar or its bounds. */
export function parseNumberlinkNotation(
  text: string
): Validation<NumberlinkNotation> {
  if (typeof text !== 'string' || text.length > MAX_LENGTH)
    return refuse(
      'notation_bounds',
      `Keep the notation within ${MAX_LENGTH} characters.`
    );
  const body = versionOf(text);
  if (!body.valid) return body;
  const [board = '', ...recordTexts] = body.value.split(';');
  const rows = parseRows(board.split('/'));
  if (!rows.valid) return rows;
  const pairs = pairsOf(rows.value);
  if (!pairs.valid) return pairs;
  const width = rows.value[0]!.width;
  const height = rows.value.length;
  const endpoints = new Set(
    pairs.value.flatMap((pair) =>
      pair.endpoints.map((cell) => `${cell.x},${cell.y}`)
    )
  );
  const records = parseNotationRecords(recordTexts, {
    width,
    height,
    endpoints,
  });
  if (!records.valid) return records;
  return {
    valid: true,
    value: { width, height, pairs: pairs.value, records: records.value },
  };
}

function letterGrid(notation: NumberlinkNotation): string[] {
  const grid = new Array<string>(notation.width * notation.height).fill('');
  for (const pair of notation.pairs)
    for (const cell of pair.endpoints)
      grid[cell.y * notation.width + cell.x] = pair.letter;
  return grid;
}

function formatRow(cells: readonly string[]): string {
  let text = '';
  let run = 0;
  for (const cell of cells) {
    if (cell === '') run += 1;
    else {
      text += `${run > 0 ? run : ''}${cell}`;
      run = 0;
    }
  }
  return run > 0 ? `${text}${run}` : text;
}

/** The one canonical spelling; refuses a structure the grammar cannot hold. */
export function formatNumberlinkNotation(notation: NumberlinkNotation): string {
  const grid = letterGrid(notation);
  const rows = Array.from({ length: notation.height }, (_, y) =>
    formatRow(grid.slice(y * notation.width, (y + 1) * notation.width))
  );
  const text = [
    `${NUMBERLINK_NOTATION_VERSION}:${rows.join('/')}`,
    ...notation.records.map(formatNotationRecord),
  ].join(';');
  const reread = parseNumberlinkNotation(text);
  if (!reread.valid || shapeOf(reread.value) !== shapeOf(notation))
    throw new Error('Cannot write a Numberlink board outside NL1');
  return text;
}

/** Everything a notation says, independent of how its objects were built. */
function shapeOf(notation: NumberlinkNotation): string {
  return JSON.stringify([
    notation.width,
    notation.height,
    notation.pairs.map((pair) => [
      pair.letter,
      pair.endpoints.map((cell) => [cell.x, cell.y]),
    ]),
    notation.records.map(formatNotationRecord),
  ]);
}

function overlay(record: NumberlinkRecord): [Cell, string][] {
  if (record.kind === 'bridge') return record.cells.map((cell) => [cell, '+']);
  if (record.kind === 'teleport')
    return record.links.flatMap((link) => link.map((cell) => [cell, '@']));
  if (record.kind === 'item')
    return record.items.map((item) => [item.cell, '*']);
  return [];
}

/**
 * The board as rows of ASCII cells for people and language models: `.` an
 * empty cell, a letter an endpoint, `+` a bridge, `@` a teleporter and `*`
 * an item. Records follow on their own lines.
 */
export function numberlinkAsciiBoard(notation: NumberlinkNotation): string {
  const grid = letterGrid(notation).map((cell) => (cell === '' ? '.' : cell));
  for (const record of notation.records)
    for (const [cell, mark] of overlay(record))
      grid[cell.y * notation.width + cell.x] = mark;
  const rows = Array.from({ length: notation.height }, (_, y) =>
    grid.slice(y * notation.width, (y + 1) * notation.width).join('')
  );
  return [...rows, ...notation.records.map(formatNotationRecord)].join('\n');
}

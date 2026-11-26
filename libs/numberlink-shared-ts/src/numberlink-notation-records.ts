import type { Cell, NumberlinkIssue, Validation } from './numberlink-types';

/** One collectible on a cell, named by a short lower-case kind (`key`, `gem`). */
export type NotationItem = { readonly kind: string; readonly cell: Cell };

/**
 * Typed extension records after the rows. Only `cover` is playable today;
 * the others are parsed, bounds-checked and written back unchanged so a
 * board using them survives every tool that reads it, and the rules refuse
 * to play it. An unrecognized tag is kept verbatim as `unknown`.
 */
export type NumberlinkRecord =
  | { readonly kind: 'bridge'; readonly cells: readonly Cell[] }
  | { readonly kind: 'cover'; readonly value: 'pairs' }
  | { readonly kind: 'item'; readonly items: readonly NotationItem[] }
  | { readonly kind: 'players'; readonly count: number }
  | {
      readonly kind: 'teleport';
      readonly links: readonly (readonly [Cell, Cell])[];
    }
  | { readonly kind: 'unknown'; readonly tag: string; readonly value: string };

/** What a record needs to know about the board it extends. */
export type RecordBoard = {
  readonly width: number;
  readonly height: number;
  readonly endpoints: ReadonlySet<string>;
};

// The same field names and values as the other games' notations.
const TAG = /^[a-z][a-z0-9.-]{0,31}$/;
const VALUE = /^[A-Za-z0-9@.,:+_~-]{1,256}$/;
const CELL = /^([A-T])([1-9]|1[0-9]|20)$/;
const KIND = /^[a-z]{1,12}$/;

function refuse(message: string): { valid: false; issues: NumberlinkIssue[] } {
  return { valid: false, issues: [{ code: 'notation_record', message }] };
}

export function recordTag(record: NumberlinkRecord): string {
  return record.kind === 'unknown' ? record.tag : record.kind;
}

/** Cells are named as on the board: column A–T, row 1–20 from the top. */
export function formatNotationCell(cell: Cell): string {
  return `${String.fromCharCode(65 + cell.x)}${cell.y + 1}`;
}

function parseCell(text: string, board: RecordBoard): Cell | null {
  const match = CELL.exec(text);
  if (match === null) return null;
  const cell = { x: match[1]!.charCodeAt(0) - 65, y: Number(match[2]) - 1 };
  return cell.x < board.width && cell.y < board.height ? cell : null;
}

/** Distinct, free cells: a mechanic never sits on an endpoint or twice on a cell. */
function freeCells(
  tag: string,
  texts: readonly string[],
  board: RecordBoard
): Validation<Cell[]> {
  const cells: Cell[] = [];
  const seen = new Set<string>();
  for (const text of texts) {
    const cell = parseCell(text, board);
    if (cell === null)
      return refuse(`${tag}: ${text} is not a cell on this board.`);
    const key = `${cell.x},${cell.y}`;
    if (seen.has(key) || board.endpoints.has(key))
      return refuse(`${tag}: ${text} is already used by an endpoint or entry.`);
    seen.add(key);
    cells.push(cell);
  }
  return { valid: true, value: cells };
}

function parseCover(value: string): Validation<NumberlinkRecord> {
  if (value === 'pairs')
    return { valid: true, value: { kind: 'cover', value: 'pairs' } };
  return refuse(
    value === 'all'
      ? 'cover: leave out cover=all, because covering every cell is the default.'
      : `cover: use cover=pairs, not cover=${value}.`
  );
}

function parsePlayers(value: string): Validation<NumberlinkRecord> {
  const count = /^[2-4]$/.test(value) ? Number(value) : 0;
  return count === 0
    ? refuse('players: write a player count from 2 to 4.')
    : { valid: true, value: { kind: 'players', count } };
}

function parseItems(
  value: string,
  board: RecordBoard
): Validation<NumberlinkRecord> {
  const entries = value.split(',').map((entry) => entry.split('@'));
  if (entries.some((entry) => entry.length !== 2 || !KIND.test(entry[0]!)))
    return refuse('item: write each item as kind@cell, such as key@C3.');
  const cells = freeCells(
    'item',
    entries.map((entry) => entry[1]!),
    board
  );
  if (!cells.valid) return cells;
  const items = cells.value.map((cell, index) => ({
    kind: entries[index]![0]!,
    cell,
  }));
  return { valid: true, value: { kind: 'item', items } };
}

/** Teleporters link cells two by two: `teleport=C3,F3,B2,D4` is two links. */
function parseTeleports(
  value: string,
  board: RecordBoard
): Validation<NumberlinkRecord> {
  const texts = value.split(',');
  if (texts.length % 2 !== 0)
    return refuse(
      'teleport: list linked cells two by two, such as teleport=C3,F3.'
    );
  const cells = freeCells('teleport', texts, board);
  if (!cells.valid) return cells;
  const links = Array.from(
    { length: texts.length / 2 },
    (_, index) =>
      [cells.value[index * 2]!, cells.value[index * 2 + 1]!] as const
  );
  return { valid: true, value: { kind: 'teleport', links } };
}

function parseRecord(
  text: string,
  board: RecordBoard
): Validation<NumberlinkRecord> {
  const split = text.indexOf('=');
  const tag = split < 0 ? text : text.slice(0, split);
  const value = split < 0 ? '' : text.slice(split + 1);
  if (!TAG.test(tag) || !VALUE.test(value))
    return refuse(
      `Write each record as name=value, a lower-case name and a value of letters, digits and @ . , : + _ ~ -: ${text.slice(0, 40)}`
    );
  if (tag === 'cover') return parseCover(value);
  if (tag === 'players') return parsePlayers(value);
  if (tag === 'item') return parseItems(value, board);
  if (tag === 'teleport') return parseTeleports(value, board);
  if (tag === 'bridge') {
    const cells = freeCells('bridge', value.split(','), board);
    return cells.valid
      ? { valid: true, value: { kind: 'bridge', cells: cells.value } }
      : cells;
  }
  return { valid: true, value: { kind: 'unknown', tag, value } };
}

/**
 * Records follow the rows, each name once. Their order carries no meaning:
 * they are read into ascending name order, the order the writer uses.
 */
export function parseNotationRecords(
  texts: readonly string[],
  board: RecordBoard
): Validation<NumberlinkRecord[]> {
  if (texts.length > 16) return refuse('Use at most 16 records.');
  const records: NumberlinkRecord[] = [];
  for (const text of texts) {
    const parsed = parseRecord(text, board);
    if (!parsed.valid) return parsed;
    const tag = recordTag(parsed.value);
    if (records.some((record) => recordTag(record) === tag))
      return refuse(`Give the ${tag} record once.`);
    records.push(parsed.value);
  }
  return {
    valid: true,
    value: records.sort((a, b) => (recordTag(a) < recordTag(b) ? -1 : 1)),
  };
}

function recordValue(record: NumberlinkRecord): string {
  if (record.kind === 'cover') return record.value;
  if (record.kind === 'players') return String(record.count);
  if (record.kind === 'unknown') return record.value;
  if (record.kind === 'bridge')
    return record.cells.map(formatNotationCell).join(',');
  if (record.kind === 'teleport')
    return record.links.flat().map(formatNotationCell).join(',');
  return record.items
    .map((item) => `${item.kind}@${formatNotationCell(item.cell)}`)
    .join(',');
}

export function formatNotationRecord(record: NumberlinkRecord): string {
  return `${recordTag(record)}=${recordValue(record)}`;
}

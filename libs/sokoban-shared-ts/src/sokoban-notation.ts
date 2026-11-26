import {
  boardFromRows,
  sokobanBoardRows,
  TOO_LARGE,
  UNREADABLE,
} from './sokoban-rows';
import {
  refuse,
  SOKOBAN_MAX_SIZE,
  type SokobanBoard,
  type Validation,
} from './sokoban-types';

export type SokobanNotation = {
  readonly board: SokobanBoard;
  readonly extensions: readonly (readonly [string, string])[];
};

export const SOKOBAN_DEFINITION_TEXT_LIMIT = 65_536;

const layer = /^([a-z][a-z0-9.-]*)=([A-Za-z0-9@.,:+_~-]+)$/u;
const unknownBoard = { valid: false, issues: [UNREADABLE] } as const;

function expandRow(text: string): string | null {
  let row = '';
  const cells = /([1-9][0-9]?)?([#@+$*.~-])/guy;
  while (cells.lastIndex < text.length) {
    const match = cells.exec(text);
    if (!match) return null;
    const count = Number(match[1] ?? 1);
    if (row.length + count > SOKOBAN_MAX_SIZE) return null;
    row += (match[2] === '-' ? ' ' : match[2]!).repeat(count);
  }
  return row;
}

/** Read the base position and retain every required extension for interchange. */
export function readSokobanNotation(text: string): Validation<SokobanNotation> {
  if (text.length > SOKOBAN_DEFINITION_TEXT_LIMIT)
    return { valid: false, issues: [TOO_LARGE] };
  if (!text.startsWith('SK1:'))
    return refuse(
      'unsupported_notation',
      'Open a board written in SK1 notation.'
    );
  const [layout, ...fields] = text.slice(4).split(';');
  const encoded = layout!.split('/');
  if (encoded.length > SOKOBAN_MAX_SIZE)
    return { valid: false, issues: [TOO_LARGE] };
  const rows: string[] = [];
  for (const row of encoded) {
    const decoded = expandRow(row);
    if (decoded === null) return unknownBoard;
    rows.push(decoded);
  }
  const board = boardFromRows(rows);
  if (!board.valid) return board;
  const extensions: [string, string][] = [];
  const keys = new Set<string>();
  for (const field of fields) {
    const match = layer.exec(field);
    if (!match || keys.has(match[1]!))
      return refuse(
        'invalid_extension',
        'Give each extension a distinct name and a value.'
      );
    keys.add(match[1]!);
    extensions.push([match[1]!, match[2]!]);
  }
  return { valid: true, value: { board: board.value, extensions } };
}

/** Canonical SK1 keeps runs of three or more and orders extensions by name. */
export function writeSokobanNotation(position: SokobanNotation): string {
  const rows = sokobanBoardRows(position.board).map((row) =>
    row
      .replaceAll(' ', '-')
      .replace(/(.)\1{2,}/gu, (run) => `${run.length}${run[0]}`)
  );
  const extensions = [...position.extensions]
    .sort(([a], [b]) => (a < b ? -1 : Number(a > b)))
    .map(([key, value]) => {
      const field = `${key}=${value}`;
      const parsed = layer.exec(field);
      if (!parsed || parsed[1] !== key || parsed[2] !== value)
        throw new Error('Invalid Sokoban extension');
      return field;
    });
  const text = [`SK1:${rows.join('/')}`, ...extensions].join(';');
  if (!readSokobanNotation(text).valid)
    throw new Error('Invalid Sokoban position or extension');
  return text;
}

/** Monospace diagram with all extension layers listed underneath. */
export function drawSokobanNotation(position: SokobanNotation): string {
  return [
    ...sokobanBoardRows(position.board),
    ...position.extensions.map(([key, value]) => `${key}=${value}`),
  ].join('\n');
}

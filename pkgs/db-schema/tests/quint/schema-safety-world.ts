/**
 * The schema-safety model's world: two copies of one small contract, checked
 * against `assertEvolvable` on every change. A dangerous edit must be refused
 * by the evolution gate and leave both copies as they were.
 */

import {
  assertEvolvable,
  type ColumnType,
  type Snapshot,
} from '@pkgs/db-schema';

const COLS = ['a', 'b'] as const;
type Col = (typeof COLS)[number];
type Cells = Record<Col, string>;

const TABLE = 'notes';
const KEPT_NOTE = 'kept for an earlier version';

const ADD: Readonly<Record<string, string>> = {
  text: 'text/live/null',
  integer: 'integer/live/null',
};

const FILL: Readonly<Record<string, string>> = {
  'text/live/null': 'text/live/kept',
  'integer/live/null': 'integer/live/kept',
};

const RETIRE_SHARED: Readonly<Record<string, string>> = {
  'text/live/null': 'text/retired/null',
  'text/live/kept': 'text/retired/kept',
  'integer/live/null': 'integer/retired/null',
  'integer/live/kept': 'integer/retired/kept',
};

const RETIRE_DEVICE: Readonly<Record<string, string>> = {
  'text/live/null': 'text/retired/gone',
  'text/live/kept': 'text/retired/gone',
  'integer/live/null': 'integer/retired/gone',
  'integer/live/kept': 'integer/retired/gone',
};

export type SafetyWorld = {
  shared: Cells;
  device: Cells;
  online: boolean;
};

export function createSafetyWorld(): SafetyWorld {
  return { shared: blank(), device: blank(), online: true };
}

export function resetSafetyWorld(world: SafetyWorld): void {
  world.shared = blank();
  world.device = blank();
  world.online = true;
}

function blank(): Cells {
  return { a: 'absent', b: 'absent' };
}

function isCol(value: string): value is Col {
  return value === 'a' || value === 'b';
}

export function columnPick(
  picks: Readonly<Record<string, unknown>>,
  name: string
): Col {
  const value = picks[name];
  if (typeof value !== 'string' || !isCol(value)) {
    throw new Error(`schema-safety: pick ${name} is not a column`);
  }
  return value;
}

export function typePick(
  picks: Readonly<Record<string, unknown>>,
  name: string
): ColumnType {
  const value = picks[name];
  if (value !== 'text' && value !== 'integer') {
    throw new Error(`schema-safety: pick ${name} is not a column kind`);
  }
  return value;
}

function kindOf(cell: string): ColumnType {
  if (cell.startsWith('text/')) return 'text';
  if (cell.startsWith('integer/')) return 'integer';
  throw new Error(`schema-safety: ${cell} has no kind`);
}

function liveKind(cell: string): ColumnType | null {
  if (cell.endsWith('/live/null') || cell.endsWith('/live/kept')) {
    return kindOf(cell);
  }
  return null;
}

function retiredKind(cell: string): ColumnType | null {
  if (cell.endsWith('/retired/null') || cell.endsWith('/retired/kept')) {
    return kindOf(cell);
  }
  return null;
}

export function contractOf(cells: Cells): Snapshot {
  const columns: Record<string, ColumnType> = {};
  const retired: Record<string, { type: ColumnType; note: string }> = {};
  for (const col of COLS) {
    const cell = cells[col];
    const live = liveKind(cell);
    if (live !== null) {
      columns[col] = live;
      continue;
    }
    const kept = retiredKind(cell);
    if (kept !== null) retired[col] = { type: kept, note: KEPT_NOTE };
  }
  return snapshot(columns, retired);
}

function snapshot(
  columns: Record<string, ColumnType>,
  retired: Record<string, { type: ColumnType; note: string }>
): Snapshot {
  return {
    tables: { [TABLE]: columns },
    retiredColumns: { [TABLE]: retired },
    physicalOverrides: {},
    retiredTables: [],
    indexes: [],
    uniqueIndexes: [],
  };
}

function otherKind(kind: ColumnType): ColumnType {
  return kind === 'text' ? 'integer' : 'text';
}

/** The evolution gate accepts this edit. */
export function acceptEvolution(prev: Snapshot, next: Snapshot): void {
  assertEvolvable(prev, next);
}

/** The evolution gate refuses this edit. Anything else is a dangerous change. */
export function refuseEvolution(prev: Snapshot, next: Snapshot): void {
  try {
    assertEvolvable(prev, next);
  } catch {
    return;
  }
  throw new Error('schema-safety: a dangerous change was accepted');
}

export function addDetail(
  world: SafetyWorld,
  col: Col,
  kind: ColumnType
): void {
  const cell = ADD[kind];
  if (cell === undefined) throw new Error(`schema-safety: no cell for ${kind}`);
  const next = { ...world.shared, [col]: cell };
  acceptEvolution(contractOf(world.shared), contractOf(next));
  world.shared = next;
  world.device = { ...world.device, [col]: cell };
}

export function retireDetail(world: SafetyWorld, col: Col): void {
  const sharedCell = RETIRE_SHARED[world.shared[col]];
  const deviceCell = RETIRE_DEVICE[world.device[col]];
  if (sharedCell === undefined || deviceCell === undefined) {
    throw new Error(`schema-safety: ${col} cannot be retired`);
  }
  const next = { ...world.shared, [col]: sharedCell };
  acceptEvolution(contractOf(world.shared), contractOf(next));
  world.shared = next;
  world.device = { ...world.device, [col]: deviceCell };
}

export function fillBlank(world: SafetyWorld, col: Col): void {
  if (!world.online) return;
  const sharedCell = FILL[world.shared[col]];
  const deviceCell = FILL[world.device[col]];
  if (sharedCell === undefined || deviceCell === undefined) {
    throw new Error(`schema-safety: ${col} has no blank to fill`);
  }
  const next = { ...world.shared, [col]: sharedCell };
  acceptEvolution(contractOf(world.shared), contractOf(next));
  world.shared = next;
  world.device = { ...world.device, [col]: deviceCell };
}

export function copyDetail(world: SafetyWorld, src: Col, dst: Col): void {
  if (!world.shared[src].endsWith('/kept')) {
    throw new Error(`schema-safety: ${src} has no kept value to copy`);
  }
  const filled = FILL[world.shared[dst]];
  const onDevice = FILL[world.device[dst]];
  if (filled === undefined || onDevice === undefined) {
    throw new Error(`schema-safety: ${dst} is not a blank detail`);
  }
  const next = { ...world.shared, [dst]: filled };
  acceptEvolution(contractOf(world.shared), contractOf(next));
  world.shared = next;
  world.device = { ...world.device, [dst]: onDevice };
}

export function retypeRefused(world: SafetyWorld, col: Col): void {
  const kind = liveKind(world.shared[col]);
  if (kind === null) throw new Error(`schema-safety: ${col} is not live`);
  const columns = columnsOf(world.shared);
  columns[col] = otherKind(kind);
  refuseEvolution(
    contractOf(world.shared),
    snapshot(columns, retiredOf(world.shared))
  );
}

export function dropRefused(world: SafetyWorld, col: Col): void {
  const columns = columnsOf(world.shared);
  delete columns[col];
  refuseEvolution(
    contractOf(world.shared),
    snapshot(columns, retiredOf(world.shared))
  );
}

export function forgetRefused(world: SafetyWorld, col: Col): void {
  const retired = retiredOf(world.shared);
  delete retired[col];
  refuseEvolution(
    contractOf(world.shared),
    snapshot(columnsOf(world.shared), retired)
  );
}

export function retypeTombstoneRefused(world: SafetyWorld, col: Col): void {
  const retired = retiredOf(world.shared);
  const entry = retired[col];
  if (entry === undefined)
    throw new Error(`schema-safety: ${col} is not retired`);
  retired[col] = { type: otherKind(entry.type), note: entry.note };
  refuseEvolution(
    contractOf(world.shared),
    snapshot(columnsOf(world.shared), retired)
  );
}

export function renameRefused(world: SafetyWorld, col: Col): void {
  dropRefused(world, col);
}

function columnsOf(cells: Cells): Record<string, ColumnType> {
  const columns: Record<string, ColumnType> = {};
  for (const col of COLS) {
    const kind = liveKind(cells[col]);
    if (kind !== null) columns[col] = kind;
  }
  return columns;
}

function retiredOf(
  cells: Cells
): Record<string, { type: ColumnType; note: string }> {
  const retired: Record<string, { type: ColumnType; note: string }> = {};
  for (const col of COLS) {
    const kind = retiredKind(cells[col]);
    if (kind !== null) retired[col] = { type: kind, note: KEPT_NOTE };
  }
  return retired;
}

export function cellsMap(cells: Cells): Map<string, string> {
  return new Map(COLS.map((col) => [col, cells[col]]));
}

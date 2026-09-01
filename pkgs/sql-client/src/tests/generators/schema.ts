import { fc } from '@pkgs/pbt';
import type { LogicalColumnType } from '../oracles/canonical-dump';

export type LogicalColumn = {
  readonly name: string;
  readonly type: LogicalColumnType;
};

export type LogicalTable = {
  readonly name: string;
  readonly columns: readonly LogicalColumn[];
};

export type LogicalSchema = {
  readonly tables: readonly LogicalTable[];
};

const COLUMN_TYPES: readonly LogicalColumnType[] = [
  'text',
  'integer',
  'boolean',
  'timestamp',
  'json',
  'real',
  'numeric',
  'date',
];

const IDENT = fc
  .stringMatching(/^[a-z][a-z0-9_]{0,11}$/)
  .filter((s) => !['id', 'table', 'select', 'from', 'where'].includes(s));

/** Monotonic table ids — shrink must not reuse names on shared engines. */
let tableSeq = 0;

export function nextTableName(): string {
  tableSeq += 1;
  return `t_${tableSeq}`;
}

export const arbColumnType = (): fc.Arbitrary<LogicalColumnType> =>
  fc.constantFrom(...COLUMN_TYPES);

export const arbLogicalColumn = (): fc.Arbitrary<LogicalColumn> =>
  fc.record({
    name: IDENT,
    type: arbColumnType(),
  });

export const arbLogicalTable = (name: string): fc.Arbitrary<LogicalTable> =>
  fc
    .uniqueArray(arbLogicalColumn(), {
      minLength: 1,
      maxLength: 4,
      selector: (c) => c.name,
    })
    .map((columns) => ({
      name,
      columns: [{ name: 'id', type: 'text' as const }, ...columns],
    }));

/** One table with unique sample name (shared engines stay open). */
export const arbLogicalSchema = (): fc.Arbitrary<LogicalSchema> =>
  arbLogicalTable('t').map((table) => ({
    tables: [{ ...table, name: nextTableName() }],
  }));

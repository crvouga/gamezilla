import fc from 'fast-check';
import { defineTable } from '../../core/define-table';
import { registerTables } from '../../core/register-tables';
import { isReservedSchemaKeyword } from '../../core/snake-case';
import type { ColumnType, Schema } from '../../core/types';
import { COLUMN_TYPES } from '../../core/types';

let tableSeq = 0;

export function nextTableName(): string {
  tableSeq += 1;
  return `t_${tableSeq}`;
}

export const arbSnakeIdent = (): fc.Arbitrary<string> =>
  fc
    .stringMatching(/^[a-z][a-z0-9]{0,10}(_[a-z0-9]{1,4})?$/)
    .filter((s) => s.length <= 40 && !isReservedSchemaKeyword(s));

export const arbColumnType = (): fc.Arbitrary<ColumnType> =>
  fc.constantFrom(...COLUMN_TYPES);

export function arbSchema(
  colCount: { min: number; max: number } = { min: 1, max: 3 }
): fc.Arbitrary<Schema> {
  return fc
    .uniqueArray(arbSnakeIdent(), {
      minLength: colCount.min,
      maxLength: colCount.max,
    })
    .chain((colNames) =>
      fc.tuple(...colNames.map(() => arbColumnType())).map((types) => {
        const table = nextTableName();
        const columns: Record<string, ColumnType> = {};
        for (let i = 0; i < colNames.length; i++) {
          columns[colNames[i]!] = types[i]!;
        }
        return registerTables([
          defineTable({
            domain: table,
            name: table,
            columns,
          }),
        ]);
      })
    );
}

export { fc };

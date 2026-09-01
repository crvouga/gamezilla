import { fc } from '@pkgs/pbt';

export type GenTable = {
  readonly name: string;
  readonly columns: readonly string[];
  readonly estimatedRows: number;
};

export type GenSchema = {
  readonly tables: readonly GenTable[];
};

const ROW_BUCKETS = [0, 9_999, 10_000, 10_001, 1_000_000] as const;

const arbIdent = fc
  .stringMatching(/^[a-z][a-z0-9_]{0,11}$/)
  .filter((s) => s !== 'id' && s.length > 0);

/**
 * Schema: 1–12 tables, 2–24 cols (incl. PK id), row-count boundary buckets.
 */
export const genSchema: fc.Arbitrary<GenSchema> = fc
  .integer({ min: 1, max: 12 })
  .chain((tableCount) =>
    fc.array(
      fc.record({
        name: arbIdent,
        colCount: fc.integer({ min: 1, max: 23 }),
        estimatedRows: fc.constantFrom(...ROW_BUCKETS),
      }),
      { minLength: tableCount, maxLength: tableCount }
    )
  )
  .map((raw) => {
    const seen = new Set<string>();
    const tables: GenTable[] = [];
    for (let i = 0; i < raw.length; i++) {
      let name = raw[i]!.name;
      let n = 0;
      while (seen.has(name)) {
        name = `${raw[i]!.name}_${String(n++)}`;
      }
      seen.add(name);
      const cols = new Set<string>(['id']);
      const extra = Math.min(raw[i]!.colCount, 23);
      for (let c = 0; c < extra; c++) {
        cols.add(`c${String(c)}`);
      }
      tables.push({
        name,
        columns: [...cols],
        estimatedRows: raw[i]!.estimatedRows,
      });
    }
    return { tables };
  });

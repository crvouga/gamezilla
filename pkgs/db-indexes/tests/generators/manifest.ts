import fc from 'fast-check';
import { fingerprintSql } from '../../src/core/fingerprint';
import type { WorkloadManifest, WorkloadQuery } from '../../src/core/types';
import { type GenSchema, genSchema } from './schema';
import { genStatement } from './statement-ast';

function perturbSql(sql: string, kind: 0 | 1 | 2): string {
  if (kind === 0) return `  ${sql}  \n`;
  if (kind === 1)
    return sql.replace(/\?/g, (_m, offset) => {
      // crude $n replacement counting
      void offset;
      return '?';
    });
  return `${sql}\n-- pad`;
}

/**
 * Manifest of 1–200 statements over schema; includes fingerprint-equal
 * whitespace/case perturbations of duplicate logical statements.
 */
export function genManifest(schema: GenSchema): fc.Arbitrary<WorkloadManifest> {
  return fc
    .integer({ min: 1, max: 40 })
    .chain((n) =>
      fc.array(genStatement(schema), { minLength: n, maxLength: n })
    )
    .chain((stmts) =>
      fc.boolean().map((withDup) => {
        const queries: WorkloadQuery[] = [];
        const items = withDup
          ? [...stmts, { ...stmts[0]!, sql: perturbSql(stmts[0]!.sql, 0) }]
          : stmts;
        for (let i = 0; i < items.length; i++) {
          const { sql } = items[i]!;
          const table = schema.tables[i % schema.tables.length]!.name;
          queries.push({
            name: `q${String(i)}`,
            hydrates: [table],
            statements: [
              {
                index: 0,
                sql,
                fingerprint: fingerprintSql(sql),
                weight: 1 + (i % 5),
              },
            ],
          });
        }
        return { version: 1 as const, queries };
      })
    );
}

/** Small manifests for fast PBT (1–8 queries). */
export function genSmallManifest(
  schema: GenSchema
): fc.Arbitrary<WorkloadManifest> {
  return fc
    .integer({ min: 1, max: 8 })
    .chain((n) =>
      fc.array(genStatement(schema), { minLength: n, maxLength: n })
    )
    .map((stmts) => {
      const queries: WorkloadQuery[] = stmts.map((s, i) => ({
        name: `q${String(i)}`,
        hydrates: [s.ast.table],
        statements: [
          {
            index: 0,
            sql: s.sql,
            fingerprint: fingerprintSql(s.sql),
            weight: 1,
          },
        ],
      }));
      return { version: 1 as const, queries };
    });
}

/** A schema with a small manifest over it — one arbitrary, so both shrink together. */
export const genSchemaWithManifest: fc.Arbitrary<{
  readonly schema: GenSchema;
  readonly manifest: WorkloadManifest;
}> = genSchema.chain((schema) =>
  genSmallManifest(schema).map((manifest) => ({ schema, manifest }))
);

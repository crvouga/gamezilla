import { ownedIndexName } from '../../core/naming';
import type {
  IndexDefinition,
  IndexInfo,
  OwnedMeta,
  TableInfo,
} from '../../core/types';
import { asOwnedIndexName } from '../../core/types';
import { fc } from '@pkgs/pbt';
import type { GenSchema } from './schema';

export type GenDbState = {
  readonly tables: readonly TableInfo[];
  readonly indexes: readonly IndexInfo[];
  readonly metas: readonly OwnedMeta[];
  readonly usage: readonly { readonly name: string; readonly scans: number }[];
};

function ownedInfo(def: IndexDefinition, valid: boolean): IndexInfo {
  const name = ownedIndexName(def);
  return {
    name,
    table: def.table,
    columns: def.columns.map((c) => c.name),
    include: [...def.include],
    predicate: def.predicate,
    isUnique: false,
    isPrimary: false,
    isValid: valid,
    isOwned: true,
  };
}

/**
 * DB state: valid/invalid/deprecated owned, orphaned owned, unique imposters
 * named autoidx_*, missing desired, budget-exceeded tables.
 */
export function genDbState(
  schema: GenSchema,
  now: number
): fc.Arbitrary<GenDbState> {
  return fc
    .record({
      invalid: fc.boolean(),
      deprecated: fc.boolean(),
      orphan: fc.boolean(),
      imposter: fc.boolean(),
      budgetExceed: fc.boolean(),
    })
    .map((flags) => {
      const tables: TableInfo[] = schema.tables.map((t) => ({
        name: t.name,
        estimatedRows: Math.max(t.estimatedRows, 10_000),
      }));
      const indexes: IndexInfo[] = [];
      const metas: OwnedMeta[] = [];
      const usage: { name: string; scans: number }[] = [];

      // Manual ix_/ux_ must never be touched
      const t0 = schema.tables[0]!;
      indexes.push({
        name: `ix_${t0.name}_user_id`,
        table: t0.name,
        columns: ['user_id'],
        include: [],
        predicate: null,
        isUnique: false,
        isPrimary: false,
        isValid: true,
        isOwned: false,
      });
      indexes.push({
        name: `ux_${t0.name}_id`,
        table: t0.name,
        columns: ['id'],
        include: [],
        predicate: null,
        isUnique: true,
        isPrimary: false,
        isValid: true,
        isOwned: false,
      });

      if (flags.imposter) {
        indexes.push({
          name: `autoidx_${t0.name}_deadbeef`,
          table: t0.name,
          columns: ['c0'],
          include: [],
          predicate: null,
          isUnique: true,
          isPrimary: false,
          isValid: true,
          isOwned: false,
        });
      }

      const col = t0.columns.find((c) => c !== 'id') ?? 'c0';
      const def: IndexDefinition = {
        table: t0.name,
        columns: [{ name: col, order: 'asc' }],
        include: [],
        predicate: null,
      };
      const owned = ownedInfo(def, !flags.invalid);
      indexes.push(owned);
      usage.push({ name: owned.name, scans: 0 });

      if (flags.deprecated) {
        metas.push({
          name: asOwnedIndexName(owned.name),
          deprecatedAt: now - 40 * 24 * 60 * 60 * 1000,
          usageAtDeprecation: 0,
          payload: '{}',
        });
      }

      if (flags.orphan) {
        const orphanDef: IndexDefinition = {
          table: t0.name,
          columns: [{ name: col, order: 'desc' }],
          include: ['id'],
          predicate: 'deleted_at IS NULL',
        };
        const o = ownedInfo(orphanDef, true);
        indexes.push(o);
        usage.push({ name: o.name, scans: 0 });
        metas.push({
          name: asOwnedIndexName(o.name),
          deprecatedAt: now - 40 * 24 * 60 * 60 * 1000,
          usageAtDeprecation: 0,
          payload: '{}',
        });
      }

      if (flags.budgetExceed) {
        for (let i = 0; i < 8; i++) {
          const d: IndexDefinition = {
            table: t0.name,
            columns: [{ name: col, order: 'asc' }],
            include: [`extra_${String(i)}`],
            predicate: null,
          };
          // Force unique names via include
          try {
            const ix = ownedInfo(d, true);
            indexes.push(ix);
            usage.push({ name: ix.name, scans: 0 });
          } catch {
            // skip if name too long
          }
        }
      }

      return { tables, indexes, metas, usage };
    });
}

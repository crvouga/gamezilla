import fc from 'fast-check';
import { ownedIndexName } from '@pkgs/db-indexes-shared/naming';
import type {
  IndexDefinition,
  IndexInfo,
  OwnedMeta,
  TableInfo,
} from '@pkgs/db-indexes-shared/types';
import { asOwnedIndexName } from '@pkgs/db-indexes-shared/types';
import type { GenSchema } from './schema';

export type GenDbState = {
  readonly tables: readonly TableInfo[];
  readonly indexes: readonly IndexInfo[];
  readonly metas: readonly OwnedMeta[];
  readonly usage: readonly { readonly name: string; readonly scans: number }[];
};

type DbStateFlags = {
  readonly invalid: boolean;
  readonly deprecated: boolean;
  readonly orphan: boolean;
  readonly imposter: boolean;
  readonly budgetExceed: boolean;
};

type MutableDbState = {
  tables: TableInfo[];
  indexes: IndexInfo[];
  metas: OwnedMeta[];
  usage: { name: string; scans: number }[];
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

function pushManualIndexes(
  out: MutableDbState,
  t0: GenSchema['tables'][0]
): void {
  out.indexes.push({
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
  out.indexes.push({
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
}

function pushImposterIndex(
  out: MutableDbState,
  t0: GenSchema['tables'][0]
): void {
  out.indexes.push({
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

function pushOwnedIndex(
  out: MutableDbState,
  def: IndexDefinition,
  valid: boolean,
  deprecatedAt: number | null
): void {
  const owned = ownedInfo(def, valid);
  out.indexes.push(owned);
  out.usage.push({ name: owned.name, scans: 0 });
  if (deprecatedAt !== null) {
    out.metas.push({
      name: asOwnedIndexName(owned.name),
      deprecatedAt,
      usageAtDeprecation: 0,
      payload: '{}',
    });
  }
}

function pushBudgetIndexes(
  out: MutableDbState,
  table: string,
  col: string
): void {
  for (let i = 0; i < 8; i++) {
    const d: IndexDefinition = {
      table,
      columns: [{ name: col, order: 'asc' }],
      include: [`extra_${String(i)}`],
      predicate: null,
    };
    try {
      const ix = ownedInfo(d, true);
      out.indexes.push(ix);
      out.usage.push({ name: ix.name, scans: 0 });
    } catch {
      // skip if name too long
    }
  }
}

function buildDbState(
  schema: GenSchema,
  now: number,
  flags: DbStateFlags
): GenDbState {
  const out: MutableDbState = {
    tables: schema.tables.map((t) => ({
      name: t.name,
      estimatedRows: Math.max(t.estimatedRows, 10_000),
    })),
    indexes: [],
    metas: [],
    usage: [],
  };

  const t0 = schema.tables[0]!;
  pushManualIndexes(out, t0);
  if (flags.imposter) pushImposterIndex(out, t0);

  const col = t0.columns.find((c) => c !== 'id') ?? 'c0';
  const def: IndexDefinition = {
    table: t0.name,
    columns: [{ name: col, order: 'asc' }],
    include: [],
    predicate: null,
  };
  pushOwnedIndex(
    out,
    def,
    !flags.invalid,
    flags.deprecated ? now - 40 * 24 * 60 * 60 * 1000 : null
  );

  if (flags.orphan) {
    pushOwnedIndex(
      out,
      {
        table: t0.name,
        columns: [{ name: col, order: 'desc' }],
        include: ['id'],
        predicate: 'deleted_at IS NULL',
      },
      true,
      now - 40 * 24 * 60 * 60 * 1000
    );
  }

  if (flags.budgetExceed) {
    pushBudgetIndexes(out, t0.name, col);
  }

  return out;
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
    .map((flags) => buildDbState(schema, now, flags));
}

import { assert } from '@pkgs/assert';
import type { Clock } from '@pkgs/clock';
import { generateCandidates } from './candidates';
import { compareNames } from './compare';
import type { Config } from './config';
import { resolveConfig } from './config';
import { consolidateCandidates } from './consolidate';
import { ingestManifest } from './ingest';
import { assertWithinLimit, LIMITS } from './limits';
import { assertIsOwnedName, isOwnedName } from './naming';
import type {
  Candidate,
  DbPort,
  IndexInfo,
  IndexPlan,
  OwnedMeta,
  PlanAction,
  SkippedItem,
  Stmt,
  TableInfo,
  UsageInfo,
  WorkloadManifest,
} from './types';
import { asOwnedIndexName } from './types';

function tableRowCount(tables: readonly TableInfo[], name: string): number {
  for (let i = 0; i < tables.length; i++) {
    if (tables[i]!.name === name) return tables[i]!.estimatedRows;
  }
  return 0;
}

function usageScans(usage: readonly UsageInfo[], name: string): number {
  for (let i = 0; i < usage.length; i++) {
    if (usage[i]!.name === name) return usage[i]!.scans;
  }
  return 0;
}

function metaFor(
  metas: readonly OwnedMeta[],
  name: string
): OwnedMeta | undefined {
  for (let i = 0; i < metas.length; i++) {
    if (metas[i]!.name === name) return metas[i];
  }
  return undefined;
}

function createPriority(cand: Candidate, tables: readonly TableInfo[]): number {
  const rows = tableRowCount(tables, cand.definition.table);
  return rows * cand.weight;
}

function actionKindRank(k: PlanAction['kind']): number {
  switch (k) {
    case 'repair_invalid':
      return 0;
    case 'create':
      return 1;
    case 'clear_deprecation':
      return 2;
    case 'deprecate':
      return 3;
    case 'drop':
      return 4;
  }
}

function sortPlanActions(actions: PlanAction[]): void {
  actions.sort((a, b) => {
    const rk = actionKindRank(a.kind) - actionKindRank(b.kind);
    if (rk !== 0) return rk;
    const pr = b.priority - a.priority;
    if (pr !== 0) return pr;
    const tn = compareNames(a.table, b.table);
    if (tn !== 0) return tn;
    return compareNames(a.name, b.name);
  });
}

function reservedIndexNames(indexes: readonly IndexInfo[]): Set<string> {
  const names = new Set<string>();
  for (let i = 0; i < indexes.length; i++) {
    const ix = indexes[i]!;
    if (ix.isUnique || ix.isPrimary) names.add(ix.name);
  }
  return names;
}

function pushRepairActions(
  ownedActual: readonly IndexInfo[],
  actions: PlanAction[],
  config: Config
): void {
  for (let i = 0; i < ownedActual.length; i++) {
    const ix = ownedActual[i]!;
    if (!ix.isValid && isOwnedName(ix.name)) {
      actions.push({
        kind: 'repair_invalid',
        name: asOwnedIndexName(ix.name),
        definition: null,
        estimatedMs: config.dropEstimatedMs,
        table: ix.table,
        priority: Number.MAX_SAFE_INTEGER,
      });
    }
  }
}

function pushCreateActions(args: {
  readonly desired: readonly Candidate[];
  readonly ownedActual: readonly IndexInfo[];
  readonly reservedNames: ReadonlySet<string>;
  readonly metas: readonly OwnedMeta[];
  readonly tables: readonly TableInfo[];
  readonly actions: PlanAction[];
  readonly kept: string[];
  readonly config: Config;
}): void {
  for (let i = 0; i < args.desired.length; i++) {
    const cand = args.desired[i]!;
    if (args.reservedNames.has(cand.name)) continue;
    const existing = args.ownedActual.find((ix) => ix.name === cand.name);
    if (existing !== undefined && existing.isValid) {
      const m = metaFor(args.metas, cand.name);
      if (m?.deprecatedAt != null) {
        args.actions.push({
          kind: 'clear_deprecation',
          name: cand.name,
          definition: cand.definition,
          estimatedMs: args.config.metaEstimatedMs,
          table: cand.definition.table,
          priority: createPriority(cand, args.tables),
        });
      }
      args.kept.push(cand.name);
      continue;
    }
    args.actions.push({
      kind: 'create',
      name: cand.name,
      definition: cand.definition,
      estimatedMs: args.config.createEstimatedMs,
      table: cand.definition.table,
      priority: createPriority(cand, args.tables),
    });
  }
}

function pushDeprecateDropActions(args: {
  readonly ownedActual: readonly IndexInfo[];
  readonly desiredByName: ReadonlyMap<string, Candidate>;
  readonly metas: readonly OwnedMeta[];
  readonly usage: readonly UsageInfo[];
  readonly config: Config;
  readonly now: number;
  readonly actions: PlanAction[];
}): void {
  const windowMs = args.config.deprecationWindowDays * 24 * 60 * 60 * 1000;
  for (let i = 0; i < args.ownedActual.length; i++) {
    const ix = args.ownedActual[i]!;
    if (!isOwnedName(ix.name) || args.desiredByName.has(ix.name)) continue;
    const m = metaFor(args.metas, ix.name);
    const scans = usageScans(args.usage, ix.name);
    if (m?.deprecatedAt == null) {
      args.actions.push({
        kind: 'deprecate',
        name: asOwnedIndexName(ix.name),
        definition: null,
        estimatedMs: args.config.metaEstimatedMs,
        table: ix.table,
        priority: 0,
      });
      continue;
    }
    const elapsed = args.now - m.deprecatedAt;
    const usageUnchanged = m.usageAtDeprecation === scans;
    if (elapsed >= windowMs && usageUnchanged) {
      // I3: drop only when window elapsed AND usage unchanged
      assert.ok(
        usageUnchanged,
        'I3: drop requires usage unchanged since deprecation'
      );
      assert.ok(
        elapsed >= windowMs,
        'I3: drop requires deprecation window elapsed'
      );
      assertIsOwnedName(ix.name);
      args.actions.push({
        kind: 'drop',
        name: asOwnedIndexName(ix.name),
        definition: null,
        estimatedMs: args.config.dropEstimatedMs,
        table: ix.table,
        priority: 0,
      });
    }
  }
}

/**
 * Diff owned actual indexes vs desired set → plan actions.
 * Only owned names are considered for create/drop/deprecate.
 */
export function diffOwnedIndexes(args: {
  readonly desired: readonly Candidate[];
  readonly indexes: readonly IndexInfo[];
  readonly metas: readonly OwnedMeta[];
  readonly usage: readonly UsageInfo[];
  readonly tables: readonly TableInfo[];
  readonly config: Config;
  readonly now: number;
}): { readonly actions: PlanAction[]; readonly kept: string[] } {
  const { desired, indexes, metas, usage, tables, config, now } = args;
  assert.ok(Number.isFinite(now), 'now must be finite');

  const desiredByName = new Map<string, Candidate>();
  for (let i = 0; i < desired.length; i++) {
    desiredByName.set(desired[i]!.name, desired[i]!);
  }

  const actions: PlanAction[] = [];
  const kept: string[] = [];
  const reservedNames = reservedIndexNames(indexes);
  // Unique / PK never enter owned planning — even if the name matches autoidx_*.
  const ownedActual = indexes.filter(
    (ix) => (ix.isOwned || isOwnedName(ix.name)) && !reservedNames.has(ix.name)
  );

  pushRepairActions(ownedActual, actions, config);
  pushCreateActions({
    desired,
    ownedActual,
    reservedNames,
    metas,
    tables,
    actions,
    kept,
    config,
  });
  pushDeprecateDropActions({
    ownedActual,
    desiredByName,
    metas,
    usage,
    config,
    now,
    actions,
  });

  assertWithinLimit(actions.length, LIMITS.maxPlanActions, 'plan actions');
  sortPlanActions(actions);
  // I1: every planned action targets an owned non-unique name
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i]!;
    assertIsOwnedName(a.name);
    assert.ok(
      !a.name.startsWith('ix_') && !a.name.startsWith('ux_'),
      'I1: plan must never target db-schema ix_/ux_ indexes'
    );
    assert.ok(
      !reservedNames.has(a.name),
      'I1: plan must never target unique/PK indexes'
    );
  }
  return { actions, kept };
}

/**
 * Analyze only — no writes. Pure given DbPort responses + clock.
 */
export async function planIndexes(args: {
  readonly manifest: WorkloadManifest;
  readonly db: DbPort;
  readonly clock: Clock;
  readonly config?: Partial<Config>;
}): Promise<IndexPlan> {
  assert.ok(args.manifest !== undefined, 'manifest required');
  assert.ok(args.db !== undefined, 'db port required');
  assert.ok(args.clock !== undefined, 'clock required');
  const config = resolveConfig(args.config);
  const now = args.clock.now();
  assert.ok(Number.isFinite(now), 'clock.now must be finite');

  const ingested = ingestManifest(args.manifest);
  const skipped: SkippedItem[] = [...ingested.skipped];
  const allCandidates: Candidate[] = [];
  const stmts: Stmt[] = [];

  const tables = await args.db.introspectTables();
  const tableSet = new Set(tables.map((t) => t.name));

  for (let i = 0; i < ingested.statements.length; i++) {
    const item = ingested.statements[i]!;
    const parsed = args.db.parseStatement(item.normalizedSql);
    if (parsed.ok) {
      for (let t = 0; t < parsed.tables.length; t++) {
        const table = parsed.tables[t]!;
        if (!tableSet.has(table)) {
          skipped.push({
            reason: 'missing_table',
            detail: `table ${table} not found`,
            queryName: item.queryName,
            statementIndex: item.statement.index,
          });
        }
      }
    }
    const gen = generateCandidates(parsed, {
      queryName: item.queryName,
      statementIndex: item.statement.index,
      weight: item.statement.weight,
      config,
    });
    for (let s = 0; s < gen.skipped.length; s++) skipped.push(gen.skipped[s]!);
    for (let c = 0; c < gen.candidates.length; c++) {
      allCandidates.push(gen.candidates[c]!);
    }
    const stmt: Stmt = {
      sql: item.statement.sql,
      fingerprint: item.statement.fingerprint,
      ...(item.statement.text !== undefined
        ? { text: item.statement.text }
        : {}),
    };
    stmts.push(stmt);
  }

  allCandidates.sort((a, b) => compareNames(a.name, b.name));

  const evals = await args.db.evaluateCandidates(stmts, allCandidates);
  const consolidated = consolidateCandidates(
    allCandidates,
    evals,
    tables,
    config
  );
  for (let i = 0; i < consolidated.skipped.length; i++) {
    skipped.push(consolidated.skipped[i]!);
  }

  const indexes = await args.db.introspectIndexes();
  const metas = await args.db.readOwnedMeta();
  const usage = await args.db.readIndexUsage();

  const { actions, kept } = diffOwnedIndexes({
    desired: consolidated.kept,
    indexes,
    metas,
    usage,
    tables,
    config,
    now,
  });

  return {
    desired: consolidated.kept,
    actions,
    skipped,
    kept: kept.map((n) => asOwnedIndexName(n)),
  };
}

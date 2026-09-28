import { assert } from '@pkgs/assert';
import type { Clock } from '@pkgs/clock';
import { sortByName } from '../core/compare';
import { assertWithinLimit, LIMITS } from '../core/limits';
import { isOwnedName, ownedIndexName } from '../core/naming';
import { parseWithNodeSqlParser } from '../core/parse-node-sql';
import type {
  ActionResult,
  Candidate,
  DbPort,
  Eval,
  IndexInfo,
  OwnedMeta,
  ParsedStatement,
  PlanAction,
  Stmt,
  TableInfo,
  UsageInfo,
} from '../core/types';
import { HarnessCrashError } from './crash-error';

export type HarnessFaultKind =
  | 'none'
  | 'transient'
  | 'lock_timeout'
  | 'crash_before'
  | 'crash_inside'
  | 'latency';

export type HarnessFault = {
  readonly kind: HarnessFaultKind;
  readonly onCall?: number;
};

export type HarnessTableSeed = {
  readonly name: string;
  readonly estimatedRows: number;
};

export type HarnessIndexSeed = {
  readonly info: IndexInfo;
  readonly scans: number;
};

export type HarnessDbOptions = {
  readonly clock: Clock;
  readonly tables?: readonly HarnessTableSeed[];
  readonly indexes?: readonly HarnessIndexSeed[];
  readonly metas?: readonly OwnedMeta[];
  /** Deterministic improvement override by candidate name. */
  readonly improvements?: ReadonlyMap<string, number>;
  /** Default improvement when not overridden. */
  readonly defaultImprovement?: number;
  readonly faults?: readonly HarnessFault[];
};

/**
 * In-memory DbPort for DST. Deterministic given seed + fault schedule.
 */
export class HarnessDb implements DbPort {
  private readonly clock: Clock;
  private tables: TableInfo[];
  private indexes: IndexInfo[];
  private scans: Map<string, number>;
  private metas: Map<string, OwnedMeta>;
  private improvements: Map<string, number>;
  private defaultImprovement: number;
  private faults: HarnessFault[];
  private callCount = 0;
  /** External actor mutations recorded for invariant checks. */
  readonly externalMutations: string[] = [];

  constructor(opts: HarnessDbOptions) {
    assert.ok(opts.clock !== undefined, 'HarnessDb: clock required');
    this.clock = opts.clock;
    const tables = opts.tables ?? [];
    assertWithinLimit(tables.length, LIMITS.maxHarnessTables, 'harness tables');
    this.tables = tables.map((t) => ({
      name: t.name,
      estimatedRows: t.estimatedRows,
    }));
    const indexes = opts.indexes ?? [];
    assertWithinLimit(
      indexes.length,
      LIMITS.maxHarnessIndexes,
      'harness indexes'
    );
    this.indexes = indexes.map((i) => ({ ...i.info }));
    this.scans = new Map();
    for (let i = 0; i < indexes.length; i++) {
      this.scans.set(indexes[i]!.info.name, indexes[i]!.scans);
    }
    this.metas = new Map();
    for (const m of opts.metas ?? []) {
      this.metas.set(m.name, m);
    }
    this.improvements = new Map(opts.improvements ?? []);
    this.defaultImprovement = opts.defaultImprovement ?? 10;
    assertWithinLimit(
      (opts.faults ?? []).length,
      LIMITS.maxFaultSchedule,
      'fault schedule'
    );
    this.faults = [...(opts.faults ?? [])];
  }

  private async applyFault(phase: string): Promise<void> {
    this.callCount += 1;
    const fault = this.faults.find(
      (f) => f.onCall === undefined || f.onCall === this.callCount
    );
    if (fault === undefined || fault.kind === 'none') return;
    if (fault.kind === 'transient') {
      throw new Error(`harness transient failure at ${phase}`);
    }
    if (phase !== 'execute') return;
    if (fault.kind === 'lock_timeout') {
      const err = new Error('harness lock_timeout');
      err.name = 'LockTimeout';
      throw err;
    }
    if (fault.kind === 'crash_before' || fault.kind === 'crash_inside') {
      throw new HarnessCrashError(`harness crash at ${phase}`);
    }
  }

  parseStatement(sql: string): ParsedStatement {
    assert.ok(sql.length > 0, 'sql required');
    return parseWithNodeSqlParser(sql, 'Sqlite');
  }

  async introspectIndexes(): Promise<IndexInfo[]> {
    await this.applyFault('introspectIndexes');
    return sortByName(this.indexes.map((i) => ({ ...i })));
  }

  async introspectTables(): Promise<TableInfo[]> {
    await this.applyFault('introspectTables');
    return sortByName(this.tables.map((t) => ({ ...t })));
  }

  async readIndexUsage(): Promise<UsageInfo[]> {
    await this.applyFault('readIndexUsage');
    const out: UsageInfo[] = [];
    for (const [name, scans] of this.scans) {
      out.push({ name, scans });
    }
    return sortByName(out);
  }

  async readOwnedMeta(): Promise<OwnedMeta[]> {
    await this.applyFault('readOwnedMeta');
    return sortByName([...this.metas.values()]);
  }

  async writeOwnedMeta(m: OwnedMeta): Promise<void> {
    assert.ok(isOwnedName(m.name), 'writeOwnedMeta: must be owned name');
    await this.applyFault('writeOwnedMeta');
    if (m.payload.length === 0 && m.deprecatedAt == null) {
      this.metas.delete(m.name);
      return;
    }
    this.metas.set(m.name, m);
  }

  async evaluateCandidates(
    _stmts: readonly Stmt[],
    cands: readonly Candidate[]
  ): Promise<Eval[]> {
    await this.applyFault('evaluateCandidates');
    assertWithinLimit(
      cands.length,
      LIMITS.maxStatements * LIMITS.maxCandidatesPerStatement,
      'eval candidates'
    );
    const out: Eval[] = [];
    for (let i = 0; i < cands.length; i++) {
      const c = cands[i]!;
      const table = this.tables.find((t) => t.name === c.definition.table);
      const rows = table?.estimatedRows ?? 0;
      const improvement =
        this.improvements.get(c.name) ??
        (rows >= 10_000 ? this.defaultImprovement : 1);
      out.push({
        candidateName: c.name,
        improvement,
        baselineCost: 1000,
        withIndexCost: 1000 / Math.max(improvement, 0.001),
        lowConfidence: false,
      });
    }
    return out;
  }

  async execute(action: PlanAction, deadline: number): Promise<ActionResult> {
    if (!isOwnedName(action.name)) {
      throw new Error(`execute: owned name only (got ${action.name})`);
    }
    if (action.name.startsWith('ix_') || action.name.startsWith('ux_')) {
      throw new Error('execute: never touch db-schema indexes');
    }
    const now = this.clock.now();
    assert.ok(now <= deadline + 1, 'execute past deadline');

    try {
      await this.applyFault('execute');
    } catch (err) {
      if (err instanceof HarnessCrashError) {
        return { status: 'crashed', reason: err.message };
      }
      if (err instanceof Error && err.name === 'LockTimeout') {
        return { status: 'deferred', reason: 'lock_timeout' };
      }
      throw err;
    }

    return this.applyExecute(action);
  }

  private applyExecute(action: PlanAction): ActionResult {
    switch (action.kind) {
      case 'create': {
        assert.ok(action.definition !== null, 'create needs definition');
        const name = ownedIndexName(action.definition);
        assert.ok(name === action.name, 'create name must match definition');
        this.indexes.push({
          name,
          table: action.definition.table,
          columns: action.definition.columns.map((c) => c.name),
          include: [...action.definition.include],
          predicate: action.definition.predicate,
          isUnique: false,
          isPrimary: false,
          isValid: true,
          isOwned: true,
        });
        this.scans.set(name, 0);
        return { status: 'ok' };
      }
      case 'drop': {
        this.indexes = this.indexes.filter((i) => i.name !== action.name);
        this.scans.delete(action.name);
        this.metas.delete(action.name);
        return { status: 'ok' };
      }
      case 'repair_invalid': {
        this.indexes = this.indexes.filter((i) => i.name !== action.name);
        return { status: 'ok' };
      }
      case 'deprecate':
      case 'clear_deprecation':
        return { status: 'ok' };
    }
  }

  /** Test helper: inject an invalid owned index. */
  markInvalid(name: string): void {
    assert.ok(isOwnedName(name), 'markInvalid: owned');
    const idx = this.indexes.findIndex((i) => i.name === name);
    assert.ok(idx >= 0, 'index exists');
    const ix = this.indexes[idx]!;
    this.indexes[idx] = { ...ix, isValid: false };
  }

  /** Concurrent external actor: add/drop non-owned or illegally owned. */
  externalAddIndex(info: IndexInfo): void {
    assertWithinLimit(
      this.indexes.length + 1,
      LIMITS.maxHarnessIndexes,
      'external add'
    );
    this.indexes.push({ ...info });
    this.externalMutations.push(`add:${info.name}`);
  }

  externalDropIndex(name: string): void {
    this.indexes = this.indexes.filter((i) => i.name !== name);
    this.externalMutations.push(`drop:${name}`);
  }

  bumpScans(name: string, delta: number): void {
    assert.ok(delta >= 0, 'delta >= 0');
    this.scans.set(name, (this.scans.get(name) ?? 0) + delta);
  }

  setTableRows(name: string, rows: number): void {
    assert.ok(rows >= 0, 'rows >= 0');
    const idx = this.tables.findIndex((x) => x.name === name);
    if (idx >= 0) {
      this.tables[idx] = { name, estimatedRows: rows };
    } else {
      this.tables.push({ name, estimatedRows: rows });
    }
  }

  getOwnedIndexNames(): string[] {
    return this.indexes
      .filter((i) => i.isOwned || isOwnedName(i.name))
      .map((i) => i.name);
  }

  /**
   * Deep-ish fork for crash-convergence: fault-free reconcile from a snapshot.
   * Call count resets; fault schedule cleared.
   */
  fork(clock: Clock = this.clock): HarnessDb {
    return new HarnessDb({
      clock,
      tables: this.tables.map((t) => ({
        name: t.name,
        estimatedRows: t.estimatedRows,
      })),
      indexes: this.indexes.map((info) => ({
        info: { ...info },
        scans: this.scans.get(info.name) ?? 0,
      })),
      metas: [...this.metas.values()].map((m) => ({ ...m })),
      improvements: new Map(this.improvements),
      defaultImprovement: this.defaultImprovement,
      faults: [],
    });
  }
}

import { assert } from '@pkgs/assert-root-shared/singleton';
import type { Clock } from '@pkgs/clock-shared/types';
import { parseWithNodeSqlParser } from '@pkgs/db-indexes-root-shared/parse-node-sql';
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
} from '@pkgs/db-indexes-root-shared/types';

export type RecordingPortSeed = {
  readonly indexes: readonly IndexInfo[];
  readonly tables: readonly TableInfo[];
  readonly usage: readonly UsageInfo[];
  readonly metas: readonly OwnedMeta[];
  /** Eval responses keyed by candidate name; missing → defaultImprovement. */
  readonly evals?: ReadonlyMap<string, Eval>;
  readonly defaultImprovement?: number;
};

/**
 * Pure canned DbPort for analyzer PBT — no mutable side effects on introspect.
 * execute/writeOwnedMeta record calls but do not mutate canned views unless
 * `mutable` is true (idempotence tests).
 */
export class RecordingPort implements DbPort {
  private indexes: IndexInfo[];
  private tables: TableInfo[];
  private usage: UsageInfo[];
  private metas: OwnedMeta[];
  private readonly evals: Map<string, Eval>;
  private readonly defaultImprovement: number;
  private readonly mutable: boolean;
  readonly executed: PlanAction[] = [];
  readonly writtenMeta: OwnedMeta[] = [];

  constructor(seed: RecordingPortSeed, opts?: { readonly mutable?: boolean }) {
    assert.ok(seed.tables.length > 0 || seed.indexes.length === 0, 'seed ok');
    this.indexes = seed.indexes.map((i) => ({ ...i }));
    this.tables = seed.tables.map((t) => ({ ...t }));
    this.usage = seed.usage.map((u) => ({ ...u }));
    this.metas = seed.metas.map((m) => ({ ...m }));
    this.evals = new Map(seed.evals ?? []);
    this.defaultImprovement =
      opts?.mutable === true ? 10 : (seed.defaultImprovement ?? 10);
    this.mutable = opts?.mutable === true;
  }

  parseStatement(sql: string): ParsedStatement {
    return parseWithNodeSqlParser(sql, 'Sqlite');
  }

  async introspectIndexes(): Promise<IndexInfo[]> {
    return this.indexes.map((i) => ({ ...i }));
  }

  async introspectTables(): Promise<TableInfo[]> {
    return this.tables.map((t) => ({ ...t }));
  }

  async readIndexUsage(): Promise<UsageInfo[]> {
    return this.usage.map((u) => ({ ...u }));
  }

  async readOwnedMeta(): Promise<OwnedMeta[]> {
    return this.metas.map((m) => ({ ...m }));
  }

  async writeOwnedMeta(m: OwnedMeta): Promise<void> {
    this.writtenMeta.push(m);
    if (!this.mutable) return;
    const idx = this.metas.findIndex((x) => x.name === m.name);
    if (m.payload.length === 0 && m.deprecatedAt == null) {
      if (idx >= 0) this.metas.splice(idx, 1);
      return;
    }
    if (idx >= 0) this.metas[idx] = m;
    else this.metas.push(m);
  }

  async evaluateCandidates(
    _stmts: readonly Stmt[],
    cands: readonly Candidate[]
  ): Promise<Eval[]> {
    const out: Eval[] = [];
    for (let i = 0; i < cands.length; i++) {
      const c = cands[i]!;
      const canned = this.evals.get(c.name);
      if (canned !== undefined) {
        out.push(canned);
        continue;
      }
      const improvement = this.defaultImprovement;
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

  async execute(action: PlanAction, _deadline: number): Promise<ActionResult> {
    this.executed.push(action);
    if (!this.mutable) return { status: 'ok' };
    if (action.kind === 'create' && action.definition !== null) {
      this.indexes.push({
        name: action.name,
        table: action.definition.table,
        columns: action.definition.columns.map((c) => c.name),
        include: [...action.definition.include],
        predicate: action.definition.predicate,
        isUnique: false,
        isPrimary: false,
        isValid: true,
        isOwned: true,
      });
    }
    if (action.kind === 'drop' || action.kind === 'repair_invalid') {
      this.indexes = this.indexes.filter((i) => i.name !== action.name);
    }
    return { status: 'ok' };
  }
}

/** Fixed clock for analyzer purity. */
export function fixedClock(now: number): Clock {
  assert.ok(Number.isFinite(now), 'now finite');
  return { now: () => now };
}

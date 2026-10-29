import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { Config } from './config';
import { resolveConfig } from './config';
import { assertIsOwnedName, isOwnedName } from './naming';
import { planIndexes } from './plan';
import type {
  DbPort,
  PlanAction,
  ReconcileReport,
  UsageInfo,
  WorkloadManifest,
} from './types';
import { asOwnedIndexName } from './types';

function assertActionOwned(action: PlanAction): void {
  assertIsOwnedName(action.name);
  assert.ok(
    isOwnedName(action.name),
    'executor: action must target owned name'
  );
  assert.ok(
    action.kind !== 'create' || action.definition !== null,
    'create action requires definition'
  );
}

type ExecState = {
  completed: PlanAction[];
  deferred: PlanAction[];
  remaining: PlanAction[];
  failed: { readonly action: PlanAction; readonly reason: string }[];
  notes: string[];
  builds: number;
};

function appendTail(
  remaining: PlanAction[],
  actions: readonly PlanAction[],
  from: number
): void {
  for (let j = from; j < actions.length; j++) {
    remaining.push(actions[j]!);
  }
}

type UsageHolds = {
  readonly usage: UsageInfo[];
  /** Indexes whose retirement window was refreshed by a newly observed use. */
  readonly refreshed: ReadonlySet<string>;
};

async function refreshUsageHolds(
  db: DbPort,
  clock: Clock,
  notes: string[]
): Promise<UsageHolds> {
  const refreshed = new Set<string>();
  const metas = await db.readOwnedMeta();
  const usage = await db.readIndexUsage();
  for (let i = 0; i < metas.length; i++) {
    const m = metas[i]!;
    if (m.deprecatedAt == null) continue;
    const u = usage.find((x) => x.name === m.name);
    const scans = u?.scans ?? 0;
    if (m.usageAtDeprecation != null && scans > m.usageAtDeprecation) {
      notes.push(
        `USAGE_SINCE_DEPRECATION: ${m.name} scans ${String(m.usageAtDeprecation)}→${String(scans)}; window refreshed`
      );
      refreshed.add(m.name);
      await db.writeOwnedMeta({
        ...m,
        deprecatedAt: clock.now(),
        usageAtDeprecation: scans,
      });
    }
  }
  return { usage, refreshed };
}

/** A drop planned before a use was observed is stale: the window restarted. */
function withoutStaleDrops(
  actions: readonly PlanAction[],
  refreshed: ReadonlySet<string>,
  notes: string[]
): PlanAction[] {
  const live: PlanAction[] = [];
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i]!;
    if (action.kind === 'drop' && refreshed.has(action.name)) {
      notes.push(`drop cancelled ${action.name}: used during retirement`);
      continue;
    }
    live.push(action);
  }
  return live;
}

async function applyMetaAction(args: {
  readonly db: DbPort;
  readonly clock: Clock;
  readonly action: PlanAction;
  readonly usage: readonly UsageInfo[];
  readonly state: ExecState;
}): Promise<boolean> {
  if (args.action.kind === 'deprecate') {
    const u = args.usage.find((x) => x.name === args.action.name);
    await args.db.writeOwnedMeta({
      name: asOwnedIndexName(args.action.name),
      deprecatedAt: args.clock.now(),
      usageAtDeprecation: u?.scans ?? 0,
      payload: JSON.stringify({ deprecatedAt: args.clock.now() }),
    });
    args.state.completed.push(args.action);
    return true;
  }
  if (args.action.kind === 'clear_deprecation') {
    await args.db.writeOwnedMeta({
      name: asOwnedIndexName(args.action.name),
      deprecatedAt: null,
      usageAtDeprecation: null,
      payload: '{}',
    });
    args.state.completed.push(args.action);
    return true;
  }
  return false;
}

async function applyExecuteResult(args: {
  readonly db: DbPort;
  readonly action: PlanAction;
  readonly result: Awaited<ReturnType<DbPort['execute']>>;
  readonly state: ExecState;
  readonly actions: readonly PlanAction[];
  readonly index: number;
}): Promise<'continue' | 'break'> {
  if (args.result.status === 'ok') {
    args.state.completed.push(args.action);
    if (
      args.action.kind === 'create' ||
      args.action.kind === 'repair_invalid'
    ) {
      args.state.builds += 1;
    }
    if (args.action.kind === 'drop') {
      await args.db.writeOwnedMeta({
        name: asOwnedIndexName(args.action.name),
        deprecatedAt: null,
        usageAtDeprecation: null,
        payload: '',
      });
    }
    return 'continue';
  }
  if (args.result.status === 'deferred') {
    args.state.deferred.push(args.action);
    args.state.notes.push(
      `deferred ${args.action.name}: ${args.result.reason ?? 'unknown'}`
    );
    return 'continue';
  }
  if (args.result.status === 'crashed') {
    args.state.remaining.push(args.action);
    appendTail(args.state.remaining, args.actions, args.index + 1);
    args.state.notes.push(`crashed on ${args.action.name}`);
    return 'break';
  }
  args.state.failed.push({
    action: args.action,
    reason: args.result.reason ?? 'failed',
  });
  return 'continue';
}

async function runPlanActions(args: {
  readonly db: DbPort;
  readonly clock: Clock;
  readonly config: Config;
  readonly deadline: number;
  readonly actions: readonly PlanAction[];
  readonly usage: readonly UsageInfo[];
  readonly state: ExecState;
}): Promise<void> {
  for (let i = 0; i < args.actions.length; i++) {
    const action = args.actions[i]!;
    assertActionOwned(action);

    if (args.clock.now() + action.estimatedMs > args.deadline) {
      appendTail(args.state.remaining, args.actions, i);
      args.state.notes.push('deadline: stopped with remaining actions');
      return;
    }

    const isBuild =
      action.kind === 'create' || action.kind === 'repair_invalid';
    if (isBuild && args.state.builds >= args.config.maxBuildsPerRun) {
      args.state.remaining.push(action);
      appendTail(args.state.remaining, args.actions, i + 1);
      args.state.notes.push('maxBuildsPerRun reached');
      return;
    }

    if (
      await applyMetaAction({
        db: args.db,
        clock: args.clock,
        action,
        usage: args.usage,
        state: args.state,
      })
    ) {
      continue;
    }

    const result = await args.db.execute(action, args.deadline);
    const next = await applyExecuteResult({
      db: args.db,
      action,
      result,
      state: args.state,
      actions: args.actions,
      index: i,
    });
    if (next === 'break') return;
  }
}

/**
 * Analyze + execute within budgets. Resumable; crash-safe.
 * Same inputs + same port responses ⇒ same outputs (byte-identical).
 */
export async function reconcileIndexes(args: {
  readonly manifest: WorkloadManifest;
  readonly db: DbPort;
  readonly clock: Clock;
  readonly config?: Partial<Config>;
  readonly deadlineMs?: number;
}): Promise<ReconcileReport> {
  assert.ok(args.manifest !== undefined, 'manifest required');
  assert.ok(args.db !== undefined, 'db required');
  assert.ok(args.clock !== undefined, 'clock required');

  const config = resolveConfig(args.config);
  const start = args.clock.now();
  assert.ok(Number.isFinite(start), 'clock.now must be finite');
  const deadlineMs = args.deadlineMs ?? config.defaultDeadlineMs;
  assert.ok(deadlineMs > 0, 'deadlineMs must be > 0');
  const deadline = start + deadlineMs;

  const plan = await planIndexes({
    manifest: args.manifest,
    db: args.db,
    clock: args.clock,
    config,
  });

  const state: ExecState = {
    completed: [],
    deferred: [],
    remaining: [],
    failed: [],
    notes: [],
    builds: 0,
  };

  const { usage, refreshed } = await refreshUsageHolds(
    args.db,
    args.clock,
    state.notes
  );
  await runPlanActions({
    db: args.db,
    clock: args.clock,
    config,
    deadline,
    actions: withoutStaleDrops(plan.actions, refreshed, state.notes),
    usage,
    state,
  });

  const end = args.clock.now();
  assert.ok(
    end <= deadline + config.createEstimatedMs,
    'executor exceeded deadline by more than one action'
  );

  return {
    plan,
    completed: state.completed,
    deferred: state.deferred,
    remaining: state.remaining,
    failed: state.failed,
    notes: state.notes,
  };
}

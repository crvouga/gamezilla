import { assert } from '@pkgs/assert';
import type { Clock } from '@pkgs/clock';
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

async function refreshUsageHolds(
  db: DbPort,
  clock: Clock,
  notes: string[]
): Promise<UsageInfo[]> {
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
      await db.writeOwnedMeta({
        ...m,
        deprecatedAt: clock.now(),
        usageAtDeprecation: scans,
      });
    }
  }
  return usage;
}

async function applyMetaAction(
  db: DbPort,
  clock: Clock,
  action: PlanAction,
  usage: readonly UsageInfo[],
  state: ExecState
): Promise<boolean> {
  if (action.kind === 'deprecate') {
    const u = usage.find((x) => x.name === action.name);
    await db.writeOwnedMeta({
      name: asOwnedIndexName(action.name),
      deprecatedAt: clock.now(),
      usageAtDeprecation: u?.scans ?? 0,
      payload: JSON.stringify({ deprecatedAt: clock.now() }),
    });
    state.completed.push(action);
    return true;
  }
  if (action.kind === 'clear_deprecation') {
    await db.writeOwnedMeta({
      name: asOwnedIndexName(action.name),
      deprecatedAt: null,
      usageAtDeprecation: null,
      payload: '{}',
    });
    state.completed.push(action);
    return true;
  }
  return false;
}

async function applyExecuteResult(
  db: DbPort,
  action: PlanAction,
  result: Awaited<ReturnType<DbPort['execute']>>,
  state: ExecState,
  actions: readonly PlanAction[],
  index: number
): Promise<'continue' | 'break'> {
  if (result.status === 'ok') {
    state.completed.push(action);
    if (action.kind === 'create' || action.kind === 'repair_invalid') {
      state.builds += 1;
    }
    if (action.kind === 'drop') {
      await db.writeOwnedMeta({
        name: asOwnedIndexName(action.name),
        deprecatedAt: null,
        usageAtDeprecation: null,
        payload: '',
      });
    }
    return 'continue';
  }
  if (result.status === 'deferred') {
    state.deferred.push(action);
    state.notes.push(`deferred ${action.name}: ${result.reason ?? 'unknown'}`);
    return 'continue';
  }
  if (result.status === 'crashed') {
    state.remaining.push(action);
    appendTail(state.remaining, actions, index + 1);
    state.notes.push(`crashed on ${action.name}`);
    return 'break';
  }
  state.failed.push({ action, reason: result.reason ?? 'failed' });
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

    if (await applyMetaAction(args.db, args.clock, action, args.usage, args.state)) {
      continue;
    }

    const result = await args.db.execute(action, args.deadline);
    const next = await applyExecuteResult(
      args.db,
      action,
      result,
      args.state,
      args.actions,
      i
    );
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

  const usage = await refreshUsageHolds(args.db, args.clock, state.notes);
  await runPlanActions({
    db: args.db,
    clock: args.clock,
    config,
    deadline,
    actions: plan.actions,
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

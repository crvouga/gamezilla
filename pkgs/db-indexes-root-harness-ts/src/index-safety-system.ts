import { isOwnedName } from '@pkgs/db-indexes-root-shared-ts/naming';
import { planIndexes } from '@pkgs/db-indexes-root-shared-ts/plan';
import { reconcileIndexes } from '@pkgs/db-indexes-root-shared-ts/reconcile';
import type {
  DbPort,
  IndexPlan,
  PlanAction,
  ReconcileReport,
} from '@pkgs/db-indexes-root-shared-ts/types';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { defineProperty } from '@pkgs/harness-root-shared-ts/define-property';
import { defineRuntime } from '@pkgs/harness-root-shared-ts/define-runtime';
import { defineSystem } from '@pkgs/harness-root-shared-ts/define-system';
import type { Session } from '@pkgs/harness-root-shared-ts/runtime-types';
import { virtualTimeRuntime } from '@pkgs/harness-root-shared-ts/virtual-time-runtime';
import { createHarnessClock } from './clock';
import { HarnessCrashError } from './crash-error';
import { HarnessDb } from './db';
import { mixedSafetyFixture } from './index-mixed-fixture';
import { planningFixture } from './index-planning-fixtures';
import type { SafetyFixture } from './index-safety-fixtures';
import {
  SAFETY_DAY_MS,
  SAFETY_NOW,
  safetyFixture,
} from './index-safety-fixtures';

export type IndexSafety = {
  readonly session: Session;
  clock: ReturnType<typeof createHarnessClock>;
  db: HarnessDb;
  fixture: SafetyFixture;
  deadlineMs: number;
  faultConsumed: boolean;
  writes: string[];
  report: ReconcileReport | null;
  plan: IndexPlan | null;
  before: string;
  interruptAt: number | null;
  interruptAfter: boolean;
  error: string | null;
};

export async function safetySnapshot(s: IndexSafety): Promise<string> {
  return JSON.stringify({
    indexes: await s.db.introspectIndexes(),
    metas: await s.db.readOwnedMeta(),
    usage: await s.db.readIndexUsage(),
  });
}

async function interruptedWrite<T>(
  s: IndexSafety,
  fn: () => Promise<T>
): Promise<T> {
  const interrupt = s.interruptAt === s.writes.length;
  if (interrupt && !s.interruptAfter)
    throw new HarnessCrashError('before persisted write');
  const result = await fn();
  if (interrupt && s.interruptAfter)
    throw new HarnessCrashError('after persisted write');
  return result;
}

async function executeSafetyAction(
  s: IndexSafety,
  action: PlanAction,
  deadline: number
) {
  s.writes.push(`${action.kind}:${action.name}`);
  const fault = s.faultConsumed ? 'none' : s.fixture.fault;
  s.faultConsumed = true;
  if (fault === 'before')
    return { status: 'crashed' as const, reason: 'before commit' };
  if (fault === 'deferred')
    return { status: 'deferred' as const, reason: 'lock_timeout' };
  if (fault === 'failed')
    return { status: 'failed' as const, reason: 'build rejected' };
  const result = await interruptedWrite(s, () =>
    s.db.execute(action, deadline)
  ).catch((error: unknown) => {
    if (!(error instanceof HarnessCrashError)) throw error;
    return { status: 'crashed' as const, reason: error.message };
  });
  if (fault === 'invalid') s.db.markInvalid(action.name);
  if (fault === 'after' || fault === 'invalid')
    return { status: 'crashed' as const, reason: 'after commit' };
  return result;
}

function safetyPort(s: IndexSafety): DbPort {
  return {
    introspectIndexes: () => s.db.introspectIndexes(),
    introspectTables: () => s.db.introspectTables(),
    readOwnedMeta: () => s.db.readOwnedMeta(),
    readIndexUsage: () =>
      s.fixture.missingUsage ? Promise.resolve([]) : s.db.readIndexUsage(),
    parseStatement: (sql) => s.db.parseStatement(sql),
    evaluateCandidates: (statements, candidates) =>
      s.db.evaluateCandidates(statements, candidates),
    writeOwnedMeta: (meta) => {
      s.writes.push(`meta:${meta.name}`);
      return interruptedWrite(s, () => s.db.writeOwnedMeta(meta));
    },
    execute: (action, deadline) => executeSafetyAction(s, action, deadline),
  };
}

export const selectSafetyFixture = defineAction({
  name: 'select-safety-fixture',
  act: async (s: IndexSafety, name: string) => {
    s.fixture =
      name === 'mixed reconciliation'
        ? mixedSafetyFixture()
        : (planningFixture(name) ?? safetyFixture(name));
    s.clock = createHarnessClock(SAFETY_NOW);
    s.db = new HarnessDb({ ...s.fixture.seed, clock: s.clock });
    s.deadlineMs = 60_000;
    s.faultConsumed = false;
    s.writes = [];
    s.report = null;
    s.plan = null;
    s.interruptAt = null;
    s.interruptAfter = false;
    s.error = null;
    s.before = await safetySnapshot(s);
  },
});

export const setRetirementAge = defineAction({
  name: 'set-retirement-age',
  act: (s: IndexSafety, days: number) => {
    s.clock = createHarnessClock(days * SAFETY_DAY_MS);
    s.db = s.db.fork(s.clock);
  },
});

export const setRunBudget = defineAction({
  name: 'set-run-budget',
  act: (s: IndexSafety, milliseconds: number) => {
    s.deadlineMs = milliseconds;
  },
});

export const runSafetyReconcile = defineAction({
  name: 'run-safety-reconcile',
  act: async (s: IndexSafety) => {
    s.writes = [];
    s.report = await reconcileIndexes({
      manifest: s.fixture.manifest,
      db: safetyPort(s),
      clock: s.clock,
      config: s.fixture.config,
      deadlineMs: s.deadlineMs,
    }).catch((error: unknown) => {
      if (!(error instanceof HarnessCrashError)) throw error;
      s.error = error.message;
      return null;
    });
  },
});

export const setWriteInterruption = defineAction({
  name: 'set-write-interruption',
  act: (s: IndexSafety, position: number, after: boolean) => {
    s.interruptAt = position;
    s.interruptAfter = after;
  },
});

export const resumeSafetyReconcile = defineAction({
  name: 'resume-safety-reconcile',
  act: async (s: IndexSafety) => {
    s.db = s.db.fork(s.clock);
    s.faultConsumed = true;
    s.interruptAt = null;
    s.writes = [];
    s.error = null;
    s.report = await reconcileIndexes({
      manifest: s.fixture.manifest,
      db: safetyPort(s),
      clock: s.clock,
      config: s.fixture.config,
      deadlineMs: s.deadlineMs,
    });
  },
});

export const runSafetyPlan = defineAction({
  name: 'run-safety-plan',
  act: async (s: IndexSafety) => {
    s.plan = await planIndexes({
      manifest: s.fixture.manifest,
      db: safetyPort(s),
      clock: s.clock,
      config: s.fixture.config,
    });
  },
});

const protectedIndexesHold = defineProperty({
  name: 'protected-indexes-hold',
  check: async (s: IndexSafety) => {
    const indexes = await s.db.introspectIndexes();
    for (const original of s.fixture.protected) {
      const current = indexes.find((ix) => ix.name === original.name);
      if (JSON.stringify(current) !== JSON.stringify(original)) {
        throw new Error(`protected index changed: ${original.name}`);
      }
    }
    const actions = s.report?.plan.actions ?? s.plan?.actions ?? [];
    if (actions.some((action) => !isOwnedName(action.name))) {
      throw new Error('planned action outside ownership');
    }
  },
});

export const indexSafetySystem = defineSystem<IndexSafety>({
  name: 'db-indexes.index-safety',
  create(session) {
    const fixture = safetyFixture('new build');
    const clock = createHarnessClock(SAFETY_NOW);
    return {
      session,
      fixture,
      clock,
      db: new HarnessDb({ ...fixture.seed, clock }),
      deadlineMs: 60_000,
      faultConsumed: false,
      writes: [],
      report: null,
      plan: null,
      before: '',
      interruptAt: null,
      interruptAfter: false,
      error: null,
    };
  },
  runtimes: [
    defineRuntime({
      default: true,
      name: 'virtual',
      create: () => virtualTimeRuntime(),
    }),
  ],
  actions: [
    selectSafetyFixture,
    setRetirementAge,
    setRunBudget,
    setWriteInterruption,
    runSafetyReconcile,
    resumeSafetyReconcile,
    runSafetyPlan,
  ],
  properties: [protectedIndexesHold],
});

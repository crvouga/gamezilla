import { SAFETY_INDEX } from '@pkgs/db-indexes-root-harness/index-safety-fixtures';
import type { IndexSafety } from '@pkgs/db-indexes-root-harness/index-safety-system';
import {
  indexSafetySystem,
  resumeSafetyReconcile,
  runSafetyReconcile,
  safetySnapshot,
  selectSafetyFixture,
} from '@pkgs/db-indexes-root-harness/index-safety-system';
import type { Run } from '@pkgs/harness-root-shared/run-types';
import type { QuintBinding, QuintWorld } from '@pkgs/quint-shared/registry';

type World = { readonly run: Run<IndexSafety> };
const FIXTURES: Readonly<Record<string, string>> = {
  before: 'crash before build',
  after: 'crash after build',
  invalid: 'crash invalid build',
  deferred: 'lock contention',
  failed: 'failed build',
  success: 'new build',
};
export const interruptionWorld: QuintWorld<World> = {
  create: async () => ({ run: await indexSafetySystem.run({ seed: 424242 }) }),
  dispose: (world) => world.run[Symbol.asyncDispose](),
};
export const interruptionBinding: QuintBinding<World> = {
  model: 'index-interruption',
  traces: 80,
  maxSteps: 25,
  verifySteps: 4,
  actions: {
    init: async () => {},
    attempt: async (world, picks) => {
      await world.run.apply(
        selectSafetyFixture,
        FIXTURES[String(picks['outcome'])]!
      );
      await world.run.apply(runSafetyReconcile);
    },
    recover: async (world) => {
      await world.run.apply(resumeSafetyReconcile);
    },
    repeat: (world) => world.run.apply(resumeSafetyReconcile),
  },
  observe: async (world) => {
    const indexes = await world.run.read((s) => s.db.introspectIndexes());
    const report = await world.run.read((s) => s.report);
    const index = indexes.find((ix) => ix.name === SAFETY_INDEX);
    return {
      state:
        index === undefined ? 'absent' : index.isValid ? 'valid' : 'invalid',
      unfinished: (report?.remaining.length ?? 0) > 0,
      deferred: (report?.deferred.length ?? 0) > 0,
      failed: (report?.failed.length ?? 0) > 0,
      completed:
        report !== null &&
        report.remaining.length === 0 &&
        report.deferred.length === 0 &&
        report.failed.length === 0,
      protectedIndex: indexes.some(
        (ix) => ix.name === 'ix_notes_title' && ix.isValid
      ),
    };
  },
  fingerprint: (world) => world.run.read(safetySnapshot),
};

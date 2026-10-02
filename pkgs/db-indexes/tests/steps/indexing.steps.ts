import { expect } from 'bun:test';
import {
  type IndexSafety,
  indexSafetySystem,
  resumeSafetyReconcile,
  runSafetyPlan,
  runSafetyReconcile,
  SAFETY_INDEX,
  safetySnapshot,
  selectSafetyFixture,
  setRetirementAge,
  setRunBudget,
  setWriteInterruption,
} from '@pkgs/db-indexes/harness';
import { setWorld, stepsFor } from '@pkgs/gherkin/registry';
import type { Run } from '@pkgs/harness';

type World = Run<IndexSafety>;
const { Given, When, Then } = stepsFor<World>();
setWorld<World>({
  create: () => indexSafetySystem.run({ seed: 424242 }),
  dispose: (world) => world[Symbol.asyncDispose](),
});

Given('the indexing fixture is {string}', (world, name: string) =>
  world.apply(selectSafetyFixture, name)
);
Given('the retirement age is {int} days', (world, days: number) =>
  world.apply(setRetirementAge, days)
);
Given('the run budget is {int} milliseconds', (world, budget: number) =>
  world.apply(setRunBudget, budget)
);
Given('an interrupted run has occurred', (world) =>
  world.apply(runSafetyReconcile)
);
Given('a successful run has occurred', (world) =>
  world.apply(runSafetyReconcile)
);
When('the reconciler runs', (world) => world.apply(runSafetyReconcile));
Given(
  'a run was interrupted before write {int}',
  async (world, position: number) => {
    await world.apply(setWriteInterruption, position, false);
    await world.apply(runSafetyReconcile);
    expect(await world.read((s) => s.writes.length)).toBe(position);
    expect(
      await world.read(
        (s) => s.error !== null || (s.report?.remaining.length ?? 0) > 0
      )
    ).toBe(true);
  }
);
Given(
  'a run was interrupted after write {int}',
  async (world, position: number) => {
    await world.apply(setWriteInterruption, position, true);
    await world.apply(runSafetyReconcile);
    expect(await world.read((s) => s.writes.length)).toBe(position);
    expect(
      await world.read(
        (s) => s.error !== null || (s.report?.remaining.length ?? 0) > 0
      )
    ).toBe(true);
  }
);
When('the reconciler plans', (world) => world.apply(runSafetyPlan));
When('a fresh reconciler runs', (world) => world.apply(resumeSafetyReconcile));

Then('the owned index is present', async (world) => {
  expect(await world.read((s) => s.db.introspectIndexes())).toContainEqual(
    expect.objectContaining({ name: SAFETY_INDEX })
  );
});
Then('the owned index is absent', async (world) => {
  const indexes = await world.read((s) => s.db.introspectIndexes());
  expect(indexes.some((ix) => ix.name === SAFETY_INDEX)).toBe(false);
});
Then('every protected index is unchanged', async (world) => {
  const indexes = await world.read((s) => s.db.introspectIndexes());
  const protectedIndexes = await world.read((s) => s.fixture.protected);
  expect(
    indexes.filter((ix) =>
      protectedIndexes.some((original) => original.name === ix.name)
    )
  ).toEqual([...protectedIndexes]);
});
Then('no action targets a protected index', async (world) => {
  const targets = await world.read((s) =>
    s.report!.plan.actions.map((a) => a.name as string)
  );
  const protectedNames = await world.read((s) =>
    s.fixture.protected.map((ix) => ix.name)
  );
  expect(targets.filter((name) => protectedNames.includes(name))).toEqual([]);
});
Then('the database snapshot is unchanged', async (world) => {
  expect(await world.read(safetySnapshot)).toBe(
    await world.read((s) => s.before)
  );
});
Then('no write was attempted', async (world) => {
  expect(await world.read((s) => s.writes)).toEqual([]);
});
Then('no removal was attempted', async (world) => {
  expect(
    await world.read((s) =>
      s.writes.filter((write) => write.startsWith('drop:'))
    )
  ).toEqual([]);
});
Then('the retirement window starts now', async (world) => {
  const meta = await world.read(async (s) =>
    (await s.db.readOwnedMeta()).find((m) => m.name === SAFETY_INDEX)
  );
  expect(meta?.deprecatedAt).toBe(await world.read((s) => s.clock.now()));
  const usage = await world.read((s) => s.db.readIndexUsage());
  expect(meta?.usageAtDeprecation).toBe(
    usage.find((u) => u.name === SAFETY_INDEX)?.scans
  );
});
Then('the owned index is not retiring', async (world) => {
  const metas = await world.read((s) => s.db.readOwnedMeta());
  expect(metas.find((m) => m.name === SAFETY_INDEX)?.deprecatedAt).toBeNull();
});
Then('the owned index is retiring', async (world) => {
  const metas = await world.read((s) => s.db.readOwnedMeta());
  expect(metas.find((m) => m.name === SAFETY_INDEX)?.deprecatedAt).toBe(0);
});
Then('the run reports unfinished work', async (world) => {
  expect(await world.read((s) => s.report!.remaining.length)).toBeGreaterThan(
    0
  );
});
Then('the run has no unfinished work', async (world) => {
  expect(await world.read((s) => s.report!.remaining)).toEqual([]);
});
Then(
  'the run does not report the interrupted action as completed',
  async (world) => {
    expect(await world.read((s) => s.report!.completed)).toEqual([]);
  }
);
Then('exactly one valid desired index exists', async (world) => {
  const indexes = await world.read((s) => s.db.introspectIndexes());
  expect(indexes.filter((ix) => ix.isOwned)).toEqual([
    expect.objectContaining({ name: SAFETY_INDEX, isValid: true }),
  ]);
});
Then('both desired indexes are valid', async (world) => {
  const indexes = await world.read((s) => s.db.introspectIndexes());
  const owned = indexes.filter((ix) => ix.isOwned);
  expect(owned).toHaveLength(2);
  expect(owned.every((ix) => ix.isValid)).toBe(true);
});
Then('the run reports a deferred action with its reason', async (world) => {
  expect(await world.read((s) => s.report!.deferred)).toHaveLength(1);
  expect(await world.read((s) => s.report!.notes)).toContainEqual(
    expect.stringContaining('lock_timeout')
  );
  expect(await world.read((s) => s.report!.completed)).toEqual([]);
});
Then('the run reports a failed action with its reason', async (world) => {
  expect(await world.read((s) => s.report!.failed)).toEqual([
    expect.objectContaining({ reason: 'build rejected' }),
  ]);
  expect(await world.read((s) => s.report!.completed)).toEqual([]);
});
Then('the run reports one completed action', async (world) => {
  expect(await world.read((s) => s.report!.completed)).toHaveLength(1);
});
Then('the plan has {int} desired indexes', async (world, count: number) => {
  expect(await world.read((s) => s.plan!.desired)).toHaveLength(count);
});
Then(
  'the plan explains the exclusion as {string}',
  async (world, reason: string) => {
    expect(await world.read((s) => s.plan!.skipped)).toContainEqual(
      expect.objectContaining({ reason })
    );
  }
);
Then('the plan has no exclusions', async (world) => {
  expect(await world.read((s) => s.plan!.skipped)).toEqual([]);
});
Then('the mixed reconciliation has converged', async (world) => {
  const indexes = await world.read((s) => s.db.introspectIndexes());
  const owned = indexes.filter((ix) => ix.isOwned);
  expect(owned.map((ix) => ix.columns[0]).sort()).toEqual([
    'body',
    'owner_id',
    'user_id',
  ]);
  expect(owned.every((ix) => ix.isValid)).toBe(true);
  const metas = await world.read((s) => s.db.readOwnedMeta());
  const retiring = metas.filter((m) => m.deprecatedAt !== null);
  expect(retiring).toHaveLength(1);
  expect(indexes.find((ix) => ix.name === retiring[0]!.name)?.columns).toEqual([
    'body',
  ]);
  expect(await world.read((s) => s.report!.remaining)).toEqual([]);
  expect(await world.read((s) => s.report!.failed)).toEqual([]);
});

import { expect, test } from 'bun:test';
import {
  type ScenarioContext,
  setWorld,
  worldLifecycle,
} from '@pkgs/gherkin/registry';

const context = (uri: string): ScenarioContext => ({
  packageName: '@example/tools',
  featureUri: uri,
  featureName: 'Investigate',
  scenarioName: 'Open',
  scenarioLine: 1,
  tags: [],
  testId: 'open',
});
test('two scoped worlds keep their own lifecycle', async () => {
  // regression: gherkin-mixed-host-world
  const disposed: string[] = [];
  setWorld({
    matches: (ctx) => ctx.featureUri.startsWith('world-selection/tools/'),
    create: async () => 'harness',
    dispose: async (world) => {
      disposed.push(world);
    },
  });
  setWorld({
    matches: (ctx) => ctx.featureUri.startsWith('world-selection/live/'),
    create: async () => 'live',
    dispose: async (world) => {
      disposed.push(world);
    },
  });
  const harnessCtx = context('world-selection/tools/checkpoint.feature');
  const liveCtx = context('world-selection/live/availability.feature');
  const harness = worldLifecycle(harnessCtx);
  const live = worldLifecycle(liveCtx);
  expect(await harness.create(harnessCtx)).toBe('harness');
  expect(await live.create(liveCtx)).toBe('live');
  await harness.dispose('harness');
  await live.dispose('live');
  expect(disposed).toEqual(['harness', 'live']);
});

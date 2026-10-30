import { expect, test } from 'bun:test';
import { matchStep, worldLifecycle } from '@pkgs/gherkin-shared-ts/registry';
import { noteBodies } from '@pkgs/sync-engine-harness-ts/reads';
import './steps/index';
import type { SyncWorld } from './steps/world';

async function existingStep(world: SyncWorld, text: string): Promise<void> {
  const matched = matchStep(text);
  if (matched.kind !== 'match') throw new Error(`Expected one step: ${text}`);
  await matched.definition.body(world, ...matched.args);
}

// regression: note-observation-starts-after-fast-delivery
test('seed 1 retains writing observations when both peers finish delivery before the Then begins', async () => {
  const context = {
    packageName: '@pkgs/sync-engine-harness-ts',
    featureUri: 'specs/sync-engine/note-writing.feature',
    featureName: 'Write a note',
    scenarioName:
      'However live updates are lost, repeated and delayed, nobody sees a note go back to what it said before',
    scenarioLine: 57,
    tags: [],
    testId: 'note-observation-fast-delivery',
  };
  const lifecycle = worldLifecycle(context);
  const world = (await lifecycle.create(context)) as SyncWorld;
  try {
    await existingStep(world, 'Alice and Bob are in the shared space "Trip"');
    await existingStep(
      world,
      'live updates to Alice and Bob are lost, repeated and delayed at random'
    );
    await existingStep(world, 'Alice and Bob keep writing notes');
    await world.s.until((s) => noteBodies(s, ['alice', 'bob']), {
      maxMs: 3000,
      pred: (rows) =>
        rows['alice/bob-note'] === 'bob 10' &&
        rows['bob/alice-note'] === 'alice 10',
    });
    expect(world.noteWatch?.changes()).toBeGreaterThan(0);
    await existingStep(
      world,
      'neither Alice nor Bob ever sees a note go back to what it said before'
    );
  } finally {
    await lifecycle.dispose(world);
  }
});

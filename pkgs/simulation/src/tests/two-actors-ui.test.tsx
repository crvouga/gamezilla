import { describe, expect, test } from 'bun:test';
import { by, expectText, expectVisible } from '@pkgs/ui-testing';

import { openSimulation } from '../open-simulation';
import { createDemoSimulationSystem } from './fixtures/demo-system';

describe('openSimulation (demo system)', () => {
  test('two actors share state and assert only via UI', async () => {
    await using sim = await openSimulation({
      seed: 1,
      system: createDemoSimulationSystem(),
    });

    expect(sim.ui).toBe('in-process');
    expect(sim.seed).toBe(1n);

    const alice = await sim.actor('alice');
    const bob = await sim.actor('bob');

    await expectVisible(alice.ui, by.testId('demo-root'));
    await expectText(alice.ui, by.testId('actor-id'), 'alice');
    await expectText(bob.ui, by.testId('actor-id'), 'bob');
    await expectText(alice.ui, by.testId('shared-title'), '(empty)');
    await expectText(bob.ui, by.testId('shared-title'), '(empty)');

    await alice.ui.tap(by.role('button', 'Create'));

    await expectText(alice.ui, by.testId('shared-title'), 'Game night (alice)');
    await expectText(bob.ui, by.testId('shared-title'), 'Game night (alice)');
  });

  test('actor() returns the same instance for the same id', async () => {
    await using sim = await openSimulation({
      seed: 'demo',
      system: createDemoSimulationSystem(),
    });
    const a1 = await sim.actor('alice');
    const a2 = await sim.actor('alice');
    expect(a1).toBe(a2);
  });

  test('clock advances deterministically', async () => {
    await using sim = await openSimulation({
      seed: 42,
      startMs: 1000,
      system: createDemoSimulationSystem(),
    });
    expect(sim.clock.now()).toBe(1000);
    sim.clock.advance(250);
    expect(sim.clock.now()).toBe(1250);
  });
});

import { describe, expect, test } from '@jest/globals';
import { by, expectText, expectVisible } from '@pkgs/ui-testing';

import { openSimulation } from '../open-simulation';
import { createDemoSimulationSystem } from './fixtures/demo-system';

describe('openSimulation (demo system)', () => {
  test('two actors share state and assert only via UI', async () => {
    const sim = await openSimulation({
      seed: 1,
      system: createDemoSimulationSystem(),
    });
    try {
      expect(sim.ui).toBe('in-process');
      expect(sim.seed).toBe(1n);

      // RNTL delivers pointer events to the most recently mounted root, so
      // interact with alice before launching bob, then assert both trees.
      const alice = await sim.actor('alice');
      await expectVisible(alice.ui, by.testId('demo-root'));
      await expectText(alice.ui, by.testId('actor-id'), 'alice');
      await expectText(alice.ui, by.testId('shared-title'), '(empty)');

      await alice.ui.tap(by.testId('create'));
      await expectText(
        alice.ui,
        by.testId('shared-title'),
        'Game night (alice)'
      );

      const bob = await sim.actor('bob');
      await expectVisible(bob.ui, by.testId('demo-root'));
      await expectText(bob.ui, by.testId('actor-id'), 'bob');
      await expectText(bob.ui, by.testId('shared-title'), 'Game night (alice)');
    } finally {
      await sim.dispose();
    }
  });

  test('actor() returns the same instance for the same id', async () => {
    const sim = await openSimulation({
      seed: 'demo',
      system: createDemoSimulationSystem(),
    });
    try {
      const a1 = await sim.actor('alice');
      const a2 = await sim.actor('alice');
      expect(a1).toBe(a2);
    } finally {
      await sim.dispose();
    }
  });

  test('clock advances deterministically', async () => {
    const sim = await openSimulation({
      seed: 42,
      startMs: 1000,
      system: createDemoSimulationSystem(),
    });
    try {
      expect(sim.clock.now()).toBe(1000);
      sim.clock.advance(250);
      expect(sim.clock.now()).toBe(1250);
    } finally {
      await sim.dispose();
    }
  });
});

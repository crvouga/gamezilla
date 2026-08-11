import { describe, expect, test } from '@jest/globals';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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

  test('report: true writes HTML timeline with UI snapshots', async () => {
    const outDir = join(
      process.cwd(),
      'simulation-report',
      'demo-report-test'
    );
    const sim = await openSimulation({
      seed: 7,
      system: createDemoSimulationSystem(),
      report: { outDir },
    });
    try {
      const alice = await sim.actor('alice');
      await alice.ui.tap(by.testId('create'));
      await expectText(
        alice.ui,
        by.testId('shared-title'),
        'Game night (alice)'
      );
    } finally {
      await sim.dispose();
    }

    expect(sim.reportPath).toBe(join(outDir, 'index.html'));
    expect(existsSync(sim.reportPath!)).toBe(true);
    const index = readFileSync(sim.reportPath!, 'utf8');
    expect(index).toContain('Simulation report');
    expect(index).toContain('tap');

    const stepsJson = JSON.parse(
      readFileSync(join(outDir, 'steps.json'), 'utf8')
    ) as {
      steps: Array<{ kind: string; snapshotFile?: string }>;
    };
    expect(stepsJson.steps.some((s) => s.kind === 'launch')).toBe(true);
    expect(stepsJson.steps.some((s) => s.kind === 'tap')).toBe(true);
    const tapStep = stepsJson.steps.find((s) => s.kind === 'tap');
    expect(tapStep?.snapshotFile).toMatch(/^snapshots\/step-\d+\.html$/);
    const snap = readFileSync(join(outDir, tapStep!.snapshotFile!), 'utf8');
    expect(snap).toContain('Game night (alice)');
  });
});

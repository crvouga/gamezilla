import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { createNodeFsObjectStore } from '@pkgs/object-store/impl-node-fs';
import { resolveLocalReportDataDir } from '@pkgs/simulation-report';

import { Simulation } from '../open-simulation';
import { DemoSimulationSystem } from './fixtures/demo-system';

describe('Simulation topology (demo system)', () => {
  test('two actors share state and assert only via UI', async () => {
    const sim = await Simulation.open({
      seed: 1,
      system: new DemoSimulationSystem(),
    });
    try {
      expect(sim.ui).toBe('in-process');
      expect(sim.seed).toBe(1n);

      const alice = await sim.actor('alice');
      await alice.ui.expect.visible('demo-root');
      await alice.ui.expect.text('actor-id', 'alice');
      await alice.ui.expect.text('shared-title', '(empty)');

      await alice.ui.tap('create');
      await alice.ui.expect.text('shared-title', 'Game night (alice)');

      const bob = await sim.actor('bob');
      await bob.ui.expect.visible('demo-root');
      await bob.ui.expect.text('actor-id', 'bob');
      await bob.ui.expect.text('shared-title', 'Game night (alice)');

      expect(sim.node('server').snapshot().kind).toBe('server');
      expect(sim.edge('alice', 'server').snapshot()?.kind).toBe('http');
    } finally {
      await sim.dispose();
    }
  });

  test('actor() returns the same instance for the same id', async () => {
    const sim = await Simulation.open({
      seed: 'demo',
      system: new DemoSimulationSystem(),
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
    const sim = await Simulation.open({
      seed: 42,
      startMs: 1000,
      system: new DemoSimulationSystem(),
    });
    try {
      expect(sim.clock.now()).toBe(1000);
      sim.clock.advance(250);
      expect(sim.clock.now()).toBe(1250);
    } finally {
      await sim.dispose();
    }
  });

  test('same seed yields identical event log', async () => {
    async function run(seed: number): Promise<string> {
      const sim = await Simulation.open({
        seed,
        system: new DemoSimulationSystem(),
      });
      try {
        const alice = await sim.actor('alice');
        await alice.ui.tap('create');
        await sim.edge('alice', 'server').partition();
        await sim.edge('alice', 'server').heal();
        return JSON.stringify(
          sim.eventLog().map((e) => ({
            kind: e.kind,
            nodeId: e.nodeId,
            from: e.from,
            to: e.to,
            title: e.title,
          }))
        );
      } finally {
        await sim.dispose();
      }
    }
    expect(await run(11)).toBe(await run(11));
  });

  test('fuzz mode keeps UI convergent', async () => {
    const sim = await Simulation.open({
      seed: 99,
      system: new DemoSimulationSystem(),
      fuzz: { intensity: 0.2 },
    });
    try {
      const alice = await sim.actor('alice');
      await alice.ui.tap('create');
      await alice.ui.expect.text('shared-title', 'Game night (alice)');
      const bob = await sim.actor('bob');
      await bob.ui.expect.text('shared-title', 'Game night (alice)');
      expect(sim.eventLog().length).toBeGreaterThan(0);
      expect(sim.topology().fuzz?.enabled).toBe(true);
    } finally {
      await sim.dispose();
    }
  });

  test('report writes topology.json and events.json', async () => {
    const rootDir = join(resolveLocalReportDataDir(), 'demo-report-test');
    const runId = 'demo-topo-run';
    const testId = 'demo-topo';
    const store = createNodeFsObjectStore({ rootDir });
    const sim = await Simulation.open({
      seed: 7,
      system: new DemoSimulationSystem(),
      report: { store, runId, testId },
    });
    try {
      const alice = await sim.actor('alice');
      await alice.ui.tap('create');
      await alice.ui.expect.text('shared-title', 'Game night (alice)');
    } finally {
      await sim.dispose();
    }

    const testDir = join(rootDir, 'runs', runId, 'tests', testId);
    expect(existsSync(join(testDir, 'steps.json'))).toBe(true);
    expect(existsSync(join(testDir, 'topology.json'))).toBe(true);
    expect(existsSync(join(testDir, 'events.json'))).toBe(true);

    const topology = JSON.parse(
      readFileSync(join(testDir, 'topology.json'), 'utf8')
    ) as { seed: string; nodes: Array<{ id: string }> };
    expect(topology.seed).toBe('7');
    expect(topology.nodes.some((n) => n.id === 'alice')).toBe(true);

    const events = JSON.parse(
      readFileSync(join(testDir, 'events.json'), 'utf8')
    ) as Array<{ kind: string }>;
    expect(events.some((e) => e.kind === 'ui.tap')).toBe(true);
  });
});

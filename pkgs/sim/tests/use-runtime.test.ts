/**
 * `System.useRuntime`: a harness swaps the fabric for runs that name no
 * runtime, so the same scenarios run on another registered runtime.
 */

import { describe, expect, test } from 'bun:test';
import { defineRuntime, defineSystem, virtualTimeRuntime } from '../src/index';

type Fabric = { readonly label: string };

function labelled(label: string) {
  return virtualTimeRuntime().with(() => ({ label }));
}

function fabricSystem() {
  return defineSystem<Fabric>({
    name: 'sim.fabric',
    create: (session) => ({
      label: (session.ports as unknown as Fabric).label,
    }),
    runtimes: [
      defineRuntime({
        default: true,
        name: 'sub-system',
        create: () => labelled('sub-system'),
      }),
      defineRuntime({
        name: 'full-system',
        create: () => labelled('full-system'),
      }),
    ],
  });
}

async function labelOf(
  system: ReturnType<typeof fabricSystem>,
  runtime?: string
): Promise<string> {
  await using s = await system.run({
    seed: 1,
    ...(runtime !== undefined ? { runtime } : {}),
  });
  return s.read((f) => f.label);
}

describe('System.useRuntime', () => {
  test('runs without a runtime use the selected one', async () => {
    const system = fabricSystem();
    expect(await labelOf(system)).toBe('sub-system');
    system.useRuntime('full-system');
    expect(await labelOf(system)).toBe('full-system');
  });

  test('an explicit runtime still wins', async () => {
    const system = fabricSystem();
    system.useRuntime('full-system');
    expect(await labelOf(system, 'sub-system')).toBe('sub-system');
  });

  test('unknown runtimes are rejected', () => {
    expect(() => fabricSystem().useRuntime('nope')).toThrow(
      "unknown runtime 'nope'"
    );
  });
});

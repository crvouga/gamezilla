import { describe, expect, test } from 'bun:test';
import { isInvariantSinkBound } from '@pkgs/invariants';
import fc from 'fast-check';

import { actions } from './actions';
import { defineScenario } from './define-scenario';
import { knob } from './knobs';
import { node } from './node';
import { properties, property } from './property';
import { openWorld } from './world';

function soloScenario(id: string) {
  return defineScenario({
    id,
    knobs: { n: knob(1, fc.constant(1)) },
    nodes: {
      peer: node({
        start: (ctx) => ({ id: ctx.id }),
      }),
    },
    actions: actions<{ readonly id: string }>()({
      tick: {
        generate: () => fc.constant({ kind: 'tick' as const }),
        apply: async () => undefined,
      },
    }),
    properties: properties<{ readonly id: string }>()({
      noop: property.always(async () => true),
    }),
    converge: async () => undefined,
  });
}

describe('openWorld concurrent worlds', () => {
  test('overlapping worlds share the sink until the last dispose', async () => {
    const worlds: Array<{ dispose: () => Promise<void> }> = [];
    try {
      const a = await openWorld(soloScenario('conc.a'), { seed: 1 });
      worlds.push(a);
      const b = await openWorld(soloScenario('conc.b'), { seed: 2 });
      worlds.push(b);
      expect(isInvariantSinkBound()).toBe(true);
      await a.dispose();
      expect(isInvariantSinkBound()).toBe(true);
      await b.dispose();
      worlds.length = 0;
      expect(isInvariantSinkBound()).toBe(false);
    } finally {
      for (let i = worlds.length - 1; i >= 0; i -= 1) {
        await worlds[i]!.dispose();
      }
    }
  });
});

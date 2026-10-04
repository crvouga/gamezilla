import { describe, expect, test } from 'bun:test';
import { defineProperty } from '@pkgs/harness-shared/define-property';
import type { ExampleApp } from './example-app';
import { exampleApp, inc } from './example-app';

type Model = { seen: number };

let setups = 0;
let checks = 0;
let lastSeen = -1;
let lastActionName: string | null = null;

const sys = exampleApp({
  properties: [
    defineProperty({
      name: 'lifecycle',
      setup: (s: ExampleApp): Model => {
        setups += 1;
        return { seen: s.n };
      },
      check: (_s: ExampleApp, model: Model, action) => {
        checks += 1;
        lastActionName = action?.name ?? null;
        lastSeen = model.seen + 1;
        return { seen: lastSeen };
      },
    }),
  ],
});

describe('property setup / check / dispose', () => {
  test('setup once, check each checkpoint with action, dispose check on dispose', async () => {
    setups = 0;
    checks = 0;
    lastSeen = -1;
    lastActionName = null;

    const steps = 20;
    {
      await using s = await sys.run({ seed: 1 });
      expect(setups).toBe(1);
      // Boot check with action === null
      expect(checks).toBe(1);
      expect(lastActionName).toBe(null);

      for (let i = 0; i < steps; i++) {
        await s.apply(inc, 1);
      }
      expect(setups).toBe(1);
      expect(checks).toBe(1 + steps);
      expect(lastActionName === 'inc').toBe(true);
      expect(inc.is({ name: 'inc', args: [1] })).toBe(true);
      expect(inc.is(null)).toBe(false);
    }

    // Dispose runs one final check(null); model return is ignored.
    expect(checks).toBe(1 + steps + 1);
    expect(lastActionName).toBe(null);
    expect(lastSeen).toBe(1 + steps + 1);
  });
});

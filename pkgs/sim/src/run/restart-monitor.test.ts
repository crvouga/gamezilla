import { describe, expect, test } from 'bun:test';
import { virtualTimeRuntime } from '../runtime';
import {
  defineAction,
  defineProperty,
  defineRuntime,
  defineSystem,
} from '../system';

type S = { n: number };

type Model = { seen: number };

let setups = 0;
let checks = 0;
let lastSeen = -1;
let lastActionName: string | null = null;

const bump = defineAction({
  name: 'bump',
  act: (s: S) => {
    s.n += 1;
  },
});

const sys = defineSystem({
  name: 'property-lifecycle',
  create(): S {
    return { n: 0 };
  },
  runtimes: [
    defineRuntime({
      default: true,
      name: 'virtual',
      create: () => virtualTimeRuntime(),
    }),
  ],
  actions: [bump],
  properties: [
    defineProperty({
      name: 'nNonNeg',
      setup: (s): Model => {
        setups += 1;
        return { seen: s.n };
      },
      check: (s, model, action) => {
        checks += 1;
        lastActionName = action?.name ?? null;
        if (s.n < 0) throw new Error('neg');
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
        await s.apply(bump);
      }
      expect(setups).toBe(1);
      expect(checks).toBe(1 + steps);
      expect(lastActionName === 'bump').toBe(true);
      expect(bump.is({ name: 'bump', args: [] })).toBe(true);
      expect(bump.is(null)).toBe(false);
    }

    // Dispose runs one final check(null); model return is ignored.
    expect(checks).toBe(1 + steps + 1);
    expect(lastActionName).toBe(null);
    expect(lastSeen).toBe(1 + steps + 1);
  });
});

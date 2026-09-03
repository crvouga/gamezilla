import { describe, expect, test } from 'bun:test';
import { virtualHost } from '../host';
import { defineSystem } from '../system';
import { script } from './script';

type S = { n: number };

const sys = defineSystem({
  name: 'property-lifecycle',
  generate(): S {
    return { n: 0 };
  },
});

const { defineAction, defineProperty } = sys;

const bump = defineAction({
  name: 'bump',
  act: (s) => {
    s.n += 1;
  },
});

type Ctx = { seen: number };

let setups = 0;
let checks = 0;
let closes = 0;
let lastSeen = -1;

const prop = defineProperty({
  name: 'nNonNeg',
  setup: (s): Ctx => {
    setups += 1;
    return { seen: s.n };
  },
  check: (s, ctx) => {
    checks += 1;
    if (s.n < 0) throw new Error('neg');
    return { seen: ctx.seen + 1 };
  },
  close: (ctx) => {
    closes += 1;
    lastSeen = ctx.seen;
  },
});

describe('property setup / check / close', () => {
  test('setup once, check each checkpoint, close on dispose', async () => {
    setups = 0;
    checks = 0;
    closes = 0;
    lastSeen = -1;

    const steps = 20;
    {
      await using run = await script(sys, {
        host: virtualHost(),
        seed: 1,
        properties: [prop],
      });
      expect(setups).toBe(1);
      expect(checks).toBe(1);
      expect(closes).toBe(0);

      for (let i = 0; i < steps; i++) {
        await run.apply(bump);
      }
      expect(setups).toBe(1);
      expect(checks).toBe(1 + steps);
      expect(closes).toBe(0);
    }

    expect(closes).toBe(1);
    expect(lastSeen).toBe(1 + steps);
  });
});

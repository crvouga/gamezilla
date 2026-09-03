import { describe, expect, test } from 'bun:test';
import { virtualHost } from '../host';
import { defineSystem } from '../system';
import { start } from './start';

type S = { n: number };

const sys = defineSystem({
  name: 'restart-unit',
  generate(): S {
    return { n: 0 };
  },
});

const { defineAction, defineObservation, defineProperty } = sys;

const bump = defineAction({
  name: 'bump',
  generate() {
    return (s) => {
      s.n += 1;
    };
  },
});

const nObs = defineObservation({
  name: 'n',
  observe: (s) => s.n,
});

let watchStarts = 0;
const prop = defineProperty({
  name: 'nNonNeg',
  *watch() {
    watchStarts += 1;
    const n = (yield* nObs) as number;
    if (n < 0) throw new Error('neg');
  },
});

describe('restart-on-complete', () => {
  test('many checkpoints do not explode watch starts', async () => {
    watchStarts = 0;
    await using run = await start(sys, {
      host: virtualHost(),
      seed: 1,
      properties: [prop],
    });
    const afterBoot = watchStarts;
    for (let i = 0; i < 200; i++) {
      await run.apply(bump);
    }
    expect(watchStarts).toBeLessThanOrEqual(afterBoot + 200 + 5);
    expect(watchStarts).toBeGreaterThan(afterBoot + 100);
  });
});

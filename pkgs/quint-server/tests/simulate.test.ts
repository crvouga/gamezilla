import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { renderQuint } from '@pkgs/quint-shared/itf';
import { modelInvariants, simulate } from '@pkgs/quint-server/simulate';

const FIXTURES = join(import.meta.dir, 'fixtures');
const OUT = join(import.meta.dir, '../.cache/test-traces');

function steps(specPath: string, seed: string, out: string) {
  return simulate({
    specPath,
    seed,
    traces: 4,
    maxSteps: 6,
    outDir: join(OUT, out),
  }).traces.map((trace) =>
    trace.states.map(
      (s) =>
        `${s.action} ${renderQuint(s.picks['who'] ?? '')} ${renderQuint(s.vars['state'] ?? '')}`
    )
  );
}

/**
 * Each draw spawns the Quint CLI: ~0.5s idle, ~2.5s under a loaded gate. A
 * wall-clock limit near that would let machine load decide the verdict.
 */
const DRAW_TIMEOUT_MS = 30_000;

describe('simulate', () => {
  test(
    'the same seed draws the same traces',
    () => {
      const door = join(FIXTURES, 'door.qnt');
      expect(steps(door, '0x2a', 'a')).toEqual(steps(door, '0x2a', 'b'));
    },
    DRAW_TIMEOUT_MS
  );

  test(
    'every trace starts at init and follows the model',
    () => {
      const [first] = steps(join(FIXTURES, 'door.qnt'), '0x2a', 'c');
      expect(first?.[0]).toBe('init "" "closed"');
      expect(first?.length).toBeGreaterThan(1);
    },
    DRAW_TIMEOUT_MS
  );

  test(
    'a model that breaks its own invariant fails before any trace runs',
    () => {
      expect(() =>
        simulate({
          specPath: join(FIXTURES, 'door-broken.qnt'),
          seed: '0x2a',
          traces: 4,
          maxSteps: 6,
          outDir: join(OUT, 'broken'),
        })
      ).toThrow('invNeverOpen');
    },
    DRAW_TIMEOUT_MS
  );

  test(
    'a model whose init never holds fails instead of drawing empty traces',
    () => {
      expect(() =>
        simulate({
          specPath: join(FIXTURES, 'door-shut.qnt'),
          seed: '0x2a',
          traces: 2,
          maxSteps: 3,
          outDir: join(OUT, 'shut'),
        })
      ).toThrow('init is never true');
    },
    DRAW_TIMEOUT_MS
  );

  // regression: quint-long-trace-output-buffer
  test(
    'a valid long trace survives output larger than the process buffer',
    () => {
      const result = simulate({
        specPath: join(FIXTURES, 'long-output.qnt'),
        seed: '0x2a',
        traces: 1,
        maxSteps: 1024,
        outDir: join(OUT, 'long-output'),
      });
      expect(result.traces).toHaveLength(1);
      expect(result.traces[0]?.states).toHaveLength(1025);
      expect(result.traces[0]?.states[1024]?.vars['count']).toBe(1024);
    },
    DRAW_TIMEOUT_MS
  );

  test('invariants are the vals named inv<Name>', () => {
    expect(
      modelInvariants(
        'val invA = true\n  val invBoth = x\nval inventory = 3\nval notInv = 1'
      )
    ).toEqual(['invA', 'invBoth']);
  });
});

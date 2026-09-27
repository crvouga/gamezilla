import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { renderQuint } from '@pkgs/quint/itf';
import { modelInvariants, simulate } from '@pkgs/quint/simulate';

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

describe('simulate', () => {
  test('the same seed draws the same traces', () => {
    const door = join(FIXTURES, 'door.qnt');
    expect(steps(door, '0x2a', 'a')).toEqual(steps(door, '0x2a', 'b'));
  });

  test('every trace starts at init and follows the model', () => {
    const [first] = steps(join(FIXTURES, 'door.qnt'), '0x2a', 'c');
    expect(first?.[0]).toBe('init "" "closed"');
    expect(first?.length).toBeGreaterThan(1);
  });

  test('a model that breaks its own invariant fails before any trace runs', () => {
    expect(() =>
      simulate({
        specPath: join(FIXTURES, 'door-broken.qnt'),
        seed: '0x2a',
        traces: 4,
        maxSteps: 6,
        outDir: join(OUT, 'broken'),
      })
    ).toThrow('invNeverOpen');
  });

  test('a model whose init never holds fails instead of drawing empty traces', () => {
    expect(() =>
      simulate({
        specPath: join(FIXTURES, 'door-shut.qnt'),
        seed: '0x2a',
        traces: 2,
        maxSteps: 3,
        outDir: join(OUT, 'shut'),
      })
    ).toThrow('init is never true');
  });

  test('invariants are the vals named inv<Name>', () => {
    expect(
      modelInvariants(
        'val invA = true\n  val invBoth = x\nval inventory = 3\nval notInv = 1'
      )
    ).toEqual(['invA', 'invBoth']);
  });
});

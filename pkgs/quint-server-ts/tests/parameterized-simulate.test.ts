import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { simulate } from '@pkgs/quint-server-ts/simulate';

const FIXTURE = join(import.meta.dir, 'fixtures/parameterized-door.qnt');

// regression: quint-uninitialized-model-constant
test('each constant assignment draws its own initial state and cache entry', () => {
  for (const locked of [true, false, true]) {
    const drawn = simulate({
      specPath: FIXTURE,
      parameters: { LOCKED: locked },
      traces: 1,
      maxSteps: 0,
      seed: '0x2a',
      outDir: join(
        import.meta.dir,
        '../.cache/parameterized-draw',
        String(locked)
      ),
    });
    expect(drawn.traces[0]?.states[0]?.vars['locked']).toBe(locked);
  }
}, 30_000);

test('closing a constant agrees with native Quint module instantiation', () => {
  const common = { traces: 2, maxSteps: 4, seed: '0x2a' };
  const specialized = simulate({
    ...common,
    specPath: FIXTURE,
    parameters: { LOCKED: false },
    outDir: join(import.meta.dir, '../.cache/parameterized-draw/closed'),
  });
  const native = simulate({
    ...common,
    specPath: join(import.meta.dir, 'fixtures/native-door.qnt'),
    outDir: join(import.meta.dir, '../.cache/parameterized-draw/native'),
  });
  // Native imports namespace their variables; compare the same declared variables.
  const prefix = 'native_door::parameterized_door::';
  expect(specialized.traces).toEqual(
    native.traces.map((trace) => ({
      vars: trace.vars.map((name) => name.replace(prefix, '')),
      states: trace.states.map((state) => ({
        ...state,
        vars: Object.fromEntries(
          Object.entries(state.vars).map(([name, value]) => [
            name.replace(prefix, ''),
            value,
          ])
        ),
      })),
    }))
  );
}, 30_000);

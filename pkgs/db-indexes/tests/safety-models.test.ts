// @io-wall-ok — test entry reads models and invokes the bundled Quint checker.
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import type {
  QuintBinding,
  QuintWorld,
  TraceContext,
} from '@pkgs/quint/registry';
import {
  replayTrace,
  replayTraceTwice,
  untakenActions,
} from '@pkgs/quint/replay';
import { simulate } from '@pkgs/quint/simulate';
import { typecheck } from '@pkgs/quint/typecheck';
import {
  interruptionCoverage,
  retirementCoverage,
} from './model-bindings/coverage';
import {
  interruptionBinding,
  interruptionWorld,
} from './model-bindings/interruption';
import {
  retirementBinding,
  retirementWorld,
} from './model-bindings/retirement';

test('every technical model has an implementation binding', () => {
  const models = [
    ...new Bun.Glob('*.qnt').scanSync({
      cwd: join(import.meta.dir, 'contracts'),
    }),
  ].sort();
  expect(models).toEqual(
    [
      `${interruptionBinding.model}.qnt`,
      `${retirementBinding.model}.qnt`,
    ].sort()
  );
});

function context(model: string, index: number, seed: string): TraceContext {
  return {
    model,
    trace: index,
    seed,
    packageName: '@pkgs/db-indexes',
    specUri: `tests/contracts/${model}.qnt`,
    testId: `${model}.trace-${index}`,
    title: `${model} trace ${index}`,
  };
}

function checkModel<W>(binding: QuintBinding<W>, world: QuintWorld<W>) {
  const specPath = join(import.meta.dir, 'contracts', `${binding.model}.qnt`);
  describe(binding.model, () => {
    const checked = typecheck(specPath);
    if (!checked.ok) throw new Error(checked.output);
    const result = simulate({
      specPath,
      traces: 80,
      maxSteps: 25,
      outDir: join(import.meta.dir, '../.cache/safety-models', binding.model),
    });
    test('every bound action is exercised and safety invariants are checked', () => {
      expect(result.invariants.length).toBeGreaterThan(0);
      expect(
        untakenActions(binding as QuintBinding<unknown>, result.traces)
      ).toEqual([]);
    });
    test('the traces reach the dangerous transitions', () => {
      if (binding.model === 'index-retirement') {
        expect(retirementCoverage(result.traces)).toEqual([
          'creation',
          'removal',
          'retirement cancelled',
          'retirement started',
          'usage hold',
        ]);
      } else {
        expect(interruptionCoverage(result.traces)).toEqual([
          'attempt:after',
          'attempt:before',
          'attempt:deferred',
          'attempt:failed',
          'attempt:invalid',
          'attempt:success',
          'recover:absent',
          'recover:invalid',
          'recover:valid',
          'repeat',
        ]);
      }
    });
    for (const [index, trace] of result.traces.entries()) {
      test(`trace ${index} matches every database state`, async () => {
        await replayTrace({
          binding: binding as QuintBinding<unknown>,
          world: world as QuintWorld<unknown>,
          trace,
          ctx: context(binding.model, index, result.seed),
        });
      });
    }
    test('the longest trace replays deterministically', async () => {
      const trace = [...result.traces].sort(
        (a, b) => b.states.length - a.states.length
      )[0]!;
      await replayTraceTwice({
        binding: binding as QuintBinding<unknown>,
        world: world as QuintWorld<unknown>,
        trace,
        ctx: context(binding.model, 0, result.seed),
      });
    });
  });
}

checkModel(retirementBinding, retirementWorld);
checkModel(interruptionBinding, interruptionWorld);

// @io-wall-ok — test entry reads models and invokes the bundled Quint checker.
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { simulate } from '@pkgs/quint-server-ts/simulate';
import { typecheck } from '@pkgs/quint-server-ts/typecheck';
import type { QuintBinding } from '@pkgs/quint-shared-ts/registry';
import { untakenActions } from '@pkgs/quint-shared-ts/replay';
import { interruptionCoverage, retirementCoverage } from './quint/coverage';
import { interruptionBinding } from './quint/interruption';
import { retirementBinding } from './quint/retirement';

test('every technical model has an implementation binding', () => {
  const models = [
    ...new Bun.Glob('*.qnt').scanSync({
      cwd: join(import.meta.dir, '../../../specs/db-indexes'),
    }),
  ].sort();
  expect(models).toEqual(
    [
      `${interruptionBinding.model}.qnt`,
      `${retirementBinding.model}.qnt`,
    ].sort()
  );
});

function checkModel<W>(binding: QuintBinding<W>) {
  const specPath = join(
    import.meta.dir,
    '../../../specs/db-indexes',
    `${binding.model}.qnt`
  );
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
  });
}

checkModel(retirementBinding);
checkModel(interruptionBinding);

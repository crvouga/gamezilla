import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { modelInvariants } from '@pkgs/quint-server/simulate';
import { verifyPhases } from '@pkgs/quint-server/verify-phases';
import {
  DEFAULT_VERIFY_STEPS,
  DEFAULT_VERIFY_TIMEOUT_MS,
  quintBinding,
} from '@pkgs/quint-shared/registry';
import './quint/index';

test('username proof retains its bounds with grouped array-encoded maps', () => {
  // regression: username-proof-solver-timeout
  const binding = quintBinding('username-changes');
  expect(binding.encoding).toBe('fun-arrays');
  expect(binding.inferPolymorphicTypes).toBe(false);
  expect(binding.invariantMode).toBe('before');
  expect(binding.boundedInvariantGroupSize).toBe(1);
  expect(binding.verifySteps ?? DEFAULT_VERIFY_STEPS).toBe(4);
  expect(binding.verifyTimeoutMs ?? DEFAULT_VERIFY_TIMEOUT_MS).toBe(240_000);
});

test('every username invariant has one independently gated bounded proof', () => {
  const binding = quintBinding('username-changes');
  const source = readFileSync(
    join(import.meta.dir, '../../../specs/profile/username-changes.qnt'),
    'utf8'
  );
  const invariants = modelInvariants(source);
  const phases = verifyPhases({
    source,
    module: 'username_changes',
    invariants,
    maxSteps: binding.verifySteps ?? DEFAULT_VERIFY_STEPS,
    boundedInvariantGroupSize: binding.boundedInvariantGroupSize ?? 1,
  });
  expect(phases).toHaveLength(11);
  expect(phases.flatMap((phase) => phase.invariants)).toEqual([...invariants]);
  for (const phase of phases) {
    expect(phase.invariants).toHaveLength(1);
    expect(phase.maxSteps).toBe(4);
  }
  const pkg = JSON.parse(
    readFileSync(join(import.meta.dir, '../package.json'), 'utf8')
  ) as {
    modelParts: number;
    phaseParts: Record<string, number>;
    scripts: Record<string, string>;
  };
  const turbo = JSON.parse(
    readFileSync(join(import.meta.dir, '../turbo.json'), 'utf8')
  ) as { tasks: Record<string, { dependsOn?: string[] }> };
  expect(pkg.modelParts).toBe(3);
  expect(pkg.phaseParts).toEqual({ '2': 11 });
  expect(pkg.scripts['check:models']).toBeUndefined();
  expect(pkg.scripts['check:models:2']).toBeUndefined();
  const names = phases.map((_, index) => `check:models:2:${index}`);
  expect(turbo.tasks['check:models:2']?.dependsOn).toEqual(names);
  for (const [index, name] of names.entries())
    expect(pkg.scripts[name]).toBe(
      `bun run ../../libs/tools/scripts/check-models.ts --part 2/3 --phase ${index}/11`
    );
});

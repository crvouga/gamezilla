import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { modelInvariants } from '@pkgs/quint-server/simulate';
import { verifyPhases } from '@pkgs/quint-server/verify-phases';
import { quintBinding } from '@pkgs/quint-shared/registry';
import '../quint/index';

// regression: matched-game-device-proof-exceeds-capacity
test('device agreement retains every matched-game proof target and bound with early invariant checks', () => {
  const source = readFileSync(
    join(import.meta.dir, '../../../../specs/games/matched-game.qnt'),
    'utf8'
  );
  const binding = quintBinding('matched-game')!;
  expect(binding.invariantMode).toBe('before');
  expect(binding.verifySteps).toBe(2);
  expect(binding.boundedInvariantGroupSize).toBe(1);
  const invariants = modelInvariants(source);
  const phases = verifyPhases({
    source,
    module: 'matched_game',
    invariants,
    maxSteps: binding.verifySteps!,
    boundedInvariantGroupSize: binding.boundedInvariantGroupSize!,
  });
  expect(phases).toHaveLength(16);
  expect(phases.flatMap((phase) => phase.invariants)).toEqual([...invariants]);
  expect(phases[10]?.invariants).toEqual(['invDevicesAgree']);
  for (const phase of phases) expect(phase.maxSteps).toBe(2);
});

import { expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import {
  SOLVER_SLOTS_DIR_ENV,
  SOLVER_SLOTS_ENV,
  solverSlots,
  withSolverSlot,
} from './solver-slots';

function slotsEnv(slots: number): {
  env: NodeJS.ProcessEnv;
  dir: string;
} {
  const dir = mkdtempSync(join(tmpdir(), 'solver-slots-'));
  return {
    dir,
    env: { [SOLVER_SLOTS_DIR_ENV]: dir, [SOLVER_SLOTS_ENV]: String(slots) },
  };
}

// regression: local-verify-starved-by-solver-reserve
test('proofs beyond the machine-wide slots wait instead of running', async () => {
  const { dir, env } = slotsEnv(2);
  let running = 0;
  let peak = 0;
  const gate = Promise.withResolvers<void>();
  const proof = () =>
    withSolverSlot(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await gate.promise;
      running -= 1;
    }, env);
  const proofs = Promise.all(Array.from({ length: 5 }, proof));
  for (let tick = 0; tick < 10; tick++) await Promise.resolve();
  expect(running).toBe(2);
  gate.resolve();
  await proofs;
  expect(peak).toBe(2);
  removeTree(dir, { whenLocked: 'leave' });
});

test('a slot left by a dead process is reclaimed', async () => {
  const { dir, env } = slotsEnv(1);
  writeFileSync(join(dir, 'slot-0'), '2147483646');
  expect(await withSolverSlot(async () => 'ran', env)).toBe('ran');
  removeTree(dir, { whenLocked: 'leave' });
});

test('slots scale with cores and stop at four proofs', () => {
  expect(solverSlots({}, 2)).toBe(1);
  expect(solverSlots({}, 12)).toBe(4);
  expect(solverSlots({}, 64)).toBe(4);
  expect(solverSlots({ [SOLVER_SLOTS_ENV]: '3' }, 12)).toBe(3);
});

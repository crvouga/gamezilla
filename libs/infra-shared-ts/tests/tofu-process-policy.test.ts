import { expect, test } from 'bun:test';
import {
  abandonedLockId,
  mayPrintToolStdout,
  repositoryUnlockArgs,
  stateLockKey,
  stateUnlockArgs,
  toolDeadline,
} from '@libs/infra-shared-ts/tofu-process-policy';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const paths = { tofuDir: '/tofu', cacheDir: '/cache' };
const FOUNDATION_LOCK = '31eedd87-d82f-6855-2162-0d37abf22196';

// regression: tofu-output-timeout-secret-leak
test('state-bearing stdout remains private even if OpenTofu times out', () => {
  for (const operation of ['output', 'show', 'state']) {
    expect(mayPrintToolStdout(operation, true)).toBe(false);
    expect(mayPrintToolStdout(operation, false)).toBe(false);
  }
  expect(mayPrintToolStdout('plan', false)).toBe(true);
  assertProperty(
    'captured output never becomes diagnostic stdout',
    fc.property(fc.string(), (operation) => {
      expect(mayPrintToolStdout(operation, true)).toBe(false);
    })
  );
});

// regression: tofu-plan-abandoned-lock
test('the timed-out repository plan interrupts rather than killing state-lock cleanup', () => {
  expect(toolDeadline('plan')).toEqual({
    timeout: 180_000,
    killSignal: 'SIGINT',
  });
  expect(toolDeadline('apply')).toEqual({});
  expect(
    repositoryUnlockArgs('44856d40-b6ba-3da7-e380-219c16886486', paths)
  ).toEqual([
    'force-unlock',
    '-force',
    '-var-file=/cache/vars/global.tfvars.json',
    '-var-file=/cache/vars/envs.tfvars.json',
    '44856d40-b6ba-3da7-e380-219c16886486',
  ]);
});

// regression: tofu-foundation-abandoned-lock
test('foundation recovery unlocks the environment state object with the exact UUID', () => {
  expect(
    stateUnlockArgs(FOUNDATION_LOCK, paths, { stack: 'foundation', env: 'dev' })
  ).toEqual([
    'force-unlock',
    '-force',
    '-var-file=/cache/vars/global.tfvars.json',
    '-var-file=/cache/vars/envs/dev.tfvars.json',
    FOUNDATION_LOCK,
  ]);
});

test('recovery preserves each exact UUID and refuses arbitrary command arguments', () => {
  assertProperty(
    'recovery preserves exact UUIDs',
    fc.property(fc.uuid(), (id) => {
      expect(repositoryUnlockArgs(id, paths).at(-1)).toBe(id);
      expect(
        stateUnlockArgs(id, paths, { stack: 'foundation', env: 'dev' }).at(-1)
      ).toBe(id);
    })
  );
  assertProperty(
    'recovery refuses arbitrary arguments',
    fc.property(
      fc
        .string()
        .filter(
          (value) =>
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
              value
            )
        ),
      (value) => {
        expect(() => repositoryUnlockArgs(value, paths)).toThrow(
          'exact abandoned OpenTofu lock UUID'
        );
        expect(() =>
          stateUnlockArgs(value, paths, { stack: 'foundation', env: 'dev' })
        ).toThrow('exact abandoned OpenTofu lock UUID');
      }
    )
  );
});

// regression: tofu-unlock-backend-variables
test('force-unlock resolves the variable-backed state backend with the same files as init', () => {
  expect(
    repositoryUnlockArgs('44856d40-b6ba-3da7-e380-219c16886486', paths)
  ).toContain('-var-file=/cache/vars/global.tfvars.json');
  expect(
    repositoryUnlockArgs('44856d40-b6ba-3da7-e380-219c16886486', paths)
  ).toContain('-var-file=/cache/vars/envs.tfvars.json');
  expect(
    stateUnlockArgs(FOUNDATION_LOCK, paths, { stack: 'foundation', env: 'dev' })
  ).toContain('-var-file=/cache/vars/envs/dev.tfvars.json');
});

/** The lock object Health run 42102265025 left on foundation/dev. */
const ABANDONED_LOCK = {
  ID: FOUNDATION_LOCK,
  Operation: 'OperationTypePlan',
  Info: '',
  Who: 'runner@runnervm7aw5e',
  Version: '1.13.1',
  Created: '2026-11-05T20:41:12.856377269Z',
  Path: 'tofu-state/foundation/dev.tfstate',
};
const ABANDONED = JSON.stringify(ABANDONED_LOCK);

// regression: tofu-abandoned-lock-needs-a-person
test('a release releases a runner lock older than any hosted job can run, by itself', () => {
  expect(stateLockKey({ stack: 'foundation', env: 'dev' })).toBe(
    'foundation/dev.tfstate.tflock'
  );
  expect(stateLockKey({ stack: 'bootstrap', env: null })).toBe(
    'bootstrap/global.tfstate.tflock'
  );
  expect(abandonedLockId(ABANDONED, new Date('2026-11-09T09:51:41Z'))).toBe(
    FOUNDATION_LOCK
  );
});

test('a lock a live job or a person may still hold is never released', () => {
  const created = new Date('2026-11-05T20:41:12Z');
  const lock = (fields: Record<string, unknown>) =>
    JSON.stringify({ ...ABANDONED_LOCK, ...fields });
  // A hosted job may run six hours; within seven, the lock may be live.
  expect(
    abandonedLockId(ABANDONED, new Date(created.getTime() + 7 * 3600_000 - 1))
  ).toBeNull();
  expect(
    abandonedLockId(
      ABANDONED,
      new Date(created.getTime() + 7 * 3600_000 + 1000)
    )
  ).toBe(FOUNDATION_LOCK);
  const later = new Date('2026-11-09T09:51:41Z');
  expect(abandonedLockId(lock({ Who: 'chris@laptop' }), later)).toBeNull();
  expect(abandonedLockId(lock({ ID: '-force; rm' }), later)).toBeNull();
  expect(abandonedLockId(lock({ Created: 'yesterday' }), later)).toBeNull();
  expect(abandonedLockId('not json', later)).toBeNull();
  expect(abandonedLockId('null', later)).toBeNull();
});

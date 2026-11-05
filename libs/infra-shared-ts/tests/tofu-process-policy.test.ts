import { expect, test } from 'bun:test';
import {
  mayPrintToolStdout,
  repositoryUnlockArgs,
  toolDeadline,
} from '@libs/infra-shared-ts/tofu-process-policy';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const paths = { tofuDir: '/tofu', cacheDir: '/cache' };

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

test('recovery preserves each exact UUID and refuses arbitrary command arguments', () => {
  assertProperty(
    'recovery preserves exact UUIDs',
    fc.property(fc.uuid(), (id) => {
      expect(repositoryUnlockArgs(id, paths).at(-1)).toBe(id);
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
});

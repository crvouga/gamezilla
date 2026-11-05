import { expect, test } from 'bun:test';
import {
  repositoryUnlockArgs,
  toolDeadline,
} from '@libs/infra-shared-ts/tofu-process-policy';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

// regression: tofu-plan-abandoned-lock
test('the timed-out repository plan interrupts rather than killing state-lock cleanup', () => {
  expect(toolDeadline('plan')).toEqual({
    timeout: 180_000,
    killSignal: 'SIGINT',
  });
  expect(toolDeadline('apply')).toEqual({});
  expect(repositoryUnlockArgs('44856d40-b6ba-3da7-e380-219c16886486')).toEqual([
    'force-unlock',
    '-force',
    '44856d40-b6ba-3da7-e380-219c16886486',
  ]);
});

test('recovery preserves each exact UUID and refuses arbitrary command arguments', () => {
  assertProperty(
    'recovery preserves exact UUIDs',
    fc.property(fc.uuid(), (id) => {
      expect(repositoryUnlockArgs(id)).toEqual(['force-unlock', '-force', id]);
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
        expect(() => repositoryUnlockArgs(value)).toThrow(
          'exact abandoned OpenTofu lock UUID'
        );
      }
    )
  );
});

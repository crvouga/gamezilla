import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';
import { permits } from './observability-condition';

test('arbitrary unavailable trace states always block deployment', () => {
  assertProperty(
    'no stack state can authorize an unavailable tracing service',
    fc.property(
      fc.constantFrom('active', 'paused', 'archived', 'deleted', 'deleting'),
      fc.string({ maxLength: 24 }).filter((status) => status !== 'active'),
      (status, traces_status) => {
        expect(permits({ status, traces_status })).toBe(false);
      }
    )
  );
});

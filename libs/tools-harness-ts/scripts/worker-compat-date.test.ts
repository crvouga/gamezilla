import { expect, test } from 'bun:test';

import {
  compatibilityDateProblem,
  readCompatibilityDate,
  readWorkerdSupportedDate,
} from './worker-compat-date';

test('a date ahead of the pinned workerd is rejected', () => {
  // regression: worker-compat-date-ahead-of-workerd
  const toml =
    'name = "example-api"\nmain = "src/server.ts"\ncompatibility_date = "2026-09-22"\n';
  const workerd = 'var compatibilityDate = "2026-05-07";';
  const configured = readCompatibilityDate(toml);
  const supported = readWorkerdSupportedDate(workerd);
  expect(configured).toBe('2026-09-22');
  expect(supported).toBe('2026-05-07');
  expect(compatibilityDateProblem('2026-09-22', '2026-05-07')).toContain(
    'newer than "2026-05-07"'
  );
});

test('a date at or before the supported date passes', () => {
  expect(compatibilityDateProblem('2026-09-21', '2026-09-21')).toBeNull();
  expect(compatibilityDateProblem('2025-01-01', '2026-09-21')).toBeNull();
});

test('a wrangler.toml without a top-level date reads as null', () => {
  expect(readCompatibilityDate('name = "x"\n')).toBeNull();
});

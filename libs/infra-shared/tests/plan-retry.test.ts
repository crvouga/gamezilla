import { describe, expect, test } from 'bun:test';
import {
  planFailureIsTransient,
  planReadFailed,
} from '@libs/infra-shared/plan-retry';

describe('plan retry', () => {
  // regression: infra-plan-read-transient
  test('a provider client error is a failed read, not a diff', () => {
    const output = [
      'Error: Client Error',
      'with module.database.postgresql_extension.pg_stat_statements',
      'read tcp: connection reset by peer',
    ].join('\n');
    expect(planReadFailed(1)).toBe(true);
    expect(planFailureIsTransient(output)).toBe(true);
  });

  test('a clean plan and a real diff are not retried', () => {
    expect(planReadFailed(0)).toBe(false);
    expect(planReadFailed(2)).toBe(false);
    expect(planFailureIsTransient('Error: Invalid reference')).toBe(false);
  });
});

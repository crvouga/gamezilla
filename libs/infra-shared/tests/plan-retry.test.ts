import { describe, expect, test } from 'bun:test';
import {
  planReadFailed,
  providerFailureIsTransient,
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
    expect(providerFailureIsTransient(output)).toBe(true);
  });

  // regression: infra-apply-railway-delete-timeout
  test('a Railway API timeout during apply is transient', () => {
    const output = [
      'Error: Client Error',
      'Unable to delete service, got error: Post',
      '"https://backboard.railway.app/graphql/v2?source=terraform_provider_railway":',
      'context deadline exceeded',
    ].join('\n');
    expect(providerFailureIsTransient(output)).toBe(true);
    expect(
      providerFailureIsTransient('context deadline exceeded while reading')
    ).toBe(true);
  });

  test('a clean plan and a real diff are not retried', () => {
    expect(planReadFailed(0)).toBe(false);
    expect(planReadFailed(2)).toBe(false);
    expect(providerFailureIsTransient('Error: Invalid reference')).toBe(false);
  });
});

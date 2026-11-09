import { describe, expect, test } from 'bun:test';
import {
  planReadFailed,
  providerFailureIsTransient,
  providerInstallIsTransient,
} from '@libs/infra-shared-ts/plan-retry';

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

  // regression: infra-init-provider-download-504
  test('a provider download gateway timeout during init is transient', () => {
    const output = [
      'Error while installing infisical/infisical v0.19.36: could not query',
      'provider registry for registry.opentofu.org/infisical/infisical: failed to',
      'retrieve authentication checksums for provider: request failed after 2',
      'attempts: 504 Gateway Timeout returned from',
    ].join('\n');
    expect(providerInstallIsTransient(output)).toBe(true);
    expect(
      providerInstallIsTransient('Error: Unsupported argument in module')
    ).toBe(false);
  });
});

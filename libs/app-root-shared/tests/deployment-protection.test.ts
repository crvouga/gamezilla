import { describe, expect, test } from 'bun:test';
import {
  ConfigurationError,
  DEPLOYMENT_PROTECTION_BINDING,
  readDeploymentProtection,
} from '@libs/app-root-shared/env';

describe('readDeploymentProtection', () => {
  test('a Worker with no rendered protection is standard (local runs)', () => {
    expect(readDeploymentProtection({})).toBe('standard');
    expect(readDeploymentProtection({ DEPLOYMENT_PROTECTION: '  ' })).toBe(
      'standard'
    );
  });

  test('reads what the env file rendered, never an env name', () => {
    expect(
      readDeploymentProtection({
        [DEPLOYMENT_PROTECTION_BINDING]: 'production',
      })
    ).toBe('production');
    expect(
      readDeploymentProtection({ [DEPLOYMENT_PROTECTION_BINDING]: 'standard' })
    ).toBe('standard');
  });

  test('anything else is a misconfiguration, not a silent default', () => {
    for (const bad of ['prd', 'dev', 'Production']) {
      expect(() =>
        readDeploymentProtection({ DEPLOYMENT_PROTECTION: bad })
      ).toThrow(ConfigurationError);
    }
  });
});

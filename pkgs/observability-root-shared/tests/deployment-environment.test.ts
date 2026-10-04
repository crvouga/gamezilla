import { describe, expect, test } from 'bun:test';
import { deploymentTelemetryEnvironment } from '@pkgs/observability-root-shared/deployment-environment';

describe('deploymentTelemetryEnvironment', () => {
  test('reports a deployed environment under its own name, whatever it is', () => {
    for (const name of ['dev', 'prd', 'staging', 'preview-42']) {
      expect(deploymentTelemetryEnvironment(name)).toBe(name);
      expect(deploymentTelemetryEnvironment(`  ${name}\n`)).toBe(name);
    }
  });

  test('reports a run with no stamped environment as local', () => {
    expect(deploymentTelemetryEnvironment(undefined)).toBe('local');
    expect(deploymentTelemetryEnvironment('  ')).toBe('local');
  });
});

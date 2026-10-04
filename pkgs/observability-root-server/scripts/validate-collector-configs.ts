#!/usr/bin/env bun
// @io-wall-ok — config-validation entrypoint invokes the pinned Collector image.

import { join } from 'node:path';

import { run } from '@pkgs/os-server/command';

const packageRoot = join(import.meta.dir, '..');
const image = 'otel/opentelemetry-collector-contrib:0.157.0';
const configs = ['collector-ci.yaml'] as const;

for (const config of configs) {
  run(
    'docker',
    [
      'run',
      '--rm',
      '--volume',
      `${join(packageRoot, 'configs', config)}:/etc/otelcol-contrib/config.yaml:ro`,
      '--env',
      'OBSERVABILITY_ARTIFACT_PATH=/tmp/traces.ndjson',
      image,
      'validate',
      '--config=/etc/otelcol-contrib/config.yaml',
    ],
    { cwd: packageRoot }
  );
}

#!/usr/bin/env bun
// @io-wall-ok — config-validation entrypoint invokes the pinned Collector image.

import { join } from 'node:path';

import { run } from '@pkgs/os';

const packageRoot = join(import.meta.dir, '..');
const image = 'otel/opentelemetry-collector-contrib:0.157.0';
const configs = ['collector-ci.yaml', 'collector-prod.yaml'] as const;

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
      '--env',
      'OBSERVABILITY_INGEST_TOKEN=validation-only',
      '--env',
      'OBSERVABILITY_BACKEND_OTLP_ENDPOINT=http://127.0.0.1:4318',
      '--env',
      'OBSERVABILITY_BACKEND_AUTHORIZATION=Bearer validation-only',
      image,
      'validate',
      '--config=/etc/otelcol-contrib/config.yaml',
    ],
    { cwd: packageRoot }
  );
}

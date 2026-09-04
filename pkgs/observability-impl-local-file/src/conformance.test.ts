import { describe } from 'bun:test';
import { wallClock } from '@pkgs/clock';
import { InMemorySpanContextStorage } from '@pkgs/observability/port/in-memory-context-storage';
import { observabilityConformanceSuite } from '@pkgs/observability/port/observability-conformance';
import type { ExportedSpanRecord } from '@pkgs/observability/shared/types';
import { createLocalFileObservabilityWithExporter } from './create-local-file-observability';

describe('Observability port conformance', () => {
  observabilityConformanceSuite({
    name: 'local-file',
    create: () => {
      const exported: ExportedSpanRecord[] = [];
      return createLocalFileObservabilityWithExporter({
        serviceName: 'test-local',
        now: wallClock.now,
        createId: () => crypto.randomUUID(),
        exporter: (r) => exported.push(r),
        storage: new InMemorySpanContextStorage(),
      });
    },
  });
});

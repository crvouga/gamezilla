import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import {
  RESOURCE_LOG_CHARS,
  resourceMetrics,
  runnerResourceDiagnostics,
} from './runner-resource-diagnostics';
import {
  RESOURCE_MOUNT_BYTES,
  RESOURCE_READ_BYTES,
  sampleRunnerResources,
} from './runner-resource-snapshot';

function fixture(
  ticks: readonly number[] = [100, 0, 50, 400, 0, 0, 0, 10, 5, 0]
): Record<string, string> {
  return {
    '/proc/stat': `cpu ${ticks.join(' ')}\ncpu0 1 2 3 4\nintr 1234`,
    '/proc/meminfo':
      'MemTotal: 7340032 kB\nMemAvailable: 1048576 kB\nsecret: hidden',
    '/proc/self/cgroup': '0::/slice/runner\n',
    '/proc/self/mountinfo':
      '1 2 0:1 /slice /sys/fs/cgroup rw - cgroup2 cgroup rw\n',
    '/sys/fs/cgroup/runner/cpu.max': '200000 100000\n',
    '/sys/fs/cgroup/runner/cpu.stat':
      'usage_usec 10000\nnr_periods 100\nnr_throttled 2\nthrottled_usec 100\n',
    '/sys/fs/cgroup/runner/memory.current': '6000000000\n',
    '/sys/fs/cgroup/runner/memory.max': '7000000000\n',
    '/sys/fs/cgroup/runner/memory.events': 'high 4\nmax 8\noom 2\noom_kill 1\n',
    '/proc/pressure/cpu': 'some avg10=9.2 avg60=2.1 avg300=0.1 total=1000\n',
    '/proc/pressure/memory':
      'some avg10=1.2 avg60=0.1 avg300=0.1 total=100\nfull avg10=0.1 avg60=0.0 avg300=0.0 total=20\n',
    '/proc/pressure/io': 'full avg10=0.0 avg60=0.0 avg300=0.0 total=50\n',
  };
}

test('a 600-second game task timeout records CPU and memory deltas', () => {
  // regression: verify-task-timeout-missing-resource-evidence
  // Run41039477627 task146 lasted600s, versus52s locally; these synthetic
  // kernel fixtures show the numeric evidence the failing runner omitted.
  const files = fixture();
  let at = 0;
  const lines: string[] = [];
  const record = runnerResourceDiagnostics({
    sample: () => sampleRunnerResources((path) => files[path] ?? null, at),
    log: (line) => lines.push(line),
  });
  record('start');
  at = 30_000;
  files['/proc/stat'] = 'cpu 200 0 70 500 0 0 0 30 50 0\n';
  files['/sys/fs/cgroup/runner/cpu.stat'] =
    'usage_usec 40000\nnr_periods 120\nnr_throttled 12\nthrottled_usec 1100\n';
  record('heartbeat');
  at = 600_000;
  record('task-timeout');
  expect(lines.map((line) => line.split(':')[0])).toEqual([
    'Runner resources (start)',
    'Runner resources (heartbeat)',
    'Runner resources (task-timeout)',
  ]);
  const metrics = JSON.parse(lines[1]!.slice(lines[1]!.indexOf(':') + 1));
  expect(metrics).toMatchObject({
    elapsedMs: 30000,
    cpuTicksDelta: 240,
    cpuIdleTicksDelta: 100,
    cpuStealTicksDelta: 20,
    cpuQuotaUs: 200000,
    cpuPeriodUs: 100000,
    cpuUsageUsDelta: 30000,
    cpuThrottledUsDelta: 1000,
    cpuPeriodsDelta: 20,
    cpuThrottledPeriodsDelta: 10,
    memoryTotalBytes: 7516192768,
    memoryAvailableBytes: 1073741824,
    cgroupMemoryBytes: 6000000000,
    cgroupMemoryLimitBytes: 7000000000,
    memoryOomKills: 1,
  });
  expect(lines.join('')).not.toContain('hidden');
  expect(lines.join('')).not.toContain('/slice/runner');
});

test('missing, unsupported and malformed sources produce unavailable numeric fields', () => {
  const missing = sampleRunnerResources(() => null, 0);
  expect(Object.values(missing.gauges).every((value) => value === null)).toBe(
    true
  );
  expect(Object.values(missing.counters).every((value) => value === null)).toBe(
    true
  );
  const files = fixture();
  files['/proc/self/cgroup'] = '4:cpu:/slice/runner';
  files['/proc/stat'] = 'cpu NaN Infinity -2 secret';
  expect(
    sampleRunnerResources((path) => files[path] ?? null, 1).counters.cpuTicks
  ).toBeNull();
  expect(
    sampleRunnerResources((path) => files[path] ?? null, 1).gauges.cgroupVersion
  ).toBeNull();
});

test('unlimited cgroup values and reset counters do not invent a limit or negative usage', () => {
  const files = fixture();
  const before = sampleRunnerResources((path) => files[path] ?? null, 30);
  files['/sys/fs/cgroup/runner/cpu.max'] = 'max 100000';
  files['/sys/fs/cgroup/runner/memory.max'] = 'max';
  files['/proc/stat'] = 'cpu 1 0 0 0 0 0 0 0';
  const after = sampleRunnerResources((path) => files[path] ?? null, 20);
  expect(resourceMetrics(after, before)).toMatchObject({
    elapsedMs: null,
    cpuTicksDelta: null,
    cpuStealTicksDelta: null,
    cpuQuotaUs: null,
    cpuPeriodUs: 100000,
    cgroupMemoryLimitBytes: null,
  });
});

test('numeric deltas stay exact across counter values and ignore guest double counting', () => {
  assertProperty(
    'runner CPU counter deltas',
    fc.property(
      fc.array(fc.integer({ min: 0, max: 1000000 }), {
        minLength: 8,
        maxLength: 8,
      }),
      fc.array(fc.integer({ min: 0, max: 1000000 }), {
        minLength: 8,
        maxLength: 8,
      }),
      (base, increments) => {
        const beforeFiles = fixture([...base, 50000, 80000]);
        const afterFiles = fixture([
          ...base.map((value, i) => value + increments[i]!),
          90000,
          100000,
        ]);
        const before = sampleRunnerResources(
          (path) => beforeFiles[path] ?? null,
          0
        );
        const after = sampleRunnerResources(
          (path) => afterFiles[path] ?? null,
          30000
        );
        expect(resourceMetrics(after, before).cpuTicksDelta).toBe(
          increments.reduce((sum, value) => sum + value, 0)
        );
        expect(resourceMetrics(after, before).cpuStealTicksDelta).toBe(
          increments[7]!
        );
      }
    )
  );
});

test('arbitrary source content cannot escape fixed metrics or exceed read and output bounds', () => {
  assertProperty(
    'bounded runner resource evidence',
    fc.property(fc.string({ maxLength: 20000 }), (source) => {
      const reads: number[] = [];
      const lines: string[] = [];
      const record = runnerResourceDiagnostics({
        sample: () =>
          sampleRunnerResources((_path, max) => {
            reads.push(max);
            return source;
          }, 0),
        log: (line) => lines.push(line),
      });
      record('shard-timeout');
      expect(reads.length).toBeLessThanOrEqual(12);
      expect(
        reads.every(
          (max) => max === RESOURCE_READ_BYTES || max === RESOURCE_MOUNT_BYTES
        )
      ).toBe(true);
      expect(lines[0]!.length).toBeLessThanOrEqual(RESOURCE_LOG_CHARS);
      const metrics = JSON.parse(lines[0]!.slice(lines[0]!.indexOf(':') + 1));
      if (metrics === null || typeof metrics !== 'object')
        throw new Error('resource metrics must be a JSON object');
      expect(
        Object.values(metrics).every(
          (value) =>
            value === null ||
            (typeof value === 'number' && Number.isFinite(value) && value >= 0)
        )
      ).toBe(true);
    })
  );
});

test('sample and output failures preserve the caller instead of disclosing exception data', () => {
  const lines: string[] = [];
  runnerResourceDiagnostics({
    sample: () => {
      throw new Error('secret');
    },
    log: (line) => lines.push(line),
  })('task-timeout');
  expect(lines).toEqual(['Runner resources (task-timeout): {"available":0}']);
  expect(() =>
    runnerResourceDiagnostics({
      sample: () => sampleRunnerResources(() => null, 0),
      log: () => {
        throw new Error('secret');
      },
    })('start')
  ).not.toThrow();
});

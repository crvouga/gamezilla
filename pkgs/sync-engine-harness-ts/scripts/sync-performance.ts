// @io-wall-ok — benchmark entry point; wall time measures real work, never drives product behavior.
import { openPerformanceFixture } from '@pkgs/sync-engine-harness-ts/sync-performance-fixture';

const fixture = await openPerformanceFixture();
try {
  const results = [];
  for (const [name, run] of [
    ['hash', fixture.hash],
    ['hash-merge-rebase', fixture.merge],
  ] as const) {
    for (let i = 0; i < 10; i++) await run();
    const samples = [];
    const heapBefore = process.memoryUsage().heapUsed;
    const cpuStart = process.cpuUsage();
    for (let i = 0; i < 100; i++) {
      const start = Bun.nanoseconds();
      await run();
      samples.push((Bun.nanoseconds() - start) / 1e6);
    }
    const cpu = process.cpuUsage(cpuStart);
    samples.sort((a, b) => a - b);
    results.push({
      name,
      samples: samples.length,
      p50Ms: samples[49],
      p95Ms: samples[94],
      p99Ms: samples[98],
      maxMs: samples[99],
      cpuMs: (cpu.user + cpu.system) / 1000,
      heapDeltaBytes: process.memoryUsage().heapUsed - heapBefore,
    });
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        runtime: Bun.version,
        platform: process.platform,
        arch: process.arch,
        rows: 1000,
        bytes: 1024 * 1024,
        pendingWrites: 100,
        interpretation:
          'Local benchmark samples, not fleet or low-end-device SLO compliance. Heap delta is not peak allocation.',
        targets: { mergeP95Ms: 150, mergeP99Ms: 300, synchronousSliceP99Ms: 8 },
        results,
      },
      null,
      2
    )}\n`
  );
} finally {
  await fixture.db.disconnect();
}

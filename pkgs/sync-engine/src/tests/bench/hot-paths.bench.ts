/**
 * Microbenchmark for sync-engine client hot paths (low-end mobile web).
 *
 * Run:
 *   bun run --filter @pkgs/sync-engine bench
 *
 * Warmup + Bun.nanoseconds(); prints ns/op and ops/sec. Not a CI budget gate.
 */
import { createHotPathCases } from './hot-paths-cases';

const WARMUP_ITERS = 3;
const BENCH_ITERS = 8;

type BenchResult = {
  name: string;
  iters: number;
  totalMs: number;
  opsPerSec: number;
  nsPerOp: number;
};

async function bench(
  name: string,
  fn: () => Promise<void> | void,
  iters: number
): Promise<BenchResult> {
  for (let i = 0; i < WARMUP_ITERS; i++) await fn();
  if (typeof Bun !== 'undefined' && typeof Bun.gc === 'function') {
    Bun.gc(true);
  }
  const start = Bun.nanoseconds();
  for (let i = 0; i < iters; i++) await fn();
  const totalMs = (Bun.nanoseconds() - start) / 1_000_000;
  const opsPerSec = (iters / totalMs) * 1000;
  const nsPerOp = (totalMs * 1_000_000) / iters;
  return { name, iters, totalMs, opsPerSec, nsPerOp };
}

function printResults(results: BenchResult[]): void {
  const nameW = Math.max(24, ...results.map((r) => r.name.length));
  console.log(
    `\n${'scenario'.padEnd(nameW)}   ${'ns/op'.padStart(14)}   ${'ops/s'.padStart(12)}   ${'total ms'.padStart(10)}`
  );
  console.log('-'.repeat(nameW + 44));
  for (const r of results) {
    console.log(
      `${r.name.padEnd(nameW)}   ${r.nsPerOp.toFixed(0).padStart(14)}   ${Math.round(r.opsPerSec).toLocaleString().padStart(12)}   ${r.totalMs.toFixed(1).padStart(10)}`
    );
  }
  console.log('');
}

const cases = await createHotPathCases();
const results: BenchResult[] = [];
for (const c of cases) {
  const iters =
    c.name.includes('2000') || c.name.includes('rebase')
      ? Math.max(2, Math.floor(BENCH_ITERS / 2))
      : BENCH_ITERS;
  results.push(await bench(c.name, c.run, iters));
}
printResults(results);

import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Matrix = {
  needs: string | string[];
  strategy: { 'max-parallel': number; matrix: { shard: number[] } };
};

// regression: nightly-visual-seven-waits-for-second-wave
test('the eight cold visual partitions fit before the minute-37 guard on the recorded runner timeline', () => {
  const { jobs } = Bun.YAML.parse(
    readFileSync(
      join(
        import.meta.dirname,
        '../../../.github/workflows/verify-nightly.yml'
      ),
      'utf8'
    )
  ) as { jobs: Record<string, Matrix> };
  // Seconds from creation to release, and whole job durations, from 45906600013.
  // Shard 7 was cancelled there. Its last completed cold job took 973s in 45899486374.
  const releases: Record<string, number> = {
    'verify-nightly-admission': 6,
    'verify-nightly-performance': 74,
    'verify-nightly-random': 481,
    'verify-nightly-browser': 796,
  };
  const duration = [1825, 1244, 801, 765, 707, 823, 973, 1607];
  const handoff = 3;
  const starts = new Map<number, number>();
  const finishes: number[] = [];
  for (const [id, job] of Object.entries(jobs)) {
    if (!id.startsWith('verify-nightly-visual')) continue;
    const ready =
      Math.max(...[job.needs].flat().map((dep) => releases[dep]!)) + handoff;
    const runners = Array<number>(job.strategy['max-parallel']).fill(ready);
    for (const shard of job.strategy.matrix.shard) {
      runners.sort((a, b) => a - b);
      const start = runners[0]!;
      const finish = start + duration[shard - 1]!;
      starts.set(shard, start);
      finishes.push(finish);
      runners[0] = finish + handoff;
    }
  }
  expect([...starts.keys()].sort((a, b) => a - b)).toEqual([
    1, 2, 3, 4, 5, 6, 7, 8,
  ]);
  expect(finishes).toHaveLength(8);
  expect(Math.max(...finishes)).toBeLessThan(37 * 60);
  expect(starts.get(7)).toBe(releases['verify-nightly-performance']! + handoff);
});

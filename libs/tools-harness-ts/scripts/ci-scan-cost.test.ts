import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { fileReach, fileReachWithin } from './cache-file-reach';
import { loadReport } from './ci-load';
import { createTaskEstimator, estimateTask } from './verify-task-estimates';

test('a workload indexes shared family costs once across its unmeasured tasks', () => {
  // regression: ci-workload-repeats-family-estimates
  let enumerations = 0;
  const costs = new Proxy(
    Object.fromEntries(
      Array.from({ length: 100 }, (_, i) => [`old#test:spec:${i}`, i + 1])
    ),
    {
      ownKeys: (target) => {
        enumerations++;
        return Reflect.ownKeys(target);
      },
    }
  );
  const report = loadReport({
    packages: [
      {
        name: 'new',
        dependencies: [],
        tasks: Array.from({ length: 200 }, (_, i) => `test:spec:${i}`),
      },
    ],
    costs,
  });
  expect(report.coldSeconds).toBe(200 * 51);
  expect(report.estimatedTasks).toBe(200);
  // One cost index and one stale-key inventory, independent of task count.
  expect(enumerations).toBe(2);
});

test('indexed estimates preserve exact samples, medians, invalid samples and fallback', () => {
  assertProperty(
    'indexed task estimates',
    fc.property(
      fc.array(
        fc.tuple(
          fc.integer({ min: 0, max: 8 }),
          fc.integer({ min: -10, max: 100 })
        )
      ),
      (samples) => {
        const costs = Object.fromEntries(
          samples.map(([family, seconds], i) => [
            `old-${i}#family-${family}:0`,
            seconds,
          ])
        );
        const estimate = createTaskEstimator(costs);
        for (const task of [
          ...Object.keys(costs),
          ...Array.from({ length: 10 }, (_, i) => `new#family-${i}:1`),
        ])
          expect(estimate(task)).toEqual(estimateTask(task, costs));
      }
    )
  );
});

test('classifying a heavily shared file stops once it cannot be light', () => {
  // regression: cache-hygiene-expands-heavy-file-cones
  const file = (i: number) => `libs/p${i}/src/index.ts`;
  let reads = 0;
  const importersOf = new Map(
    Array.from({ length: 500 }, (_, i) => [file(i), new Set([file(i + 1)])])
  );
  const get = importersOf.get.bind(importersOf);
  importersOf.get = (name) => {
    reads++;
    return get(name);
  };
  const graph = { importersOf };
  expect(fileReachWithin(graph, file(0), 3)).toBeNull();
  expect(reads).toBe(3);
  expect(fileReach(graph, file(0)).packages).toBe(501);
});

test('bounded reach preserves exact light counts across cycles and test leaves', () => {
  assertProperty(
    'bounded file reach',
    fc.property(
      fc.array(
        fc.tuple(
          fc.integer({ min: 0, max: 15 }),
          fc.integer({ min: 0, max: 15 })
        )
      ),
      fc.integer({ min: 0, max: 8 }),
      (edges, maximum) => {
        const file = (i: number) =>
          `libs/p${Math.floor(i / 2)}/src/${i}${i % 3 === 0 ? '.test' : ''}.ts`;
        const importersOf = new Map<string, Set<string>>();
        for (const [from, to] of edges) {
          const importers = importersOf.get(file(from)) ?? new Set<string>();
          importers.add(file(to));
          importersOf.set(file(from), importers);
        }
        for (let i = 0; i < 16; i++) {
          const full = fileReach({ importersOf }, file(i));
          expect(fileReachWithin({ importersOf }, file(i), maximum)).toEqual(
            full.packages > maximum ? null : full
          );
        }
      }
    )
  );
});

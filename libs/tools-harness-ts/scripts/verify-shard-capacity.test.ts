import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { CI_RUN_DEADLINE_SECONDS } from './verify-budget';
import { balanceShards, type VerifyTask, validatePlan } from './verify-shards';

function task(
  id: string,
  seconds: number,
  dependencies: string[] = []
): VerifyTask {
  return {
    taskId: id,
    seconds,
    dependencies,
    hash: '0123456789abcdef',
    hit: false,
    source: null,
    command: 'bun test',
    directory: 'pkgs/example',
    durationSource: 'history',
  };
}

// Actual proof estimates from Verify 40078571430; the other misses below
// retain that run's 690-task count and 18,918 seconds of non-proof work.
const PROOF_SECONDS = [
  232, 222, 148, 143, 137, 130, 125, 124, 123, 121, 118, 114, 112, 110, 107,
  106, 103, 95, 94, 93, 88, 84, 82, 76, 71, 70, 64, 53, 50, 46, 31, 28, 27, 26,
  25, 16, 16, 16, 15, 15, 14, 13, 12, 11, 11, 10, 10, 8, 8,
];

function coldCorpus(): VerifyTask[] {
  return [
    ...PROOF_SECONDS.map((seconds, index) =>
      task(`proof-${index}#verify:models`, seconds)
    ),
    ...Array.from({ length: 95 }, (_, index) =>
      task(`features#test:spec:${index}`, 150)
    ),
    ...Array.from({ length: 595 }, (_, index) =>
      task(`package-${index}#test`, index < 92 ? 7 : 8)
    ),
    ...Array.from({ length: 50 }, (_, index) => ({
      ...task(`cached-${index}#tc`, 10_000),
      hit: true,
      source: 'REMOTE' as const,
    })),
  ];
}

function chainCorpus(
  count: number,
  proofSeconds: number,
  featureSeconds: number
) {
  return [
    ...Array.from({ length: count - 1 }, (_, index) =>
      task(`proof-${index}#verify:models`, proofSeconds)
    ),
    ...Array.from({ length: count * 4 }, (_, index) => [
      task(`prepare-${index}`, 1),
      task(`features#test:spec:${index}`, featureSeconds - 1, [
        `prepare-${index}`,
      ]),
    ]).flat(),
  ];
}

test('two capped runners keep the literal small producer corpus within its deadline', () => {
  // regression: verify-solver-reservations-overfill-cold-shards
  const plan = balanceShards(chainCorpus(2, 1, 151), 2, 180);
  expect(
    plan.shards
      .slice(0, 2)
      .map((bin) => bin.seconds)
      .sort()
  ).toEqual([604, 605]);
  validatePlan(plan);
});

test('capped solver reservations reuse available runners before a cold corpus exceeds its deadline', () => {
  // regression: verify-solver-reservations-overfill-cold-shards
  const tasks = coldCorpus();
  const plan = balanceShards(tasks, 64, 180);
  const bins = plan.shards.filter((shard) => shard.stage === 'verifications');
  expect(bins).toHaveLength(64);
  expect(bins.reduce((sum, bin) => sum + bin.seconds, 0)).toBe(22_471);
  expect(Math.max(...bins.map((bin) => bin.seconds))).toBeLessThanOrEqual(
    CI_RUN_DEADLINE_SECONDS
  );
  expect(Math.max(...bins.map((bin) => bin.seconds))).toBeLessThanOrEqual(
    Math.ceil(22_471 / 64) + Math.max(...PROOF_SECONDS)
  );
  expect(
    bins.every(
      (bin) =>
        bin.tasks.filter((item) => item.taskId.endsWith('#verify:models'))
          .length <= 1
    )
  ).toBe(true);
  expect(
    plan.shards.flatMap((bin) => bin.tasks.map((item) => item.taskId)).sort()
  ).toEqual(tasks.map((item) => item.taskId).sort());
  expect(plan.shards).toEqual(
    balanceShards([...tasks].reverse(), 64, 180).shards
  );
  validatePlan(plan);
});

test('capped plans retain dependencies and coverage while proof runners share spare time', () => {
  assertProperty(
    'bounded cold Verify capacity',
    fc.property(
      fc.integer({ min: 2, max: 24 }),
      fc.integer({ min: 1, max: 20 }),
      fc.integer({ min: 100, max: 200 }),
      (count, proofSeconds, featureSeconds) => {
        const tasks = chainCorpus(count, proofSeconds, featureSeconds);
        const plan = balanceShards(tasks, count, 180);
        const bins = plan.shards.filter(
          (shard) => shard.stage === 'verifications'
        );
        expect(Math.max(...bins.map((bin) => bin.seconds))).toBeLessThanOrEqual(
          CI_RUN_DEADLINE_SECONDS
        );
        expect(
          plan.shards
            .flatMap((bin) => bin.tasks.map((item) => item.taskId))
            .sort()
        ).toEqual(tasks.map((item) => item.taskId).sort());
        expect(
          bins.every(
            (bin) =>
              bin.tasks.filter((item) => item.taskId.endsWith('#verify:models'))
                .length <= 1
          )
        ).toBe(true);
        expect(plan.shards).toEqual(
          balanceShards([...tasks].reverse(), count, 180).shards
        );
        validatePlan(plan);
      }
    )
  );
});

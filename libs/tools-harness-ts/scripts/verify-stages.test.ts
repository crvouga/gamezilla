import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { balanceShards, type VerifyTask } from './verify-shards';
import { verifyStages } from './verify-stages';

function task(taskId: string, dependencies: string[] = []): VerifyTask {
  return {
    taskId,
    dependencies,
    hash: taskId,
    hit: false,
    source: null,
    command: 'bun test',
    directory: 'libs/games-harness-ts',
    seconds: 1,
    durationSource: 'history',
  };
}

// The immutable run 40990676678 plan: parts 0..113 had individual history;
// the remaining 67 used the owning suite's 131-second median.
const GAME_PART_SECONDS = [
  252,
  44,
  505,
  143,
  213,
  279,
  290,
  132,
  160,
  111,
  49,
  43,
  23,
  150,
  114,
  114,
  181,
  209,
  473,
  394,
  315,
  305,
  137,
  18,
  443,
  293,
  237,
  215,
  119,
  97,
  99,
  44,
  219,
  229,
  84,
  108,
  161,
  63,
  88,
  56,
  127,
  60,
  27,
  103,
  154,
  54,
  162,
  257,
  225,
  240,
  107,
  22,
  194,
  267,
  329,
  225,
  176,
  172,
  113,
  26,
  171,
  99,
  130,
  101,
  441,
  224,
  148,
  251,
  187,
  103,
  97,
  96,
  42,
  48,
  144,
  87,
  109,
  45,
  37,
  56,
  183,
  198,
  215,
  59,
  258,
  36,
  87,
  110,
  122,
  42,
  38,
  63,
  144,
  74,
  64,
  160,
  108,
  54,
  239,
  300,
  239,
  194,
  271,
  103,
  41,
  75,
  141,
  75,
  131,
  17,
  111,
  196,
  344,
  570,
  ...Array<number>(67).fill(131),
];

// regression: nested-spec-prerequisite-binds-all-shards
test('staged shared spec preparation leaves all 181 game parts independently schedulable', () => {
  const owner = '@libs/games-harness-ts';
  const generator = {
    ...task(`${owner}#generate:feature-variants`),
    hit: true,
    source: 'REMOTE' as const,
  };
  const prepare = {
    ...task(`${owner}#prepare:spec`, [generator.taskId]),
    hit: true,
    source: 'REMOTE' as const,
  };
  const parts = GAME_PART_SECONDS.map((seconds, index) => ({
    ...task(`${owner}#test:spec:${index}`, [prepare.taskId]),
    seconds,
  }));
  expect(parts).toHaveLength(181);
  expect(parts.reduce((sum, task) => sum + task.seconds, 0)).toBe(26704);
  const tasks = [
    generator,
    prepare,
    ...parts,
    task(`${owner}#test`, [generator.taskId]),
    task('@libs/harness-ts#test', [generator.taskId]),
  ];
  const plan = balanceShards(tasks, 64, 720);
  const prerequisites = plan.shards.find(
    (shard) => shard.stage === 'prerequisites'
  )!;
  expect(prerequisites.tasks.map((task) => task.taskId).sort()).toEqual(
    [generator.taskId, prepare.taskId].sort()
  );
  const distributed = plan.shards.filter(
    (shard) => shard.stage === 'verifications'
  );
  expect(
    distributed.filter((shard) => shard.tasks.length > 0).length
  ).toBeGreaterThan(1);
  expect(Math.max(...distributed.map((shard) => shard.seconds))).toBeLessThan(
    1200
  );
  expect(
    distributed
      .flatMap((shard) => shard.tasks)
      .filter((task) => task.taskId.includes('#test:spec:'))
  ).toHaveLength(181);
  expect(
    plan.shards
      .flatMap((shard) => shard.tasks)
      .map((task) => task.taskId)
      .sort()
  ).toEqual(tasks.map((task) => task.taskId).sort());
});

// regression: verify-private-generator-inputs-make-spec-consumers
test('a shared producer brings its private generators along instead of becoming a fan-in', () => {
  // Nightly run 42760439972: feature variants read the sounds and tokens
  // generators, which nothing else reads, so the planner called it a fan-in
  // and ran all 181 game spec parts on the one consumers runner past its
  // 3000 s deadline.
  const owner = '@libs/games-harness-ts';
  const identity = task('@libs/tools-harness-ts#generate:identity');
  const sounds = task('//#task:sounds:generate', [identity.taskId]);
  const tokens = task('//#task:tokens:generate', [identity.taskId]);
  const i18n = task('//#task:i18n:compile', [identity.taskId]);
  const generator = task(`${owner}#generate:feature-variants`, [
    sounds.taskId,
    tokens.taskId,
    identity.taskId,
  ]);
  const prepare = task(`${owner}#prepare:spec`, [generator.taskId]);
  const parts = Array.from({ length: 181 }, (_, index) =>
    task(`${owner}#test:spec:${index}`, [prepare.taskId])
  );
  const tasks = [
    identity,
    sounds,
    tokens,
    i18n,
    generator,
    prepare,
    ...parts,
    task(`${owner}#test`, [generator.taskId]),
    task('@libs/harness-ts#test', [generator.taskId]),
  ];
  for (const order of [tasks, [...tasks].reverse()]) {
    const stages = verifyStages(order);
    expect(stages.consumers).toEqual([]);
    expect(stages.prerequisites.map((task) => task.taskId).sort()).toEqual(
      [identity, sounds, tokens, generator, prepare]
        .map((task) => task.taskId)
        .sort()
    );
  }
});

test('staged shared producer chains reach the same prerequisite fixed point in any discovery order', () => {
  assertProperty(
    'shared prerequisite closure',
    fc.property(
      fc.integer({ min: 1, max: 8 }),
      fc.integer({ min: 2, max: 32 }),
      (depth, width) => {
        const producers = Array.from({ length: depth }, (_, index) =>
          task(
            `producer-${index}`,
            index === 0 ? [] : [`producer-${index - 1}`]
          )
        );
        const leaves = producers.flatMap((producer) =>
          Array.from({ length: width }, (_, index) =>
            task(`${producer.taskId}-check-${index}`, [producer.taskId])
          )
        );
        const tasks = [...producers, ...leaves];
        const stages = verifyStages(tasks);
        const reverse = verifyStages([...tasks].reverse());
        expect(stages.prerequisites.map((task) => task.taskId).sort()).toEqual(
          producers.map((task) => task.taskId).sort()
        );
        expect(stages.verifications.map((task) => task.taskId).sort()).toEqual(
          leaves.map((task) => task.taskId).sort()
        );
        expect(stages.consumers).toEqual([]);
        for (const stage of [
          'prerequisites',
          'verifications',
          'consumers',
        ] as const)
          expect(stages[stage].map((task) => task.taskId).sort()).toEqual(
            reverse[stage].map((task) => task.taskId).sort()
          );
      }
    )
  );
});

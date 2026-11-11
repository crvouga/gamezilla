import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { STORYBOOK_PARTS, STORYBOOK_TASKS } from './turbo-ci-run';
import { balanceShards, type VerifyTask } from './verify-shards';
import { publishedTasks, requiredTasks } from './verify-stage-cache';

// regression: uncached-storybook-coverage-prerequisite
test('uncached Storybook coverage stays with its gate while units and the other browser parts restore the build', () => {
  const config = JSON.parse(
    readFileSync(
      new URL('../../../pkgs/ui-root-harness-ts/turbo.json', import.meta.url),
      'utf8'
    )
  ) as { tasks: Record<string, { dependsOn?: string[] }> };
  const owner = '@pkgs/ui-root-harness-ts';
  const parts = Array.from(
    { length: STORYBOOK_PARTS },
    (_, part) => `ci:storybook:${String(part)}`
  );
  const names = ['storybook:build', 'storybook:coverage', 'test', ...parts];
  const tasks: VerifyTask[] = names.map((name) => ({
    taskId: `${owner}#${name}`,
    hash: name,
    hit: false,
    source: null,
    command: 'bun test',
    directory: 'pkgs/ui-root-harness-ts',
    seconds: 1,
    durationSource: 'fallback',
    dependencies: (config.tasks[name]?.dependsOn ?? [])
      .filter((dependency) => names.includes(dependency))
      .map((dependency) => `${owner}#${dependency}`),
  }));
  const plan = balanceShards(tasks, 64, 90);
  const coverage = `${owner}#storybook:coverage`;
  const shard = plan.shards.find((item) =>
    item.tasks.some((task) => task.taskId === coverage)
  )!;
  expect(shard.stage).toBe('verifications');
  // Coverage gates with the first browser part, in its shard; the other
  // parts restore only the build, so they run side by side elsewhere.
  const [first, ...rest] = parts.map((part) => `${owner}#${part}`);
  expect(STORYBOOK_TASKS).toEqual([first!, ...rest]);
  expect(shard.tasks.map((task) => task.taskId)).toContain(first!);
  expect(
    requiredTasks(plan, [tasks.find((task) => task.taskId === first)!]).map(
      (task) => task.taskId
    )
  ).toContain(coverage);
  for (const part of rest)
    expect(
      requiredTasks(plan, [tasks.find((task) => task.taskId === part)!]).map(
        (task) => task.taskId
      )
    ).toEqual([`${owner}#storybook:build`]);
  expect(publishedTasks(plan, shard).map((task) => task.taskId)).not.toContain(
    coverage
  );
  expect(
    requiredTasks(plan, [
      tasks.find((task) => task.taskId === `${owner}#test`)!,
    ]).map((task) => task.taskId)
  ).toEqual([`${owner}#storybook:build`]);
  expect(plan.shards.flatMap((item) => item.tasks)).toHaveLength(names.length);
});

// regression: storybook-part-exceeds-release-task-budget
test('every Storybook part is a script and a task that runs its own shard', () => {
  const read = (file: string) =>
    JSON.parse(
      readFileSync(
        new URL(`../../../pkgs/ui-root-harness-ts/${file}`, import.meta.url),
        'utf8'
      )
    ) as {
      scripts?: Record<string, string>;
      tasks?: Record<string, unknown>;
    };
  const scripts = read('package.json').scripts ?? {};
  const tasks = read('turbo.json').tasks ?? {};
  const parts = Object.keys(scripts).filter((name) =>
    name.startsWith('ci:storybook:')
  );
  expect(parts).toHaveLength(STORYBOOK_PARTS);
  for (let part = 0; part < STORYBOOK_PARTS; part++) {
    const name = `ci:storybook:${String(part)}`;
    expect(scripts[name]).toContain(
      `--shard=${String(part + 1)}/${String(STORYBOOK_PARTS)}`
    );
    expect(tasks[name]).toBeDefined();
  }
});

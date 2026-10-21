import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectResults } from './verify-shard-results';
import type { VerifyPlan, VerifyTask } from './verify-shards';
import { prepareStage } from './verify-stage-cache';

function task(
  id: string,
  dependencies: string[] = [],
  hit = false
): VerifyTask {
  return {
    taskId: id,
    hash: id.replaceAll(/\W/g, ''),
    hit,
    source: hit ? 'LOCAL' : null,
    dependencies,
    command: 'bun test',
    directory: 'libs/tools-harness-ts',
    seconds: 1,
    durationSource: 'fallback',
  };
}

test('a missing recovery draw preserves independent verifications and their cached verdicts', async () => {
  // regression: missing-prerequisite-hides-independent-checks
  const root = mkdtempSync(join(tmpdir(), 'verify-stage-blocked-'));
  try {
    const prerequisite = task('@libs/chess-root-harness-ts#prepare:spec');
    const dependent = task('@libs/chess-root-harness-ts#test:spec:0', [
      prerequisite.taskId,
    ]);
    const independent = task('@libs/tools-harness-ts#test');
    const cached = task('@libs/tools-harness-ts#verify:actionlint', [], true);
    const shard = {
      index: 0,
      stage: 'verifications' as const,
      seconds: 3,
      tasks: [dependent, independent, cached],
    };
    const plan: VerifyPlan = {
      version: 2,
      tasks: [prerequisite, ...shard.tasks],
      shards: [
        shard,
        {
          index: 1,
          stage: 'prerequisites',
          seconds: 1,
          tasks: [prerequisite],
        },
      ],
    };
    const stage = await prepareStage(
      plan,
      shard,
      {
        TURBO_CACHE_DIR: join(root, '.turbo/cache'),
      },
      root
    );
    expect([...stage.blocked]).toEqual([dependent.taskId]);
    const result = collectResults({
      plan,
      shard,
      needed: new Set(),
      status: 1,
      env: {},
      summary: {
        tasks: [
          {
            taskId: independent.taskId,
            hash: independent.hash,
            cache: { status: 'MISS' },
            execution: { exitCode: 0, startTime: 0, endTime: 1 },
          },
        ],
      },
    });
    expect(result.verdict).toBe(1);
    expect(
      result.results.map(({ taskId, passed }) => ({ taskId, passed }))
    ).toEqual([
      { taskId: cached.taskId, passed: true },
      { taskId: independent.taskId, passed: true },
      { taskId: dependent.taskId, passed: false },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

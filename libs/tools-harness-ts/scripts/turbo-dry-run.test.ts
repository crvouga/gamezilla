import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { captureDryRun } from './turbo-dry-run';
import {
  projectTurboDryRun,
  type TurboDryRun,
} from './turbo-dry-run-projection';
import { planFromDryRun } from './turbo-preflight';

const TASK = {
  taskId: '@libs/games-harness-ts#test:spec:180',
  hash: '1234abcd',
  command: 'bun test "quoted\\path" 🐈',
  directory: 'libs/games-harness-ts',
  dependencies: ['@libs/games-harness-ts#prepare:spec'],
  cache: { status: 'HIT', source: 'LOCAL' },
  resolvedTaskDefinition: { cache: true },
};
const GLOBAL = {
  files: { 'a\\"}.json': 'aabbcc' },
  hashOfExternalDependencies: 'external',
};

function* chunks(text: string, size: number): Generator<string> {
  for (let offset = 0; offset < text.length; offset += size)
    yield text.slice(offset, offset + size);
}

test('dry-run projection preserves planner fields across arbitrary chunks and irrelevant JSON', () => {
  assertProperty(
    'chunked dry-run projection',
    fc.property(
      fc.jsonValue(),
      fc.integer({ min: 1, max: 97 }),
      (noise, size) => {
        const source = JSON.stringify({
          before: noise,
          tasks: [
            {
              ...TASK,
              inputs: noise,
              resolvedTaskDefinition: {
                ...TASK.resolvedTaskDefinition,
                inputs: noise,
              },
            },
          ],
          globalCacheInputs: GLOBAL,
          after: noise,
        }).replace('"tasks":', '"t\\u0061sks":');
        const projected = projectTurboDryRun(chunks(source, size));
        expect(projected).toEqual({ tasks: [TASK], globalCacheInputs: GLOBAL });
        expect(planFromDryRun(projected)).toEqual(
          planFromDryRun(JSON.parse(source) as TurboDryRun)
        );
      }
    )
  );
});

// regression: turbo-dry-run-exceeds-capture-buffer
test('dry-run spooling preserves every task beyond a child capture bound and removes its file', () => {
  const root = mkdtempSync(join(tmpdir(), 'dry-run-regression-'));
  const tasks = Array.from({ length: 20 }, (_, index) => ({
    ...TASK,
    taskId: `game#test:spec:${index}`,
    hash: `hash-${index}`,
  }));
  const program = `
    const tasks = ${JSON.stringify(tasks)};
    process.stdout.write('{"tasks":[');
    for (const [index, task] of tasks.entries()) {
      if (index > 0) process.stdout.write(',');
      process.stdout.write(JSON.stringify({...task, inputs: 'x'.repeat(65536)}));
    }
    process.stdout.write(']}');
  `;
  try {
    expect(() =>
      execFileSync(process.execPath, ['-e', program], { maxBuffer: 1024 })
    ).toThrow();
    const result = captureDryRun(process.execPath, ['-e', program], {
      cwd: root,
      env: process.env,
      temporaryRoot: root,
    });
    expect(result.outputBytes).toBeGreaterThan(1024 * 1024);
    expect(result.tasks).toEqual(tasks);
    expect(
      planFromDryRun(result).tasks.map(({ taskId, hash }) => ({ taskId, hash }))
    ).toEqual(tasks.map(({ taskId, hash }) => ({ taskId, hash })));
    expect(readdirSync(root)).toEqual([]);
  } finally {
    removeTree(root, { whenLocked: 'leave' });
  }
});

test('dry-run spooling propagates child failure and cleans up after parse failure', () => {
  const root = mkdtempSync(join(tmpdir(), 'dry-run-failure-'));
  const options = { cwd: root, env: process.env, temporaryRoot: root };
  try {
    try {
      captureDryRun(process.execPath, ['-e', 'process.exit(7)'], options);
      throw new Error('failed child was accepted');
    } catch (error) {
      expect((error as { status: number }).status).toBe(7);
    }
    expect(readdirSync(root)).toEqual([]);
    expect(() =>
      captureDryRun(
        process.execPath,
        ['-e', 'process.stdout.write(\'{"tasks":[\')'],
        options
      )
    ).toThrow();
    expect(readdirSync(root)).toEqual([]);
  } finally {
    removeTree(root, { whenLocked: 'leave' });
  }
});

test('dry-run projection rejects truncated, trailing, duplicate, and missing task data', () => {
  for (const source of [
    '{}',
    '{"tasks":[',
    '{"tasks":[]}garbage',
    '{"tasks":[],"tasks":[]}',
    '{"tasks":[{}},',
    '{"tasks":[],}',
    '{"ignored":,"tasks":[]}',
    '{"ignored":garbage,"tasks":[]}',
    '{"ignored":{"x":},"tasks":[]}',
  ])
    expect(() => projectTurboDryRun(chunks(source, 1))).toThrow();
});

test('dry-run projection closes its source when parsing fails before the final chunk', () => {
  let closed = false;
  function* source() {
    try {
      yield '{"tasks":[INVALID,';
      yield '{}]}';
    } finally {
      closed = true;
    }
  }
  expect(() => projectTurboDryRun(source())).toThrow();
  expect(closed).toBe(true);
});

import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { localVerifyEnv } from './local-verify-queue';
import {
  publishVerifyArtifacts,
  restoreVerifyArtifacts,
} from './verify-artifact-store';

// regression: local-verify-time-limits-stop-complete-proofs
test('an unlimited local run retains a completed proof beyond the bounded allowance', () => {
  const root = mkdtempSync(join(tmpdir(), 'verify-unlimited-artifacts-'));
  try {
    const cache = join(root, 'cache');
    const store = join(root, 'store');
    const restored = join(root, 'restored');
    mkdirSync(cache);
    const hash = 'c54b47920c7edc79';
    writeFileSync(join(cache, `${hash}.tar.zst`), 'complete unlimited proof');
    writeFileSync(join(cache, `${hash}-meta.json`), '{}');
    publishVerifyArtifacts(
      cache,
      store,
      {
        tasks: [
          {
            taskId: '@libs/games-harness-ts#verify:models:2',
            hash,
            execution: { startTime: 0, endTime: 645_400, exitCode: 0 },
          },
        ],
      },
      localVerifyEnv({})
    );
    restoreVerifyArtifacts(store, restored);
    expect(readFileSync(join(restored, `${hash}.tar.zst`), 'utf8')).toBe(
      'complete unlimited proof'
    );
  } finally {
    removeTree(root, { whenLocked: 'leave' });
  }
});

test('a zero exit after the task budget is not reusable passing evidence', () => {
  // regression: verify-over-budget-artifact
  const root = mkdtempSync(join(tmpdir(), 'verify-over-budget-artifacts-'));
  try {
    const cache = join(root, 'cache');
    const store = join(root, 'store');
    const restored = join(root, 'restored');
    mkdirSync(cache);
    const hash = 'c54b47920c7edc79';
    writeFileSync(join(cache, `${hash}.tar.zst`), 'over-budget artifact');
    writeFileSync(join(cache, `${hash}-meta.json`), '{}');
    publishVerifyArtifacts(
      cache,
      store,
      {
        tasks: [
          {
            taskId: '@pkgs/matchmaking-root-harness-ts#test:spec:4',
            hash,
            execution: {
              startTime: 1791601508533,
              endTime: 1791602004890,
              exitCode: 0,
            },
          },
        ],
      },
      {}
    );
    restoreVerifyArtifacts(store, restored);
    expect(() => readFileSync(join(restored, `${hash}.tar.zst`))).toThrow();
  } finally {
    removeTree(root, { whenLocked: 'leave' });
  }
});

// regression: verify-private-cache-cold-start
test('completed artifacts warm independent runs without sharing writable cache files', () => {
  const root = mkdtempSync(join(tmpdir(), 'verify-artifacts-'));
  try {
    const first = join(root, 'first');
    const store = join(root, 'store');
    const second = join(root, 'second');
    mkdirSync(first);
    writeFileSync(join(first, 'abc.tar.zst'), 'complete archive');
    writeFileSync(join(first, 'abc-meta.json'), '{"hash":"abc"}');
    writeFileSync(join(first, 'def.tar.zst'), 'failed artifact');
    writeFileSync(join(first, 'def-meta.json'), '{}');
    publishVerifyArtifacts(first, store, {
      tasks: [
        { hash: 'abc', execution: { exitCode: 0 } },
        { hash: 'def', execution: { exitCode: 1 } },
      ],
    });
    restoreVerifyArtifacts(store, second);
    writeFileSync(join(first, 'abc.tar.zst'), 'first run changed');
    expect(readFileSync(join(second, 'abc.tar.zst'), 'utf8')).toBe(
      'complete archive'
    );
    writeFileSync(join(second, 'abc.tar.zst'), 'second run changed');
    expect(readFileSync(join(store, 'abc.tar.zst'), 'utf8')).toBe(
      'complete archive'
    );
    expect(() => readFileSync(join(second, 'def.tar.zst'))).toThrow();
    removeTree(first, { whenLocked: 'leave' });
    expect(readFileSync(join(second, 'abc-meta.json'), 'utf8')).toBe(
      '{"hash":"abc"}'
    );
  } finally {
    removeTree(root, { whenLocked: 'leave' });
  }
});

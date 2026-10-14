import { expect, test } from 'bun:test';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  publishCheckArtifacts,
  restoreCheckArtifacts,
} from './check-artifact-store';

test('a zero exit after the task budget is not reusable passing evidence', () => {
  // regression: check-over-budget-artifact
  const root = mkdtempSync(join(tmpdir(), 'check-over-budget-artifacts-'));
  try {
    const cache = join(root, 'cache');
    const store = join(root, 'store');
    const restored = join(root, 'restored');
    mkdirSync(cache);
    const hash = 'c54b47920c7edc79';
    writeFileSync(join(cache, `${hash}.tar.zst`), 'over-budget artifact');
    writeFileSync(join(cache, `${hash}-meta.json`), '{}');
    publishCheckArtifacts(
      cache,
      store,
      {
        tasks: [
          {
            taskId: '@pkgs/matchmaking-root-harness#test:spec:4',
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
    restoreCheckArtifacts(store, restored);
    expect(() => readFileSync(join(restored, `${hash}.tar.zst`))).toThrow();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// regression: check-private-cache-cold-start
test('completed artifacts warm independent runs without sharing writable cache files', () => {
  const root = mkdtempSync(join(tmpdir(), 'check-artifacts-'));
  try {
    const first = join(root, 'first');
    const store = join(root, 'store');
    const second = join(root, 'second');
    mkdirSync(first);
    writeFileSync(join(first, 'abc.tar.zst'), 'complete archive');
    writeFileSync(join(first, 'abc-meta.json'), '{"hash":"abc"}');
    writeFileSync(join(first, 'def.tar.zst'), 'failed artifact');
    writeFileSync(join(first, 'def-meta.json'), '{}');
    publishCheckArtifacts(first, store, {
      tasks: [
        { hash: 'abc', execution: { exitCode: 0 } },
        { hash: 'def', execution: { exitCode: 1 } },
      ],
    });
    restoreCheckArtifacts(store, second);
    writeFileSync(join(first, 'abc.tar.zst'), 'first run changed');
    expect(readFileSync(join(second, 'abc.tar.zst'), 'utf8')).toBe(
      'complete archive'
    );
    writeFileSync(join(second, 'abc.tar.zst'), 'second run changed');
    expect(readFileSync(join(store, 'abc.tar.zst'), 'utf8')).toBe(
      'complete archive'
    );
    expect(() => readFileSync(join(second, 'def.tar.zst'))).toThrow();
    rmSync(first, { recursive: true });
    expect(readFileSync(join(second, 'abc-meta.json'), 'utf8')).toBe(
      '{"hash":"abc"}'
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

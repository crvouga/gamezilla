import { expect, test } from 'bun:test';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { cachedQuintDir } from '@pkgs/quint-server-ts/draw-cache';

test('a prepared artifact restored on another runner supplies the same draw without generating it again', () => {
  const roots = [
    mkdtempSync(join(tmpdir(), 'draw-producer-')),
    mkdtempSync(join(tmpdir(), 'draw-consumer-')),
  ];
  const before = process.env['HARNESS_REPORT_DIR'];
  let calls = 0;
  const draw = {
    source: 'module counter {}',
    seed: '0x67932',
    traces: 2,
    maxSteps: 3,
    produce: (dir: string) => {
      calls++;
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, 'trace-1.itf.json'),
        '{"states":[{"count":0},{"count":1}]}'
      );
    },
  };
  try {
    process.env['HARNESS_REPORT_DIR'] = join(
      roots[0]!,
      '.cache/harness-report/part-0'
    );
    const first = cachedQuintDir(draw);
    cpSync(
      join(roots[0]!, '.cache/quint-draws'),
      join(roots[1]!, '.cache/quint-draws'),
      { recursive: true }
    );
    process.env['HARNESS_REPORT_DIR'] = join(
      roots[1]!,
      '.cache/harness-report/part-31'
    );
    const second = cachedQuintDir(draw);
    expect(calls).toBe(1);
    expect(readFileSync(join(second, 'trace-1.itf.json'), 'utf8')).toBe(
      readFileSync(join(first, 'trace-1.itf.json'), 'utf8')
    );
  } finally {
    if (before === undefined) delete process.env['HARNESS_REPORT_DIR'];
    else process.env['HARNESS_REPORT_DIR'] = before;
    for (const root of roots) removeTree(root, { whenLocked: 'leave' });
  }
});

// regression: quint-draw-cache-stale-failure
test('a failure an earlier run left behind does not fail a later draw', () => {
  const root = mkdtempSync(join(tmpdir(), 'draw-stale-failure-'));
  const before = process.env['HARNESS_REPORT_DIR'];
  // What an older checkout's producer recorded on a Windows runner
  // (Verify run 40596596039); every later run then failed with it.
  const stale =
    "ENOENT: no such file or directory, mkdir 'C:\\Users\\runner\\AppData\\Local\\Temp\\quint-draws\\9f37\\itf\\instantiated-source\\C:\\actions-runner-2\\_work\\acme\\acme\\pkgs\\quint-server-ts\\tests\\fixtures'";
  let calls = 0;
  const draw = (fail: boolean) => ({
    source: 'module stale {}',
    seed: '0x2a',
    traces: 1,
    maxSteps: 0,
    produce: (dir: string) => {
      calls++;
      if (fail) throw new Error(stale);
      writeFileSync(join(dir, 'trace-1.itf.json'), '{"states":[]}');
    },
  });
  try {
    process.env['HARNESS_REPORT_DIR'] = join(
      root,
      '.cache/harness-report/part-0'
    );
    expect(() => cachedQuintDir(draw(true))).toThrow(stale);
    const later = cachedQuintDir(draw(false));
    expect(calls).toBe(2);
    expect(readFileSync(join(later, 'trace-1.itf.json'), 'utf8')).toBe(
      '{"states":[]}'
    );
    // The success is shared from then on.
    cachedQuintDir(draw(true));
    expect(calls).toBe(2);
  } finally {
    if (before === undefined) delete process.env['HARNESS_REPORT_DIR'];
    else process.env['HARNESS_REPORT_DIR'] = before;
    removeTree(root, { whenLocked: 'leave' });
  }
});

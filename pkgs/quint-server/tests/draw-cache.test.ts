import { expect, test } from 'bun:test';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cachedQuintDir } from '@pkgs/quint-server/draw-cache';

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
    for (const root of roots) rmSync(root, { recursive: true, force: true });
  }
});

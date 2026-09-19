import { describe, expect, test } from 'bun:test';

import { CachedGroupFilter } from './github-cached-group-filter';

function run(lines: readonly string[]): { out: string[]; hidden: number } {
  const out: string[] = [];
  const filter = new CachedGroupFilter((line) => out.push(line));
  for (const line of lines) filter.push(line);
  filter.end();
  return { out, hidden: filter.hiddenCount };
}

describe('CachedGroupFilter', () => {
  test('drops groups that only report a suppressed cache hit', () => {
    const { out, hidden } = run([
      '::group::@pkgs/equal:tc',
      '@pkgs/equal:tc: cache hit, suppressing logs 44f5e515a624e4e0',
      '::endgroup::',
      '::group::\u001b[1m@pkgs/assert:tc\u001b[0m',
      '',
      '  cache hit, suppressing logs 6c0984ee4bef3fdf',
      '::endgroup::',
    ]);
    expect(out).toEqual([]);
    expect(hidden).toBe(2);
  });

  test('keeps groups that did work, in order', () => {
    const lines = [
      '::group::@pkgs/sql:test',
      'cache miss, executing 8d21f12037eb989d',
      ' 8 pass',
      '::endgroup::',
    ];
    expect(run(lines)).toEqual({ out: lines, hidden: 0 });
  });

  test('passes lines outside groups straight through', () => {
    const lines = [' Tasks:    2 successful, 2 total', 'Error: boom'];
    expect(run(lines)).toEqual({ out: lines, hidden: 0 });
  });

  test('flushes a group left open when the stream ends', () => {
    const lines = ['::group::@pkgs/sql:test', 'cache hit, suppressing logs x'];
    expect(run(lines)).toEqual({ out: lines, hidden: 0 });
  });
});

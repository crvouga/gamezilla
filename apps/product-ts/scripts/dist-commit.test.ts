import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { assertDistBuiltFor } from './dist-commit';

const COMMIT = '0123456789abcdef0123456789abcdef01234567';

function dist(script: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'dist-commit-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'index.html'), `<!-- ${COMMIT} -->`);
  writeFileSync(join(dir, 'assets/root.js'), script);
  return dir;
}

test('a deploy takes only a bundle built for its commit', () => {
  const built = dist(`bootBrowserBugReports({build:"${COMMIT}"})`);
  const generic = dist('bootBrowserBugReports({build:"unknown"})');
  try {
    expect(() => assertDistBuiltFor(built, COMMIT)).not.toThrow();
    expect(() => assertDistBuiltFor(generic, COMMIT)).toThrow(
      `VITE_COMMIT_HASH=${COMMIT}`
    );
  } finally {
    removeTree(built);
    removeTree(generic);
  }
});

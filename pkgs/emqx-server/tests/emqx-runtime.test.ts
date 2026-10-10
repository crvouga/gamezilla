import { expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { prepareEmqxRuntime } from '@pkgs/emqx-server/emqx-runtime';

function release(root: string): string {
  mkdirSync(join(root, 'bin'), { recursive: true });
  mkdirSync(join(root, 'lib'), { recursive: true });
  mkdirSync(join(root, 'data'), { recursive: true });
  mkdirSync(join(root, 'log'), { recursive: true });
  writeFileSync(join(root, 'bin/emqx'), 'broker executable', { mode: 0o755 });
  writeFileSync(join(root, 'lib/application'), 'broker application');
  symlinkSync('application', join(root, 'lib/current'));
  writeFileSync(join(root, 'data/retained'), 'existing broker data');
  writeFileSync(join(root, 'log/retained'), 'existing broker log');
  return join(root, 'bin/emqx');
}

test('a release on OWC Express 1M2 runs from a self-contained path without spaces', () => {
  // regression: emqx-release-path-whitespace
  const fixture = mkdtempSync(join(tmpdir(), 'emqx-runtime-test-'));
  const source = release(join(fixture, 'OWC Express 1M2/emqx'));
  const runtime = prepareEmqxRuntime(source);
  try {
    expect(realpathSync(runtime.bin)).not.toMatch(/\s/);
    expect(readFileSync(runtime.bin, 'utf8')).toBe('broker executable');
    const library = join(dirname(runtime.bin), '../lib/current');
    expect(readFileSync(library, 'utf8')).toBe('broker application');
    expect(realpathSync(library)).toStartWith(dirname(dirname(runtime.bin)));
    expect(existsSync(join(dirname(runtime.bin), '../data'))).toBe(false);
    expect(existsSync(join(dirname(runtime.bin), '../log'))).toBe(false);
    runtime.dispose();
    expect(existsSync(runtime.bin)).toBe(false);
    expect(existsSync(source)).toBe(true);
    expect(
      readFileSync(join(dirname(source), '../data/retained'), 'utf8')
    ).toBe('existing broker data');
  } finally {
    runtime.dispose();
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('a release already in a path without spaces is retained after disposal', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'emqx-runtime-test-'));
  const source = release(join(fixture, 'emqx'));
  const runtime = prepareEmqxRuntime(source);
  try {
    expect(runtime.bin).toBe(realpathSync(source));
    runtime.dispose();
    expect(existsSync(source)).toBe(true);
  } finally {
    runtime.dispose();
    rmSync(fixture, { recursive: true, force: true });
  }
});

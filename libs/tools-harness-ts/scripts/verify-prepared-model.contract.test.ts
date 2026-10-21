import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createVerifySnapshot } from './verify-snapshot';
import { archiveVerifySnapshot } from './verify-snapshot-archive';

const MODEL = '.cache/ui-quality-model/vision.onnx';

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'prepared-model-fixture-'));
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  git('init', '-q');
  writeFileSync(join(root, '.gitignore'), '.cache/\n');
  writeFileSync(join(root, 'input.ts'), 'current source');
  git('add', '.');
  git(
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.com',
    'commit',
    '-qm',
    'fixture'
  );
  mkdirSync(dirname(join(root, MODEL)), { recursive: true });
  writeFileSync(join(root, MODEL), 'prepared model');
  writeFileSync(join(root, '.cache/stale-report.json'), 'stale evidence');
  return root;
}

// regression: verify-snapshot-missing-visual-model
test('prepared model inputs are private while stale verification evidence stays out', async () => {
  const source = fixture();
  const runs: string[] = [];
  try {
    runs.push(await createVerifySnapshot(source));
    runs.push(await createVerifySnapshot(source));
    expect(existsSync(join(runs[0]!, MODEL))).toBe(true);
    expect(existsSync(join(runs[0]!, '.cache/stale-report.json'))).toBe(false);
    writeFileSync(join(runs[0]!, MODEL), 'first run changed its own model');
    expect(readFileSync(join(runs[1]!, MODEL), 'utf8')).toBe('prepared model');
    expect(readFileSync(join(source, MODEL), 'utf8')).toBe('prepared model');
  } finally {
    for (const root of [source, ...runs.map(dirname)])
      rmSync(root, { recursive: true, force: true });
  }
});

// regression: verify-snapshot-missing-visual-model
test('diagnostics retain results without archiving the installed model', async () => {
  const source = fixture();
  try {
    const root = join(source, 'workspace');
    mkdirSync(dirname(join(root, MODEL)), { recursive: true });
    writeFileSync(join(root, MODEL), 'prepared model');
    writeFileSync(join(root, 'verdict.json'), 'current result');
    const archive = await archiveVerifySnapshot(root);
    const entries = execFileSync('tar', ['-tzf', archive], {
      encoding: 'utf8',
    });
    expect(entries).toContain('verdict.json');
    expect(entries).not.toContain('.cache/ui-quality-model');
  } finally {
    rmSync(source, { recursive: true, force: true });
  }
});

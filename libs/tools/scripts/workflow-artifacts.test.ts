import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// regression: github-artifact-download-attempt-selection
test('downloads every paginated artifact by ID even when attempts share a name', () => {
  const root = mkdtempSync(join(tmpdir(), 'github-artifact-test-'));
  try {
    const bin = join(root, 'bin');
    mkdirSync(bin);
    const fixture = join(bin, 'gh');
    copyFileSync(
      join(import.meta.dirname, 'workflow-artifacts-fixture.ts'),
      fixture
    );
    const body = readFileSync(fixture, 'utf8');
    writeFileSync(fixture, `#!/usr/bin/env bun\n${body}`, { mode: 0o755 });
    chmodSync(fixture, 0o755);
    for (const id of [11, 12]) {
      writeFileSync(
        join(root, 'trace.txt'),
        `attempt-${id}:${'x'.repeat(1_048_577)}`
      );
      const zipped = spawnSync('zip', ['-0', '-q', `${id}.zip`, 'trace.txt'], {
        cwd: root,
      });
      expect(zipped.status).toBe(0);
    }
    const result = spawnSync(
      process.execPath,
      [
        join(import.meta.dirname, 'workflow-artifacts.ts'),
        '42',
        'observability-traces-',
        join(root, 'output'),
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${bin}:${process.env['PATH']}`,
          CI_ARTIFACT_FIXTURE_ROOT: root,
        },
      }
    );
    expect(result.status, result.stderr).toBe(0);
    for (const id of [11, 12])
      expect(
        readFileSync(join(root, 'output', String(id), 'trace.txt'), 'utf8')
      ).toBe(`attempt-${id}:${'x'.repeat(1_048_577)}`);
    const commands = readFileSync(join(root, 'commands.ndjson'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as string[]);
    expect(commands).toEqual([
      [
        'api',
        '--paginate',
        '--slurp',
        'repos/gamezilla-org/gamezilla/actions/runs/42/artifacts?per_page=100',
      ],
      ['api', 'repos/gamezilla-org/gamezilla/actions/artifacts/11/zip'],
      ['api', 'repos/gamezilla-org/gamezilla/actions/artifacts/12/zip'],
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// regression: empty-spec-part-passes
test('an empty configured part fails instead of publishing a passing report', async () => {
  const root = mkdtempSync(join(tmpdir(), 'empty-spec-part-'));
  try {
    writeFileSync(join(root, 'package.json'), '{"specDomains":[]}');
    const child = Bun.spawn(
      [
        process.execPath,
        join(import.meta.dirname, 'test-spec.ts'),
        '--part',
        '0/1',
      ],
      {
        cwd: root,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          ...process.env,
          npm_package_name: '@libs/empty',
          HARNESS_MODE: 'mem',
        },
      }
    );
    const [status, error] = await Promise.all([
      child.exited,
      new Response(child.stderr).text(),
    ]);
    expect(status).toBe(1);
    expect(error).toContain('remove the empty part or fix its spec scope');
    expect(
      (
        JSON.parse(
          readFileSync(
            join(root, '.cache/harness-report/part-0/complete.json'),
            'utf8'
          )
        ) as { status: number }
      ).status
    ).toBe(1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

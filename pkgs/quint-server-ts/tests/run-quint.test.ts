import { expect, test } from 'bun:test';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runQuint } from '@pkgs/quint-server-ts/run-quint';

// regression: quint-invalid-limit-mode-starts-checker
test('invalid limit configuration is rejected before creating checker files or processes', async () => {
  const root = mkdtempSync(join(tmpdir(), 'quint-invalid-limits-'));
  const cwd = join(root, 'checker');
  try {
    await expect(
      runQuint({
        args: ['-e', 'process.exit(0)'],
        cwd,
        env: { VERIFY_TIME_LIMITS: 'typo' },
        timeoutMs: 1000,
      })
    ).rejects.toThrow('must be on or off');
    expect(existsSync(cwd)).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// regression: verify-quint-silent-exit
test.each(['on', 'off'])(
  'a checker terminated after the JVM notice retains its exit signal and stderr (limits %s)',
  async (mode) => {
    const cwd = mkdtempSync(join(tmpdir(), 'quint-signal-'));
    try {
      const result = await runQuint({
        args: [
          '-e',
          "console.error('Picked up JAVA_TOOL_OPTIONS: -XX:ActiveProcessorCount=4'); process.kill(process.pid, 'SIGTERM')",
        ],
        cwd,
        env: { VERIFY_TIME_LIMITS: mode },
        timeoutMs: 1000,
      });
      expect(result.code).toBeNull();
      expect(result.signal).toBe('SIGTERM');
      expect(result.timedOut).toBe(false);
      expect(result.output).toContain('Picked up JAVA_TOOL_OPTIONS');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  }
);

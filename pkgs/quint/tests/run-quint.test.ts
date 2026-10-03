import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runQuint } from '@pkgs/quint/run-quint';

// regression: check-quint-silent-exit
test('a checker terminated after the JVM notice retains its exit signal and stderr', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'quint-signal-'));
  try {
    const result = await runQuint({
      args: [
        '-e',
        "console.error('Picked up JAVA_TOOL_OPTIONS: -XX:ActiveProcessorCount=4'); process.kill(process.pid, 'SIGTERM')",
      ],
      cwd,
      env: {},
      timeoutMs: 1000,
    });
    expect(result.code).toBeNull();
    expect(result.signal).toBe('SIGTERM');
    expect(result.timedOut).toBe(false);
    expect(result.output).toContain('Picked up JAVA_TOOL_OPTIONS');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

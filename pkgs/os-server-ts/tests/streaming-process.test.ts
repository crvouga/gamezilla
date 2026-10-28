import { expect, test } from 'bun:test';
import { startProcess } from '@pkgs/os-server-ts/streaming-process';

test('process requests preserve environment, working directory and graceful termination', async () => {
  const child = startProcess({
    command: process.execPath,
    args: [
      '-e',
      'process.on("SIGTERM", () => process.exit(0)); console.log(process.env.PROCESS_REQUEST_MARKER); console.log(process.cwd()); setInterval(() => {}, 1000);',
    ],
    env: { PROCESS_REQUEST_MARKER: 'process-request-value' },
    cwd: import.meta.dir,
  });
  const output: string[] = [];
  const ready = new Promise<void>((resolve) => {
    child.stdout.on('data', (chunk: Buffer) => {
      output.push(chunk.toString());
      if (output.join('').includes(import.meta.dir)) resolve();
    });
  });
  child.stderr.resume();
  try {
    await ready;
    child.terminate();
    // POSIX delivers SIGTERM to the child's handler, which exits 0. Windows
    // has no signals, so there the child is ended without running it.
    expect(await child.completed).toBe(process.platform === 'win32' ? null : 0);
    expect(output.join('')).toBe(`process-request-value\n${import.meta.dir}\n`);
  } finally {
    child.stop();
  }
});

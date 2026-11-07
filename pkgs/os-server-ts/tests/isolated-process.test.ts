// @io-wall-ok — exercise failed child spawn through the public process port.
import { expect, test } from 'bun:test';
import { createIsolatedProcess } from '@pkgs/os-server-ts/wall-isolated-process';

// regression: isolated-process-failed-spawn-cleanup
test('cleanup completes after an isolated process cannot spawn', async () => {
  const executable = process.execPath;
  let worker: ReturnType<typeof createIsolatedProcess>;
  try {
    process.execPath = `${executable}.missing-isolated-process-regression`;
    worker = createIsolatedProcess(new URL(import.meta.url));
  } finally {
    process.execPath = executable;
  }
  const failure = new Promise<string>((resolve) => worker.onError(resolve));
  expect(await failure).toContain('ENOENT');
  await worker.terminate();
});

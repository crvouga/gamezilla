import { expect, test } from 'bun:test';
import { join } from 'node:path';

/** Windows spells it `Path`; drop every spelling before replacing it. */
function withoutPath(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(env).filter(([key]) => key.toUpperCase() !== 'PATH')
  );
}

/** Run both cleanups in a child whose PATH has no `ps`, as on Windows. */
function cleanupWithoutPs(platform: NodeJS.Platform) {
  const script = `
    import { killAllEsbuildServices, killOrphanEsbuildServices } from '@pkgs/os-server-ts/kill-orphan-esbuild';
    const options = { commandIncludes: ${JSON.stringify(import.meta.dir)}, platform: ${JSON.stringify(platform)} };
    killOrphanEsbuildServices(options);
    killAllEsbuildServices(options);
  `;
  return Bun.spawnSync([process.execPath, '-e', script], {
    cwd: import.meta.dir,
    env: {
      ...withoutPath(process.env),
      PATH: join(import.meta.dir, 'no-such-bin'),
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });
}

test('esbuild cleanup is a no-op on Windows, where there is no ps to snapshot', () => {
  // regression: windows-ci-esbuild-cleanup-ps
  expect(cleanupWithoutPs('win32').exitCode).toBe(0);
  const posix = cleanupWithoutPs('linux');
  expect(posix.exitCode).not.toBe(0);
  expect(posix.stderr.toString()).toContain(
    'Ownership process snapshot failed'
  );
});

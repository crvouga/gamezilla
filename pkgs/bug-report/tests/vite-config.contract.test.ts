import { expect, test } from 'bun:test';
import { capture } from '@pkgs/os';

// regression: bug-report-vite-node-import
test('Node can load the reporting plugin while evaluating a build config', () => {
  const result = capture(
    'node',
    [
      '--experimental-strip-types',
      '--input-type=module',
      '-e',
      `import { bugReportsDevPlugin } from '@pkgs/bug-report/vite';
     const plugin = bugReportsDevPlugin({ repoRoot: '.' });
     if (plugin.apply !== 'serve') throw new Error('Expected a dev-only plugin');`,
    ],
    { cwd: `${import.meta.dir}/..` }
  );
  expect(result.stderr).not.toContain('ERR_MODULE_NOT_FOUND');
  expect(result.status).toBe(0);
});

test('Vite can load the reporting backend when configuring a dev server', () => {
  const result = capture(
    'node',
    [
      '--experimental-strip-types',
      '--input-type=module',
      '-e',
      `import { createServer } from 'vite';
       import { bugReportsDevPlugin } from '@pkgs/bug-report/vite';
       const server = await createServer({
         configFile: false,
         plugins: [bugReportsDevPlugin({ repoRoot: process.cwd() })],
         server: { middlewareMode: true, hmr: false, watch: null },
         optimizeDeps: { noDiscovery: true },
       });
       await server.close();`,
    ],
    { cwd: `${import.meta.dir}/..` }
  );
  expect(result.stderr).not.toContain('ERR_MODULE_NOT_FOUND');
  expect(result.status).toBe(0);
});

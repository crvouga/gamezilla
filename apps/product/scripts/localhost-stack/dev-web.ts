// @io-wall-ok — development process entry.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { devStackOptions } from './dev-options';
import { manifestPath, readManifest } from './manifest';

const root = join(import.meta.dir, '../../../..');
const options = devStackOptions();
if (!options.withWeb) process.exit(0);
const path = manifestPath(root, options.instanceId);
const deadline = Date.now() + 120_000;
while (!existsSync(path)) {
  if (Date.now() >= deadline)
    throw new Error('Stack did not publish its readiness manifest');
  await Bun.sleep(100);
}
const manifest = readManifest(path);
const child = spawn(
  'bun',
  ['run', 'vite', '--host', '127.0.0.1', '--strictPort'],
  {
    cwd: join(root, 'apps/product'),
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_PORT: new URL(manifest.webOrigin).port,
      VITE_API_URL: manifest.apiOrigin,
      VITE_LOCAL_PREVIEW_API_ORIGIN: manifest.apiOrigin,
      ...(options.frozenWeb ? { PRODUCT_DEV_FROZEN: '1' } : {}),
      ...(options.testHooks ? { VITE_TEST_HOOKS: '1' } : {}),
    },
  }
);
const stop = () => child.kill('SIGTERM');
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('error', (error) => {
  throw error;
});
child.on('exit', (code) => process.exit(code ?? 1));

import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { PRODUCTION_API_HTTP_HOSTNAMES } from '@libs/app-root-shared-ts/api-servers';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';

const apps = resolve(import.meta.dir, '../../../apps');
const commitDate = '2026-01-01T00:00:00Z';
const localOrigin = 'http://localhost:4321';

for (const app of ['product-ts', 'product-client-ts']) {
  test(`${app} setup writes its local API and commit metadata atomically`, () => {
    const cache = join(apps, app, '.cache');
    mkdirSync(cache, { recursive: true });
    const dir = mkdtempSync(join(cache, 'web-dev-env-'));
    try {
      copyFileSync(join(apps, app, 'package.json'), join(dir, 'package.json'));
      const env = {
        ...process.env,
        VITE_API_URL: `https://${PRODUCTION_API_HTTP_HOSTNAMES[0]}`,
        VITE_ALLOW_PRODUCTION_API_URL: '0',
        VITE_LOCAL_PREVIEW_API_ORIGIN: localOrigin,
        VITE_COMMIT_HASH: 'ABC1234',
        VITE_COMMIT_DATE: commitDate,
        VITE_TEST_HOOKS: ' 1 ',
      };
      const setup = (vars: typeof env) =>
        spawnSync(process.execPath, ['run', 'setup'], {
          cwd: dir,
          env: vars,
          encoding: 'utf8',
        });
      const first = setup(env);
      expect(first.status, first.stderr).toBe(0);
      expect(first.stdout).toContain(
        `[setup-env] .env.local: ${localOrigin} @ abc1234`
      );
      const output = join(dir, '.env.local');
      const body = readFileSync(output, 'utf8');
      expect(body).toBe(
        `VITE_API_URL="${localOrigin}"\nVITE_COMMIT_HASH="abc1234"\nVITE_COMMIT_DATE="${commitDate}"\nVITE_TEST_HOOKS="1"\n`
      );
      const rejected = setup({ ...env, VITE_COMMIT_HASH: 'invalid' });
      expect(rejected.status).toBe(1);
      expect(rejected.stderr).toContain('VITE_COMMIT_HASH must match');
      expect(readFileSync(output, 'utf8')).toBe(body);
      expect(readdirSync(dir).sort()).toEqual(['.env.local', 'package.json']);
    } finally {
      removeTree(dir, { whenLocked: 'leave' });
    }
  });
}

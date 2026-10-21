import { expect, test } from 'bun:test';
import { outputArgs, varFileArgs } from '@libs/infra-shared-ts/tofu-command';

const PATHS = { tofuDir: '/tofu', cacheDir: '/cache' };

// regression: tofu-output-without-backend-vars
test('reading foundation outputs passes the backend variables', () => {
  const target = { stack: 'foundation' as const, env: 'dev' };
  const args = outputArgs(PATHS, target);
  expect(args).toContain('output');
  expect(args).toContain('-json');
  for (const file of varFileArgs(PATHS, target)) expect(args).toContain(file);
});

import { expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tofuLayout } from '@libs/infra-server-ts/tofu-layout';
import { stackDir } from '@libs/infra-shared-ts/tofu-command';

// regression: infra-runtime-split-tofu-path
test('the infra server executes the fleet stack from infra-shared', () => {
  const serverDir = join(import.meta.dirname, '..');
  const { paths, policyDir } = tofuLayout(serverDir);

  // `resolve` reads `/` and `\` alike, so this holds on Windows too.
  expect(resolve(stackDir(paths, 'fleet'))).toBe(
    resolve(serverDir, '../infra-shared-ts/tofu/stacks/fleet')
  );
  expect(existsSync(stackDir(paths, 'fleet'))).toBe(true);
  expect(existsSync(join(policyDir, 'stateful.rego'))).toBe(true);
});

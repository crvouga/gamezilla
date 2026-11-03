import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// regression: app-env-identity-context-dependency-missing
test('the extracted identity context declares its Solid context dependency', () => {
  const root = join(import.meta.dirname, '../../..');
  const manifest = JSON.parse(
    readFileSync(join(root, 'libs/app-env-client-ts/package.json'), 'utf8')
  ) as { dependencies: Record<string, string> };
  const identity = readFileSync(
    join(root, 'libs/app-env-client-ts/src/global-menu-identity-context.tsx'),
    'utf8'
  );
  expect(identity).toContain('@pkgs/solid-context-client-ts/define-context');
  expect(manifest.dependencies['@pkgs/solid-context-client-ts']).toBe(
    'workspace:*'
  );
});

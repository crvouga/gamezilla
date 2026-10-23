import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// regression: hyperdrive-exhausts-postgres-connections
test('the application pool leaves direct database sessions available', () => {
  const module = readFileSync(
    join(
      import.meta.dirname,
      '../../infra-shared-ts/tofu/modules/database/main.tf'
    ),
    'utf8'
  );
  const declared = module.match(/origin_connection_limit\s*=\s*(\d+)/);
  expect(declared).not.toBeNull();
  const limit = Number(declared?.[1]);
  expect(limit).toBeGreaterThanOrEqual(5);
  expect(limit).toBeLessThanOrEqual(10);
});

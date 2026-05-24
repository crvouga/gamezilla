import { assert } from '@pkgs/assert';

export function assertDatabaseName(name: unknown): asserts name is string {
  assert.string(name, 'Database name must be a string');
  assert.ok(name.length > 0, 'Database name must be non-empty');
  assert.ok(
    name.length <= 255,
    'Database name must be less than 255 characters'
  );
  assert.ok(
    Boolean(name.match(/^[a-zA-Z0-9_]+$/)),
    'Database name must contain only letters, numbers, and underscores'
  );
}

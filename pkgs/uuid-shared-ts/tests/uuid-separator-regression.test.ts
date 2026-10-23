import { expect, test } from 'bun:test';
import { assertUuid, isUuid } from '@pkgs/uuid-shared-ts/uuid';

// regression: uuid-corruption-generator-keeps-hyphen
test('the shrunk unchanged separator remains a valid UUID', () => {
  const id = '00000000-0000-1000-8000-000000000000';
  const at = 23;
  const bad = '-';
  expect(`${id.slice(0, at)}${bad}${id.slice(at + 1)}`).toBe(id);
  expect(isUuid(id)).toBe(true);
  expect(() => assertUuid(id, 'uuid')).not.toThrow();
});

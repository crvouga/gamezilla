import { expect, test } from 'bun:test';
import { createUuidV7 } from '@pkgs/uuid';

test('UUIDv7 embeds injected milliseconds and reuses injected entropy', () => {
  const entropy = '00112233-4455-4677-8899-aabbccddeeff';
  const first = createUuidV7(1_700_000_000_000, entropy);
  const second = createUuidV7(1_700_000_000_001, entropy);
  expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab]/);
  expect(first < second).toBe(true);
  expect(createUuidV7(1_700_000_000_000, entropy)).toBe(first);
});

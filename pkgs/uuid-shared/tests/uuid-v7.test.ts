import { expect, test } from 'bun:test';
import { createUuidV7 } from '@pkgs/uuid-shared/uuid-v7';

// regression: uuid-v7-mixed-case — upper-case entropy was copied verbatim
// next to the lower-case time and variant nibbles, minting a mixed-case id.
test('UUIDv7 is lower-case even when the entropy uuid is upper-case', () => {
  expect(createUuidV7(0, '00000000-0000-1000-8000-0000000A0000')).toBe(
    '00000000-0000-7000-8000-0000000a0000'
  );
});

import { expect, test } from 'bun:test';
import { memberIsIdle } from '@libs/spaces-shared-ts/space-quiet';

test('a person is idle only when every device they are looking from is quiet', () => {
  expect(memberIsIdle({}, [])).toBe(false);
  expect(memberIsIdle({ phone: true }, ['phone'])).toBe(true);
  expect(memberIsIdle({ phone: true }, ['phone', 'computer'])).toBe(false);
  expect(memberIsIdle({ phone: true }, ['away:phone'])).toBe(false);
  expect(memberIsIdle({ computer: true }, ['away:phone', 'computer'])).toBe(
    true
  );
});

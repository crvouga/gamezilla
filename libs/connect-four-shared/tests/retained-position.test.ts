import { expect, test } from 'bun:test';
import { connectFourRules } from '@libs/connect-four-shared/connect-four-rules';

// regression: connect-four-replay-normalizes-invalid-actions
test('an empty accepted action is never replayed as a drop in column zero', () => {
  expect(
    connectFourRules.play(connectFourRules.initial(), '', '', [])
  ).toBeNull();
  expect(() => connectFourRules.replay([''], 1)).toThrow();
});

test.each([' ', '1.0', '1e0', '+1', '01', '0\n', '1\r\n'])(
  'replay rejects the same noncanonical column syntax as live play: %s',
  (action) => {
    expect(connectFourRules.play('c4:1:', action, '', [])).toBeNull();
    expect(() => connectFourRules.replay([action], 1)).toThrow();
  }
);
